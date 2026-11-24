import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  boardMarkdown,
  harnessBoard,
  ranked,
  withBoard,
} from "./leaderboards.mjs";
import { preview } from "./rank.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const row = (variant, value, baseline = false) => ({
  method: "m",
  variant,
  value,
  baseline,
});

test("ranks: ties share a rank, baselines get none, best first", () => {
  const rows = ranked(
    [row("a", 0.5), row("b", 0.9), row("c", 0.5), row("base", 0.95, true)],
    "higher_is_better",
  );
  assert.deepEqual(
    rows.map((r) => [r.variant, r.rank]),
    [
      ["base", null],
      ["b", 1],
      ["a", 2],
      ["c", 2],
    ],
  );
  const low = ranked([row("a", 0.2), row("b", 0.1)], "lower_is_better");
  assert.deepEqual(
    low.map((r) => [r.variant, r.rank]),
    [
      ["b", 1],
      ["a", 2],
    ],
  );
});

test("each harness's leaderboard.json is up to date", () => {
  for (const name of readdirSync(join(ROOT, "evals"))) {
    const path = join(ROOT, "evals", name, "leaderboard.json");
    const { updated, ...saved } = JSON.parse(readFileSync(path, "utf8"));
    assert.deepEqual(
      saved,
      harnessBoard(join(ROOT, "evals", name)),
      `${name}: run node submissions/leaderboards.mjs`,
    );
    assert.match(updated, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test("boards show only public evals and variants", () => {
  const seed = (...path) =>
    JSON.parse(readFileSync(join(ROOT, "data", "seed", ...path), "utf8"));
  const variants = new Map();
  for (const f of readdirSync(join(ROOT, "data", "seed", "methods"))) {
    const m = seed("methods", f);
    for (const v of m.variants)
      variants.set(`${m.method.slug}/${v.slug}`, v.visibility ?? "public");
  }
  for (const name of readdirSync(join(ROOT, "evals"))) {
    for (const e of harnessBoard(join(ROOT, "evals", name)).evals) {
      assert.equal(seed("evals", `${e.slug}.json`).eval.visibility, "public");
      const rows = [...e.overall, ...Object.values(e.models).flat()];
      for (const r of rows)
        assert.equal(variants.get(`${r.method}/${r.variant}`), "public");
    }
  }
});

test("a core-model eval ranks over models only the variants with each core model", () => {
  const board = harnessBoard(join(ROOT, "evals", "varied-deception"));
  const e = board.evals[0];
  assert.equal(e.coreModels.length, 9);
  for (const r of e.overall) assert.equal(r.models, 9);
});

test("the README part is the first section, and a new one replaces the old one", () => {
  const readme = "# H\n\nIntro.\n\n## Steps\n\nx\n\n## Submit\n\ny\n";
  const board = { evals: [] };
  const once = withBoard(readme, boardMarkdown(board, "2026-01-01", {}));
  assert.match(
    once,
    /^# H\n\nIntro\.\n\n## Leaderboard\n\n<!-- leaderboard:start -->[\s\S]*2026-01-01[^\n]*\n\n<!-- leaderboard:end -->\n\n## Steps/,
  );
  const twice = withBoard(once, boardMarkdown(board, "2026-02-02", {}));
  assert.equal(twice.match(/leaderboard:start/g).length, 1);
  assert.match(twice, /2026-02-02/);
});

test("the rank preview: each model, and over the core models", () => {
  const board = JSON.parse(
    readFileSync(
      join(ROOT, "evals", "varied-deception", "leaderboard.json"),
      "utf8",
    ),
  );
  const e = board.evals[0];
  const run = (value, tier = "full") => ({
    tier,
    partial: tier !== "full",
    evals: {
      [e.slug]: { version: e.version, metrics: { balanced_accuracy: value } },
    },
  });
  const one = preview({ runs: { [e.coreModels[0]]: run(1) } }, board)[0];
  assert.equal(one.models[0].rank, 1);
  assert.equal(one.overall, null);
  assert.equal(one.missing.length, e.coreModels.length - 1);

  const all = Object.fromEntries(e.coreModels.map((m) => [m, run(0)]));
  const last = preview({ runs: all }, board)[0];
  assert.equal(last.overall.rank, last.overall.of);
  assert.equal(
    last.overall.of,
    e.overall.filter((r) => !r.baseline).length + 1,
  );

  all[e.coreModels[0]] = run(1, "smoke");
  assert.equal(preview({ runs: all }, board)[0].overall, null);
});
