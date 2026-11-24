// Reads the SAEBench result files (Hugging Face dataset adamkarvonen/sae_bench_results_0125) and
// writes data/extracted/methods/saebench-0125.json: one line for each SAE, with its site, settings
// and the headline metrics of each eval. Training checkpoints are skipped. Raw files are cached in
// data/cache/saebench/<revision>/. Variants come from the aliases in data/seed/methods/.
//   node data/scripts/fetch-saebench.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const REPO = "adamkarvonen/sae_bench_results_0125";
const OUT = join(ROOT, "data", "extracted", "methods", "saebench-0125.json");
const seed = JSON.parse(
  readFileSync(
    join(ROOT, "data", "seed", "methods", "sparse-autoencoders.json"),
    "utf8",
  ),
);

// Eval folder: the seed eval and its metrics (key: path in `eval_result_metrics`).
const EVALS = {
  core: {
    slug: "sae-bench-core",
    metrics: {
      ce_loss_score: "model_performance_preservation.ce_loss_score",
      l0: "sparsity.l0",
      kl_div_score: "model_behavior_preservation.kl_div_score",
      explained_variance: "reconstruction_quality.explained_variance",
      frac_alive: "misc_metrics.frac_alive",
    },
  },
  absorption: {
    slug: "sae-bench-absorption",
    metrics: {
      mean_absorption_fraction_score: "mean.mean_absorption_fraction_score",
      mean_full_absorption_score: "mean.mean_full_absorption_score",
      mean_num_split_features: "mean.mean_num_split_features",
    },
  },
  sparse_probing: {
    slug: "sae-bench-sparse-probing",
    metrics: {
      sae_top_1_test_accuracy: "sae.sae_top_1_test_accuracy",
      sae_top_5_test_accuracy: "sae.sae_top_5_test_accuracy",
      sae_test_accuracy: "sae.sae_test_accuracy",
      llm_top_1_test_accuracy: "llm.llm_top_1_test_accuracy",
      llm_test_accuracy: "llm.llm_test_accuracy",
    },
  },
  scr: {
    slug: "sae-bench-scr",
    metrics: {
      scr_k20: "scr_metrics.scr_metric_threshold_20",
      scr_k5: "scr_metrics.scr_metric_threshold_5",
      scr_k50: "scr_metrics.scr_metric_threshold_50",
    },
  },
  tpp: {
    slug: "sae-bench-tpp",
    metrics: {
      tpp_k20: "tpp_metrics.tpp_threshold_20_total_metric",
      tpp_k5: "tpp_metrics.tpp_threshold_5_total_metric",
      tpp_k50: "tpp_metrics.tpp_threshold_50_total_metric",
    },
  },
  ravel: {
    slug: "sae-bench-ravel",
    metrics: {
      disentanglement_score: "ravel.disentanglement_score",
      cause_score: "ravel.cause_score",
      isolation_score: "ravel.isolation_score",
    },
  },
  unlearning: {
    slug: "sae-bench-unlearning",
    metrics: { unlearning_score: "unlearning.unlearning_score" },
  },
  autointerp: {
    slug: "sae-bench-autointerp",
    metrics: { autointerp_score: "autointerp.autointerp_score" },
  },
};

// The model name in the files: its Hub name and its layer.
const MODELS = {
  "gemma-2-2b": { subject: "google/gemma-2-2b", layer: 12 },
  "pythia-160m-deduped": { subject: "EleutherAI/pythia-160m-deduped", layer: 8 },
};

// Settings from `sae_cfg_dict`, by method param key.
const PARAMS = {
  contextSize: "context_size",
  dtype: "dtype",
  normalizeActivations: "normalize_activations",
  prependBos: "prepend_bos",
};

// TransformerLens residual hooks as interp-engine addresses (`tlens_hook_to_point`).
const RESID = { hook_resid_pre: "resid_pre", hook_resid_mid: "resid_mid", hook_resid_post: "resid_post" };
function site(hook) {
  const m = hook.match(/^blocks\.(\d+)\.(hook_resid_(?:pre|mid|post))$/);
  if (!m) throw new Error(`No address for hook ${hook}`);
  return { address: `${RESID[m[2]]}.${m[1]}`, role: "read", source: hook };
}

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

const tree = (repo, path, kind = "datasets", rev = revision) =>
  get(
    `https://huggingface.co/api/${kind}/${repo}/tree/${rev}/${path}`.replace(
      /\/$/,
      "",
    ),
  );

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

const pick = (metrics, path) =>
  path.split(".").reduce((o, k) => o?.[k], metrics);

// The files write -1 for the KL metrics that they did not compute (all Pythia files).
const NOT_COMPUTED = {
  kl_div_score: (m) => m.model_behavior_preservation?.kl_div_with_sae === -1,
};
const widthLabel = (d) => (d >= 1024 ? `${Math.round(d / 1024)}k` : String(d));

const revision = (await get(`https://huggingface.co/api/datasets/${REPO}`)).sha;
const CACHE = join(ROOT, "data", "cache", "saebench", revision);
console.log(`${REPO} @ ${revision}`);

// Paths of the final result files, by eval folder.
const files = [];
for (const folder of Object.keys(EVALS)) {
  const dirs = (await tree(REPO, folder))
    .filter((x) => x.type === "directory")
    .map((x) => x.path);
  for (const dir of dirs) {
    for (const f of await tree(REPO, dir)) {
      if (
        f.type === "file" &&
        f.path.endsWith(".json") &&
        !f.path.includes("checkpoints")
      )
        files.push({ folder, path: f.path });
    }
  }
}
console.log(`${files.length} result files`);

const loaded = await pool(files, 16, async (f) => {
  const local = join(CACHE, f.path);
  if (!existsSync(local)) {
    const res = await get(
      `https://huggingface.co/datasets/${REPO}/resolve/${revision}/${f.path}`,
      "raw",
    );
    mkdirSync(dirname(local), { recursive: true });
    writeFileSync(local, await res.text());
  }
  return { ...f, data: JSON.parse(readFileSync(local, "utf8")) };
});

// Weight folders on the Hub, for the repos that are public.
const weightFolders = new Map();
async function weightsUrl(model, width, token, layer, trainer) {
  const repo = `adamkarvonen/saebench_${model}_width-2pow${Math.log2(width)}_date-0108`;
  if (!weightFolders.has(repo)) {
    const listed = await tree(repo, "", "models", "main").catch(() => []);
    weightFolders.set(
      repo,
      new Set(listed.filter((x) => x.type === "directory").map((x) => x.path)),
    );
  }
  const folder = `${token}_${model}__0108`;
  return weightFolders.get(repo).has(folder)
    ? `https://huggingface.co/${repo}/tree/main/${folder}/resid_post_layer_${layer}/trainer_${trainer}`
    : undefined;
}

const artifacts = new Map();
const unknown = new Set();
for (const f of loaded) {
  const name = f.path.split("/").pop();
  const cfg = f.data.sae_cfg_dict;
  const model = MODELS[cfg.model_name];
  if (!model)
    throw new Error(`${f.path}: model ${cfg.model_name} is not in MODELS`);
  if (cfg.hook_layer !== model.layer)
    throw new Error(
      `${f.path}: layer ${cfg.hook_layer}, expected ${model.layer}`,
    );
  const baseline = name.match(
    /_layer_\d+_(identity_sae|pca_sae|mdas)_custom_sae_/,
  )?.[1];
  const token = baseline ?? name.match(/_date-0108_([A-Za-z]+)_/)?.[1];
  const method = variantByAlias.get(token);
  if (!method) {
    unknown.add(token ?? name);
    continue;
  }
  const trainer = baseline
    ? undefined
    : Number(name.match(/_trainer_(\d+)_/)?.[1]);
  const key = baseline
    ? `${cfg.model_name}/l${model.layer}/${method.slug}`
    : `${cfg.model_name}/l${model.layer}/w${widthLabel(cfg.d_sae)}/${method.slug}/trainer-${trainer}`;
  let a = artifacts.get(key);
  if (!a) {
    a = {
      key,
      method: seed.method.slug,
      variant: method.slug,
      displayName: baseline
        ? method.displayName
        : `${method.displayName}, ${widthLabel(cfg.d_sae)}, trainer ${trainer}`,
      subject: model.subject,
      sites: [site(cfg.hook_name)],
      // A baseline file has a placeholder config.
      params: {
        ...(baseline === "mdas" ? {} : { width: cfg.d_sae }),
        ...(cfg.training_tokens ? { trainingTokens: cfg.training_tokens } : {}),
        ...(baseline
          ? {}
          : Object.fromEntries(
              Object.entries(PARAMS)
                .filter(([, k]) => cfg[k] != null)
                .map(([p, k]) => [p, cfg[k]]),
            )),
      },
      ...(baseline
        ? {}
        : {
            sourceUrl: await weightsUrl(
              cfg.model_name,
              cfg.d_sae,
              token,
              model.layer,
              trainer,
            ),
          }),
      results: [],
    };
    if (!a.sourceUrl) delete a.sourceUrl;
    artifacts.set(key, a);
  }
  const ev = EVALS[f.folder];
  if (a.results.some((r) => r.eval === ev.slug))
    throw new Error(`${key}: two ${f.folder} files (${f.path})`);
  const metrics = {};
  for (const [k, path] of Object.entries(ev.metrics)) {
    if (NOT_COMPUTED[k]?.(f.data.eval_result_metrics)) continue;
    const v = pick(f.data.eval_result_metrics, path);
    if (typeof v === "number" && Number.isFinite(v)) metrics[k] = v;
  }
  a.results.push({
    eval: ev.slug,
    sourceUrl: `https://huggingface.co/datasets/${REPO}/blob/${revision}/${f.path}`,
    commit: f.data.sae_bench_commit_hash,
    measuredAt: new Date(f.data.datetime_epoch_millis).toISOString(),
    metrics,
  });
}
if (unknown.size)
  throw new Error(`No method has these aliases: ${[...unknown].join(", ")}`);

const list = [...artifacts.values()].sort((a, b) =>
  a.key.localeCompare(b.key, "en", { numeric: true }),
);
for (const a of list) a.results.sort((x, y) => x.eval.localeCompare(y.eval));
const header = JSON.stringify({ dataset: REPO, revision, license: "mit" });
writeFileSync(
  OUT,
  `{"source":${header},"artifacts":[\n${list.map((a) => JSON.stringify(a)).join(",\n")}\n]}\n`,
);

const count = (pred) => list.filter(pred).length;
console.log(
  `Wrote ${OUT}: ${list.length} artifacts, ${list.reduce((n, a) => n + a.results.length, 0)} eval results`,
);
for (const slug of Object.values(EVALS).map((e) => e.slug)) {
  console.log(
    `  ${slug}: ${count((a) => a.results.some((r) => r.eval === slug))} artifacts`,
  );
}
console.log(`  with weights links: ${count((a) => a.sourceUrl)}`);
