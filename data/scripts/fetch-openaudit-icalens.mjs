// Reads our ICA Lens baseline runs on SynthSAEBench-16k (evals/sparse-autoencoders/icalens/run.sh)
// and writes data/extracted/methods/openaudit-icalens.json: one artifact for each fit seed, with
// the fit settings of its lens manifest and the metrics of its results.json.
//   node data/scripts/fetch-openaudit-icalens.mjs [runs dir; default
//     evals/sparse-autoencoders/out/icalens-baseline] [--allow-dirty]
// --allow-dirty accepts runs of a harness with local changes (for a test, not for prod).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SUBJECT = "decoderesearch/synth-sae-bench-16k-v1";
const EVAL = "synth-sae-bench-16k";
const VERSION = "16k-v1";
const RUNNER =
  "https://github.com/decoderesearch/openaudit/tree/main/evals/sparse-autoencoders/icalens";
const OUT = join(
  ROOT,
  "data",
  "extracted",
  "methods",
  "openaudit-icalens.json",
);

const allowDirty = process.argv.includes("--allow-dirty");
const [dirArg] = process.argv.slice(2).filter((a) => a !== "--allow-dirty");
const dir = resolve(
  dirArg ??
    join(ROOT, "evals", "sparse-autoencoders", "out", "icalens-baseline"),
);
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

const artifacts = [];
let icalens;
for (const name of readdirSync(dir)
  .filter((n) => /^seed-\d+$/.test(n))
  .sort()) {
  const run = read(join(dir, name, "results.json")).runs?.[SUBJECT];
  const manifest = read(join(dir, name, "lens", "icalens.json"));
  if (!run || run.tier !== "full" || run.partial)
    throw new Error(`${name}: no full run of ${SUBJECT}`);
  if (run.harness.openauditDirty && !allowDirty) {
    throw new Error(
      `${name}: the harness had local changes; commit it and run again, or --allow-dirty`,
    );
  }
  const result = run.evals[EVAL];
  if (result?.version !== VERSION)
    throw new Error(`${name}: no ${EVAL} ${VERSION} result`);
  const layer = manifest.layers["0"];
  const fit = layer.fitting;
  const seed = Number(name.slice("seed-".length));
  if (fit.random_state !== seed)
    throw new Error(`${name}: the lens has random_state ${fit.random_state}`);
  if (icalens && icalens !== manifest.package_version)
    throw new Error(
      `${name}: icalens ${manifest.package_version}, not ${icalens}`,
    );
  icalens = manifest.package_version;
  artifacts.push({
    key: `openaudit/ica-lens/synth-16k-v1/seed-${seed}`,
    method: "sparse-autoencoders",
    variant: "ica-lens",
    displayName: `ICA Lens, seed ${seed}`,
    subject: SUBJECT,
    sites: [],
    params: {
      width: layer.n_components,
      seed,
      trainingSamples: fit.n_samples,
      dtype: fit.stored_dtype,
      icalensPreprocessing: manifest.input_preprocessing.icalens_preprocessing,
      fitIterations: fit.max_iter,
    },
    sourceUrl: RUNNER,
    results: [
      {
        eval: EVAL,
        version: VERSION,
        sourceUrl: RUNNER,
        metrics: result.metrics,
      },
    ],
  });
}
if (!artifacts.length) throw new Error(`no seed-* runs in ${dir}`);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  `${JSON.stringify({ source: { runner: RUNNER, icalens: `icalens ${icalens}` }, artifacts }, null, 2)}\n`,
);
const mcc = artifacts.map((a) => a.results[0].metrics.mcc);
console.log(
  `wrote ${OUT}: ${artifacts.length} seeds, MCC ${Math.min(...mcc).toFixed(4)} to ${Math.max(...mcc).toFixed(4)}`,
);
