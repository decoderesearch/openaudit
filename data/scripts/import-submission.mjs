// Imports a method variant submission (submissions/<method>/<variant>/) from OUR runs of its
// files: writes data/extracted/methods/submission-<method>-<variant>.json and prints the variant
// entry for data/seed/methods/<method>.json. The submitter's results.json only gets a compare.
//   node data/scripts/import-submission.mjs submissions/<method>/<variant> <our results.json> ...
// --allow-dirty accepts our runs of a harness with local changes (for a test).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { checkSubmission, rulesFor } from "../../submissions/check.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const REPO_URL = "https://github.com/decoderesearch/openaudit";
// A self-score this far from ours (relative, for a metric larger than 1) needs a reason before the
// import.
const MAX_GAP = 0.02;
const gapOf = (a, b) => Math.abs(a - b) / Math.max(1, Math.abs(b));

const allowDirty = process.argv.includes("--allow-dirty");
const [dirArg, ...oursArgs] = process.argv
  .slice(2)
  .filter((a) => a !== "--allow-dirty");
if (!dirArg || !oursArgs.length) {
  console.error(
    "usage: node data/scripts/import-submission.mjs submissions/<method>/<variant> <our results.json> ...",
  );
  process.exit(2);
}
const dir = resolve(dirArg);
const { errors, warnings } = checkSubmission(dir);
// A form submission has no results.json of its own: we make the folder.
const blocking = errors.filter((e) => !e.startsWith("results.json"));
for (const w of [...warnings, ...errors.filter((e) => !blocking.includes(e))]) {
  console.log(`warning: ${w}`);
}
if (blocking.length) {
  for (const e of blocking) console.error(`error: ${e}`);
  process.exit(1);
}

const s = JSON.parse(readFileSync(join(dir, "submission.json"), "utf8"));
const oursResults = oursArgs.map((path) => [
  path,
  JSON.parse(readFileSync(path, "utf8")),
]);
const method = rulesFor(s, oursResults[0][1].schema, dirname(dir));
const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
};
const theirs = readJson(join(dir, "results.json"))?.runs ?? {};

// Our run of each artifact: the newest run of its model.
const ours = new Map();
for (const [path, r] of oursResults) {
  if (r.schema !== method.results) {
    console.error(`${path}: schema is not ${method.results}`);
    process.exit(1);
  }
  for (const run of Object.values(r.runs)) {
    const old = ours.get(run.model);
    if (!old || old.date < run.date) ours.set(run.model, run);
  }
}

// A recipe submission has no artifact files: each of our fits of the recipe is an artifact.
const entries = s.artifacts.length
  ? s.artifacts
  : [...ours.keys()].map((model) => ({
      model,
      sha256: s.recipe?.file?.sha256,
      path: s.recipe?.file?.path,
      params: {},
    }));
const artifacts = [];
let gaps = 0;
for (const a of entries) {
  const run = ours.get(a.model);
  const problem = !run
    ? "no run of ours"
    : run[method.artifact]?.sha256 !== a.sha256
      ? "our run is of another file (sha256)"
      : run.tier !== "full" || run.partial
        ? "our run is not a full run"
        : run.harness?.openauditDirty && !allowDirty
          ? "our run had local harness changes (--allow-dirty)"
          : null;
  if (problem) {
    console.error(`${a.model}: ${problem}`);
    process.exit(1);
  }
  const results = Object.entries(run.evals).map(([evalSlug, e]) => ({
    eval: evalSlug,
    version: e.version,
    sourceUrl: `${REPO_URL}/tree/${run.harness.openaudit}/${method.harness}`,
    metrics: e.metrics,
  }));
  artifacts.push({
    key: `submission/${s.variant}/${a.model.toLowerCase()}`,
    method: s.method,
    variant: s.variant,
    displayName: `${s.displayName}, ${a.model.split("/")[1]} (OpenAudit run)`,
    subject: a.model,
    sites:
      run.sites ??
      (run.layers
        ? [{ role: "read", source: `layers ${run.layers.join(", ")}` }]
        : []),
    params: { resultsBy: "OpenAudit", ...a.params },
    license: s.license,
    sourceUrl:
      a.url ?? `${REPO_URL}/blob/main/${relative(ROOT, dir)}/${a.path}`,
    // Our fitted probe: mirror it to R2 before the seed import.
    ...(run.fit?.files && { files: run.fit.files }),
    results,
  });

  console.log(`\n${a.model}: ours vs. self-reported`);
  for (const [evalSlug, e] of Object.entries(run.evals)) {
    const self = theirs[a.model]?.evals?.[evalSlug];
    for (const [key, value] of Object.entries(e.metrics)) {
      const other =
        self?.version === e.version ? self.metrics?.[key] : undefined;
      const gap = other === undefined ? null : gapOf(other, value);
      if (gap !== null && gap > MAX_GAP) gaps += 1;
      console.log(
        `  ${evalSlug} ${key}: ${value.toFixed(3)}  ${other === undefined ? "-" : other.toFixed(3)}${gap !== null && gap > MAX_GAP ? "  <- gap" : ""}`,
      );
    }
  }
}

const core = s.artifacts.length ? [] : (method.coreModels ?? []);
const notFit = core.filter((m) => !ours.has(m));
if (notFit.length) {
  console.warn(
    `\nwarning: no run of ours on ${notFit.length} of ${core.length} core models (${notFit.join(", ")}). The site ranks a recipe only with a fit on each core model.`,
  );
}

const out = join(
  ROOT,
  "data",
  "extracted",
  "methods",
  `submission-${s.method}-${s.variant}.json`,
);
mkdirSync(join(ROOT, "data", "extracted", "methods"), { recursive: true });
writeFileSync(
  out,
  JSON.stringify({ source: { submission: dirArg }, artifacts }, null, 2) + "\n",
);
console.log(`\nwrote ${out}`);
if (gaps) {
  console.log(
    `${gaps} metrics differ from the self-report by more than ${MAX_GAP}. Find out why before the seed import.`,
  );
}

// The access of the method's variants on the site, for example "black_box" for a monitor.
const seedPath = join(ROOT, "data", "seed", "methods", `${s.method}.json`);
const seedAccess =
  readJson(seedPath)?.variants?.find((v) => v.access)?.access ?? "white_box";

const variant = {
  slug: s.variant,
  displayName: s.displayName,
  aliases: [s.displayName],
  access: seedAccess,
  summary: s.summary,
  baseline: false,
  params: [],
  links: (s.links ?? []).map(({ kind, url, title }) => ({
    kind,
    url,
    ...(title && { title }),
  })),
};
const where = readJson(seedPath)
  ? `data/seed/methods/${s.method}.json`
  : `the variants of a new data/seed/methods/${s.method}.json, with { "method": <${dirArg}/../method.json> }`;
console.log(
  `\nAdd this variant to ${where}, then edit its summary:\n${JSON.stringify(variant, null, 2)}`,
);
