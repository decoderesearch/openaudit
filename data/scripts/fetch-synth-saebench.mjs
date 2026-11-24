// Reads the SynthSAEBench-16k SAEs (Hugging Face model repo
// decoderesearch/synth-sae-bench-16k-v1-saes) and writes
// data/extracted/methods/synth-sae-bench-16k-v1.json: one line for each SAE (architecture, target
// L0 and seed), with its settings and its SynthSAEBench metrics from `stats.json`. Raw files are
// cached in data/cache/synth-saebench/<revision>/. Variants come from the aliases in
// data/seed/methods/.
//   node data/scripts/fetch-synth-saebench.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const REPO = "decoderesearch/synth-sae-bench-16k-v1-saes";
const SUBJECT = "decoderesearch/synth-sae-bench-16k-v1";
const EVAL = "synth-sae-bench-16k";
const OUT = join(
  ROOT,
  "data",
  "extracted",
  "methods",
  "synth-sae-bench-16k-v1.json",
);
const seed = JSON.parse(
  readFileSync(
    join(ROOT, "data", "seed", "methods", "sparse-autoencoders.json"),
    "utf8",
  ),
);

// Seed eval metric: key in `stats.json`.
const METRICS = {
  mcc: "mcc",
  f1_score: "f1_score",
  precision: "precision",
  recall: "recall",
  explained_variance: "explained_variance",
  l0: "l0",
  dead_latents: "dead_latents",
  shrinkage: "shrinkage",
  uniqueness: "uniqueness",
};

// The settings in the training config that set the L0. One of them must equal the folder's target.
const TARGETS = ["k", "max_iterations", "autotune_target_l0"];
// Training settings of some architectures only: the key in `runner_config.json` `sae`, then the param.
const SETTINGS = {
  aux_loss_coefficient: "auxLossCoefficient",
  l1_coefficient: "l1Coefficient",
  l1_warm_up_steps: "l1WarmUpSteps",
  jumprelu_bandwidth: "jumpreluBandwidth",
  jumprelu_init_threshold: "jumpreluInitThreshold",
  l0_coefficient: "l0Coefficient",
  residual_threshold: "residualThreshold",
};

const variantByAlias = new Map(
  seed.variants.flatMap((v) => v.aliases.map((a) => [a, v])),
);

async function get(url, as = "json") {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { redirect: "follow" });
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return as === "json" ? res.json() : res;
  }
}

/** Runs `fn` on each item with `n` at a time. */
async function pool(items, n, fn) {
  const out = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

const info = await get(`https://huggingface.co/api/models/${REPO}`);
const revision = info.sha;
const CACHE = join(ROOT, "data", "cache", "synth-saebench", revision);
console.log(`${REPO} @ ${revision}`);

// One folder for each SAE: <architecture>/l0-<n>/seed-<s>.
const folders = [
  ...new Set(
    info.siblings
      .map((s) => s.rfilename)
      .filter((f) => f.endsWith("/stats.json"))
      .map((f) => dirname(f)),
  ),
];
console.log(`${folders.length} SAEs`);

async function cached(path) {
  const local = join(CACHE, path);
  if (!existsSync(local)) {
    const res = await get(
      `https://huggingface.co/${REPO}/resolve/${revision}/${path}`,
      "raw",
    );
    mkdirSync(dirname(local), { recursive: true });
    writeFileSync(local, await res.text());
  }
  return JSON.parse(readFileSync(local, "utf8"));
}

const unknown = new Set();
const loaded = await pool(folders, 16, async (folder) => {
  const m = folder.match(/^([a-z_]+)\/l0-(\d+)\/seed-(\d+)$/);
  if (!m) throw new Error(`Unexpected folder ${folder}`);
  const [, token, targetL0, seedNo] = m;
  const [stats, runner] = await Promise.all([
    cached(`${folder}/stats.json`),
    cached(`${folder}/runner_config.json`),
  ]);
  return {
    folder,
    token,
    targetL0: Number(targetL0),
    seed: Number(seedNo),
    stats,
    runner,
  };
});

const artifacts = [];
for (const x of loaded) {
  const variant = variantByAlias.get(x.token);
  if (!variant) {
    unknown.add(x.token);
    continue;
  }
  const sae = x.runner.sae;
  if (!TARGETS.some((k) => sae[k] === x.targetL0))
    throw new Error(
      `${x.folder}: no setting in ${TARGETS.join(", ")} is ${x.targetL0}`,
    );
  // JumpReLU's `stats.json` has no width or sample count: they come from the training config.
  if (x.stats.width !== undefined && sae.d_sae !== x.stats.width)
    throw new Error(`${x.folder}: width ${x.stats.width}, d_sae ${sae.d_sae}`);
  const metrics = {};
  for (const [k, path] of Object.entries(METRICS)) {
    const v = x.stats[path];
    if (typeof v !== "number" || !Number.isFinite(v))
      throw new Error(`${x.folder}: no number for ${path}`);
    metrics[k] = v;
  }
  artifacts.push({
    key: `synth-16k-v1/${variant.slug}/l0-${x.targetL0}/seed-${x.seed}`,
    method: seed.method.slug,
    variant: variant.slug,
    displayName: `${variant.displayName}, L0 ${x.targetL0}, seed ${x.seed}`,
    subject: SUBJECT,
    sites: [],
    params: {
      width: sae.d_sae,
      targetL0: x.targetL0,
      seed: x.seed,
      trainingSamples: x.runner.training_samples,
      dtype: sae.dtype,
      normalizeActivations: sae.normalize_activations,
      batchSize: x.runner.batch_size,
      learningRate: x.runner.lr,
      lrSchedule: x.runner.lr_scheduler_name,
      decoderInitNorm: sae.decoder_init_norm,
      l0Autotune: sae.autotune_target_l0 !== undefined,
      ...(sae.matryoshka_widths && {
        matryoshkaWidths: sae.matryoshka_widths.join(", "),
      }),
      ...Object.fromEntries(
        Object.entries(SETTINGS).flatMap(([from, to]) =>
          sae[from] == null ? [] : [[to, sae[from]]],
        ),
      ),
    },
    license: "mit",
    sourceUrl: `https://huggingface.co/${REPO}/tree/${revision}/${x.folder}`,
    results: [
      {
        eval: EVAL,
        sourceUrl: `https://huggingface.co/${REPO}/blob/${revision}/${x.folder}/stats.json`,
        metrics,
      },
    ],
  });
}
if (unknown.size)
  throw new Error(`No variant has these aliases: ${[...unknown].join(", ")}`);

artifacts.sort((a, b) => a.key.localeCompare(b.key, "en", { numeric: true }));
const header = JSON.stringify({ model: REPO, revision, license: "mit" });
writeFileSync(
  OUT,
  `{"source":${header},"artifacts":[\n${artifacts.map((a) => JSON.stringify(a)).join(",\n")}\n]}\n`,
);

console.log(`Wrote ${OUT}: ${artifacts.length} artifacts`);
for (const v of [...new Set(artifacts.map((a) => a.variant))]) {
  const mine = artifacts.filter((a) => a.variant === v);
  const l0s = [...new Set(mine.map((a) => a.params.targetL0))];
  console.log(`  ${v}: ${mine.length} (target L0 ${l0s.join(", ")})`);
}
