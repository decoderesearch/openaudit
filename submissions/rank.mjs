// Shows where your results.json would rank on the leaderboard of its harness
// (evals/<harness>/leaderboard.json), before you submit. It is a preview: only our run of your
// variant goes on the site, and the board can change.
//   node submissions/rank.mjs <results.json> [--name "My variant"]
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { METHODS } from "./check.mjs";
import { better, median, ranked } from "./leaderboards.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const YOU = "(your results)";

/** The rules of the harness of a results.json schema. */
function harnessOf(schema) {
  for (const hs of Object.values(METHODS)) {
    for (const h of hs) if (h.results === schema) return h;
  }
  return null;
}

/** Your rank on each model, and over models, for each eval of the board. */
export function preview(results, board) {
  const runs = Object.entries(results.runs ?? {});
  return board.evals.map((e) => {
    const key = e.metric.key;
    const mine = runs.flatMap(([model, run]) => {
      const r = run.evals?.[e.slug];
      const value = r?.version === e.version ? r.metrics?.[key] : undefined;
      if (typeof value !== "number") return [];
      return [{ model, value, full: run.tier === "full" && !run.partial }];
    });
    const models = mine.map((m) => {
      const rows = (e.models[m.model] ?? []).filter((c) => !c.baseline);
      const rank =
        1 +
        rows.filter((c) => better(e.metric.direction, c.value, m.value)).length;
      const best = ranked(rows, e.metric.direction)[0];
      return { ...m, rank, of: rows.length + 1, best: best ?? null };
    });

    let overall = null;
    const core = e.coreModels;
    // Only full runs on the board's models count over models.
    const used = mine.filter(
      (m) => m.full && (core ? core.includes(m.model) : e.models[m.model]),
    );
    const missing = core
      ? core.filter((c) => !used.some((m) => m.model === c))
      : [];
    if (used.length && !missing.length) {
      const value = median(used.map((m) => m.value));
      const rows = e.overall.filter((r) => !r.baseline);
      overall = {
        value,
        rank:
          1 +
          rows.filter((r) => better(e.metric.direction, r.median, value))
            .length,
        of: rows.length + 1,
        // With no core models, each variant's median is over its own models.
        sameModels: Boolean(core),
      };
    }
    return { eval: e, models, overall, missing };
  });
}

const fmt = (x) => (x == null ? "-" : x.toFixed(3));

function print(previews, name, fit) {
  for (const p of previews.filter((x) => x.models.length)) {
    const e = p.eval;
    console.log(
      `\n${e.displayName} ${e.version}: ${e.metric.displayName} (${e.metric.direction.replaceAll("_", " ")})`,
    );
    for (const m of p.models) {
      const tier = m.full ? "" : " (not a full run: do not submit it)";
      const place = m.best
        ? `rank ${m.rank} of ${m.of}; first now: ${m.best.variant} ${fmt(m.best.value)}`
        : "no other variant on this model yet";
      console.log(`  ${m.model}: ${fmt(m.value)}, ${place}${tier}`);
    }
    if (p.overall) {
      const note = p.overall.sameModels
        ? ""
        : " (the others are over their own models)";
      console.log(
        `  Over models: median ${fmt(p.overall.value)}, rank ${p.overall.rank} of ${p.overall.of}${note}`,
      );
    } else if (p.missing.length) {
      const others = fit ? " We fit your recipe on the others." : "";
      console.log(
        `  Over models: no rank. The board ranks on ${e.coreModels.length} core models, and has no full run of yours on ${p.missing.join(", ")}.${others}`,
      );
    } else {
      console.log(
        "  Over models: no rank. No full run on a model of the board.",
      );
    }
  }
  const none = previews.filter((x) => !x.models.length);
  if (none.length) {
    const names = none.map((x) => `${x.eval.displayName} ${x.eval.version}`);
    console.log(`\nNo result of ${name} on: ${names.join(", ")}.`);
  }
  console.log(
    "\nA preview only: we run each variant again, and only our run goes on the site.",
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [path, ...rest] = process.argv.slice(2);
  if (!path) {
    console.error(
      'usage: node submissions/rank.mjs <results.json> [--name "My variant"]',
    );
    process.exit(2);
  }
  const at = rest.indexOf("--name");
  const name = at >= 0 ? rest[at + 1] : YOU;
  const results = JSON.parse(readFileSync(path, "utf8"));
  const rules = harnessOf(results.schema);
  if (!rules) {
    console.error(
      `${path}: no harness has the schema ${JSON.stringify(results.schema)}`,
    );
    process.exit(1);
  }
  const boardPath = join(ROOT, rules.harness, "leaderboard.json");
  if (!existsSync(boardPath)) {
    console.error(`${rules.harness} has no leaderboard.json yet`);
    process.exit(1);
  }
  const board = JSON.parse(readFileSync(boardPath, "utf8"));
  console.log(
    `${name} on the ${rules.harness} leaderboard of ${board.updated}`,
  );
  print(preview(results, board), name, Boolean(rules.fit));
}
