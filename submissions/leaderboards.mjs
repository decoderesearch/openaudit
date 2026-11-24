// Writes the leaderboard of each harness: evals/<harness>/leaderboard.json and a table in its
// README.md, from the seed (data/seed) and the method results (data/extracted/methods). The ranks
// follow the site's rules (apps/web/lib/methods.ts): each model ranks the variants on the eval's
// headline metric, with ties at the same rank and baselines not ranked; over models, the median,
// on the core models only when the eval has them. The site is the source of truth.
//   node submissions/leaderboards.mjs           (write the files)
//   node submissions/leaderboards.mjs --check   (fail when a file is not up to date)
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const SITE = "https://openaudit.com";
export const LEADERBOARD_SCHEMA = "openaudit.leaderboard/1";
const TOP = 10;
const START = "<!-- leaderboard:start -->";
const END = "<!-- leaderboard:end -->";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const jsonFiles = (dir) =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => join(dir, f));

/** An unlisted or private eval or variant does not go on a board: a board lists and links it. */
const listed = (x) => (x.visibility ?? "public") === "public";
const evalEntry = (slug) =>
  readJson(join(ROOT, "data", "seed", "evals", `${slug}.json`));

/** True when `a` is better than `b`. */
export function better(direction, a, b) {
  if (direction === "higher_is_better") return a > b;
  if (direction === "lower_is_better") return a < b;
  return false;
}

export function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** `rows` with `rank`: 1 + the rows that are strictly better. Baselines get no rank. */
export function ranked(rows, direction, key = "value") {
  const ranks = rows.filter((r) => !r.baseline);
  return rows
    .map((r) => ({
      ...r,
      rank: r.baseline
        ? null
        : 1 + ranks.filter((o) => better(direction, o[key], r[key])).length,
    }))
    .sort(
      (a, b) =>
        (better(direction, a[key], b[key]) ? -1 : 0) ||
        (better(direction, b[key], a[key]) ? 1 : 0) ||
        a.variant.localeCompare(b.variant),
    );
}

/** The seed data that the boards need. */
function loadData() {
  const methods = {};
  for (const path of jsonFiles(join(ROOT, "data", "seed", "methods"))) {
    const m = readJson(path);
    methods[m.method.slug] = {
      displayName: m.method.displayName,
      variants: Object.fromEntries(m.variants.map((v) => [v.slug, v])),
    };
  }
  const artifacts = jsonFiles(
    join(ROOT, "data", "extracted", "methods"),
  ).flatMap((path) => readJson(path).artifacts);
  return { methods, artifacts };
}

/** The board of one eval version: each model's ranked variants, and the medians over models. */
export function evalBoard(slug, version, { methods, artifacts }) {
  const entry = evalEntry(slug);
  const v = entry.versions.find((x) => x.version === version);
  if (!v) throw new Error(`${slug} has no version ${version}`);
  const metric = v.metrics.find((m) => m.headline);
  const only = entry.versions.length === 1 ? version : null;
  // The best value of each variant on each model: a variant can have more than one artifact.
  const cells = new Map();
  for (const a of artifacts) {
    const variant = methods[a.method]?.variants[a.variant];
    if (!variant || !listed(variant)) continue;
    for (const r of a.results) {
      if (r.eval !== slug || (r.version ?? only) !== version) continue;
      const value = r.metrics?.[metric.key];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      const id = `${a.subject}|${a.method}/${a.variant}`;
      const c = cells.get(id);
      if (!c || better(metric.direction, value, c.value)) {
        cells.set(id, {
          subject: a.subject,
          method: a.method,
          variant: a.variant,
          baseline: Boolean(variant.baseline),
          value,
          artifacts: (c?.artifacts ?? 0) + 1,
        });
      } else c.artifacts += 1;
    }
  }
  const bySubject = {};
  for (const c of cells.values()) (bySubject[c.subject] ??= []).push(c);
  const models = Object.fromEntries(
    Object.keys(bySubject)
      .sort()
      .map((s) => [
        s,
        ranked(bySubject[s], metric.direction).map(({ subject, ...c }) => c),
      ]),
  );

  const core = v.methodSetup?.coreSubjects ?? null;
  const used = core?.length
    ? core.filter((s) => models[s])
    : Object.keys(models);
  const variants = new Map();
  for (const s of used) {
    for (const c of models[s]) {
      const key = `${c.method}/${c.variant}`;
      const x = variants.get(key) ?? {
        method: c.method,
        variant: c.variant,
        baseline: c.baseline,
        values: [],
      };
      x.values.push(c.value);
      variants.set(key, x);
    }
  }
  const overall = ranked(
    [...variants.values()]
      .filter((x) => !core?.length || x.values.length === core.length)
      .map(({ values, ...x }) => ({
        ...x,
        median: median(values),
        models: values.length,
      })),
    metric.direction,
    "median",
  );
  return {
    slug,
    version,
    displayName: entry.eval.displayName,
    url: `${SITE}/evaluations/${slug}`,
    metric: {
      key: metric.key,
      displayName: metric.displayName,
      direction: metric.direction,
    },
    coreModels: core?.length ? core : null,
    overall,
    models,
  };
}

/** The leaderboard of a harness folder, from its submission/rules.json. */
export function harnessBoard(dir, data = loadData()) {
  const rules = readJson(join(dir, "submission", "rules.json"));
  return {
    schema: LEADERBOARD_SCHEMA,
    harness: dir.split("/").filter(Boolean).pop(),
    site: SITE,
    evals: Object.entries(rules.evals)
      .filter(([slug]) => listed(evalEntry(slug).eval))
      .map(([slug, version]) => evalBoard(slug, version, data)),
  };
}

const fmt = (x) =>
  Math.abs(x) >= 100
    ? String(Math.round(x))
    : x.toFixed(Math.abs(x) >= 10 ? 1 : 3);

function variantName(c, methods) {
  const m = methods[c.method];
  const name = m.variants[c.variant].displayName;
  return `[${name}](${SITE}/methods/${c.method}/${c.variant})`;
}

/** The README part: the top variants of each eval, and the baselines. */
/** A table with padded columns, as Prettier writes it, so Prettier does not change it. */
function markdownTable(head, rows) {
  const width = (s) => [...s].length;
  const widths = head.map((h, i) =>
    Math.max(3, width(h), ...rows.map((r) => width(r[i]))),
  );
  const line = (cells) =>
    `| ${cells.map((c, i) => c + " ".repeat(widths[i] - width(c))).join(" | ")} |`;
  return [
    line(head),
    line(widths.map((w) => "-".repeat(w))),
    ...rows.map(line),
  ];
}

export function boardMarkdown(board, updated, data) {
  const lines = [START];
  if (!board.evals.length) lines.push("", "No public results yet.");
  for (const e of board.evals) {
    const over = e.coreModels
      ? `the median over the ${e.coreModels.length} core models`
      : "the median over the models with a result";
    lines.push(
      "",
      `### [${e.displayName}](${e.url}) ${e.version}`,
      "",
      `${e.metric.displayName} (${e.metric.direction === "lower_is_better" ? "lower is better" : "higher is better"}), ${over}.`,
    );
    const top = e.overall.filter((r) => !r.baseline).slice(0, TOP);
    const base = e.overall.filter((r) => r.baseline);
    if (!top.length && !base.length) {
      lines.push("", "No results yet.");
      continue;
    }
    const rows = [...top, ...base].map((r) => [
      String(r.rank ?? "Baseline"),
      variantName(r, data.methods),
      data.methods[r.method].displayName,
      fmt(r.median),
      String(r.models),
    ]);
    lines.push(
      "",
      ...markdownTable(["Rank", "Variant", "Method", "Score", "Models"], rows),
    );
    const more = e.overall.filter((r) => !r.baseline).length - top.length;
    if (more > 0) lines.push("", `${more} more on [the site](${e.url}).`);
    if (Object.values(e.models).some((cs) => cs.some((c) => c.artifacts > 1))) {
      lines.push(
        "",
        "A variant with more than one artifact on a model shows its best one. The site also compares them at matched settings.",
      );
    }
  }
  lines.push(
    "",
    `Our runs and published results, ${updated}. The site is the source of truth: it has each model, each variant and their samples. Generated by \`submissions/leaderboards.mjs\` from \`leaderboard.json\`.`,
    "",
    END,
  );
  return lines.join("\n");
}

/** The README with the board between the markers, else as its first section. */
export function withBoard(readme, markdown) {
  const a = readme.indexOf(START);
  const b = readme.indexOf(END);
  if (a >= 0 && b > a)
    return readme.slice(0, a) + markdown + readme.slice(b + END.length);
  const at = readme.indexOf("\n## ");
  if (at < 0) throw new Error("README.md has no ## section");
  return `${readme.slice(0, at)}\n## Leaderboard\n\n${markdown}\n${readme.slice(at)}`;
}

const canonical = (x) => JSON.stringify(x);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  const data = loadData();
  const today = new Date().toISOString().slice(0, 10);
  let stale = false;
  for (const name of readdirSync(join(ROOT, "evals")).sort()) {
    const dir = join(ROOT, "evals", name);
    if (!existsSync(join(dir, "submission", "rules.json"))) continue;
    const board = harnessBoard(dir, data);
    const jsonPath = join(dir, "leaderboard.json");
    const old = existsSync(jsonPath) ? readJson(jsonPath) : null;
    // The date changes only with the content, so that a run with no new results changes nothing.
    const { updated: oldDate, ...oldBoard } = old ?? {};
    const updated =
      old && canonical(oldBoard) === canonical(board) ? oldDate : today;
    const json = `${JSON.stringify({ ...board, updated }, null, 2)}\n`;
    const readmePath = join(dir, "README.md");
    const readme = readFileSync(readmePath, "utf8");
    const newReadme = withBoard(readme, boardMarkdown(board, updated, data));
    const changed =
      !old || readFileSync(jsonPath, "utf8") !== json || newReadme !== readme;
    if (check) {
      if (changed) {
        console.log(
          `evals/${name}: not up to date. Run node submissions/leaderboards.mjs`,
        );
        stale = true;
      } else console.log(`evals/${name}: OK`);
    } else if (changed) {
      writeFileSync(jsonPath, json);
      writeFileSync(readmePath, newReadme);
      console.log(`evals/${name}: written`);
    } else console.log(`evals/${name}: no change`);
  }
  process.exit(stale ? 1 : 0);
}
