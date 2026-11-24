// Reads our Workspace Lens Readout and Workspace Probe Swap runs and writes
// data/extracted/methods/openaudit-lens-readout.json: one artifact for each lens and subject model.
//   Readout 2026-10.1: the eval_ranks CSVs that data/scripts/rlens-fit/fit-rlens.sh writes. They
//     have only the items that pass the correctness filter and are not in the J++ fit split.
//   Readout 2026-10.2: the sample files that data/scripts/rlens-fit/readout_samples.py writes. All
//     items count, except the J++ fit split.
//   Readout 2026-10.3: as 2026-10.2, from the sample files of --strip-word-answers.
//   Probe Swap 2026-11: the success tables that data/scripts/rlens-fit/probe_swap.py writes, with
//     --strip-word-answers.
//   WorkspaceBench 2026-11: the judge results in data/cache/workspacebench/judge/ (Qwen3.6-27B
//     only; workspacebench-logs.py has the run). A family's metric is the harness's family score;
//     macro_score is their mean. The Oracle Lens has only WorkspaceBench results.
//   WorkspaceBench 6be6304-fast-safety: the results.json of each lens's run
//     (evals/workspacebench/run.py), in data/cache/workspacebench/6be6304-fast-safety/<lens>/;
//     workspacebench-fast-logs.py has the run. The metrics are the run's, macro_score included.
//
// A rank is of one hidden token of one item at one layer. Recall@k uses each model's seven readout
// layers: per item, the best rank of each hidden token over those layers, then the share of hidden
// tokens with rank <= k, the mean over the item's tokens, then over the task's items. The macro is
// the mean over the tasks that have items.
//   node data/scripts/fetch-openaudit-lens-readout.mjs [dir with the CSVs; default ~/rlens-fits/eval]
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const IN = process.argv[2] ?? join(homedir(), "rlens-fits", "eval");
const OUT = join(
  ROOT,
  "data",
  "extracted",
  "methods",
  "openaudit-lens-readout.json",
);
const CACHE = join(ROOT, "data", "cache", "openaudit-lens-readout");
const SAMPLES = join(
  ROOT,
  "data",
  "cache",
  "workspace-lens-readout",
  "samples",
);
const STRIP_SAMPLES = join(
  ROOT,
  "data",
  "cache",
  "workspace-lens-readout",
  "samples-strip",
);
const SWAPS = join(ROOT, "data", "cache", "workspace-lens-probe-swap");
const EVAL = "workspace-lens-readout";
const VERSION = "2026-10.1";
const NO_FILTER = "2026-10.2";
const STRIP = "2026-10.3";
const SWAP_EVAL = "workspace-probe-swap";
const SWAP_VERSION = "2026-11";
const WSB = join(ROOT, "data", "cache", "workspacebench", "judge");
const WSB_EVAL = "workspacebench";
const WSB_VERSION = "2026-11";
const WSB_SUBJECT = "Qwen/Qwen3.6-27B";
const WSB_RUNNER =
  "https://github.com/decoderesearch/openaudit/tree/main/data/scripts/workspacebench-logs.py";
const WSB_LAYERS = [20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60];
const WSB_FAST_VERSION = "6be6304-fast-safety";
const WSB_FAST = join(ROOT, "data", "cache", "workspacebench", WSB_FAST_VERSION);
const WSB_FAST_RUNNER =
  "https://github.com/decoderesearch/openaudit/tree/main/data/scripts/workspacebench-fast-logs.py";
const WSB_FAMILIES = [
  "multihop",
  "multilingual_multihop",
  "relational_multihop",
  "poetry",
  "directed_modulation",
  "model_specific_directed_modulation",
  "multilingual_mt",
  "typo_mt",
  "multilingual_typo",
  "buggy_code",
];
// The harness's name of each lens that WorkspaceBench ran.
const WSB_LENS = {
  "jacobian-lens": "jlens",
  "jpp-lens": "jpp",
  "oracle-lens": "olens",
};
const OLENS =
  "https://huggingface.co/agu18dec/olens_and_ar/tree/74e9dcdceafa3f14c38e223b5217ca9db44b3cba/olens_s3d_rl600";
const METHOD = "workspace-lenses";
const RUNNER =
  "https://github.com/decoderesearch/openaudit/tree/main/data/scripts/rlens-fit";
const NP = "neuronpedia/jacobian-lens";
const NP_REV = "e166deb5ad540932100ef803c8c9bcc2a5453694";
// The jpp_lens fits (J++ and R-Lens) draw their prompts from this config (jlens/examples.py).
const JPP_WIKITEXT = "wikitext-103-raw-v1";
// Neuronpedia has no J-Lens for some models. For those, the eval uses Camila Blank's.
const CB = "camilablank/workspace-lenses";
const CB_REV = "d740106d1e0f95456dc8718fba2895e9c8ffd6ef";
const cbLens = (np, dir) => ({
  params: { fitPrompts: 25, fitData: "NeelNanda/pile-10k" },
  license: "MIT",
  sourceUrl: `https://huggingface.co/${CB}/tree/${CB_REV}/${np}/${dir}`,
});
const TASKS = ["association", "multihop", "multilingual", "poetry", "typo"];
const KS = [1, 10];

// The subject, its Neuronpedia id, its J-Lens file and its seven readout layers (the paper's).
const MODELS = [
  {
    subject: "Qwen/Qwen3.6-27B",
    np: "qwen3.6-27b",
    jlens: "Qwen3.6-27B_jacobian_lens_n1000",
    // This folder has no config.yaml. The file name and the folder give the fit.
    jlensFit: { fitPrompts: 1000, fitData: "Salesforce/wikitext" },
    layers: [8, 16, 24, 32, 40, 48, 56],
  },
  {
    subject: "google/gemma-4-31B",
    np: "gemma-4-31b",
    jlens: "gemma-4-31B_jacobian_lens",
    layers: [8, 15, 22, 30, 38, 45, 52],
  },
  {
    subject: "allenai/Olmo-3-1125-32B",
    np: "olmo-3-1125-32b",
    jlens: "Olmo-3-1125-32B_jacobian_lens",
    layers: [8, 16, 24, 32, 40, 48, 56],
  },
  {
    subject: "Qwen/Qwen3.5-9B",
    np: "qwen3.5-9b",
    jlens: "Qwen3.5-9B_cb_jlens_n25",
    cb: cbLens("qwen3.5-9b", "j-lens"),
    layers: [4, 8, 12, 16, 20, 24, 28],
  },
  {
    subject: "Qwen/Qwen3.5-122B-A10B",
    np: "qwen3.5-122b-a10b",
    jlens: "Qwen3.5-122B-A10B_cb_jlens_n25",
    cb: cbLens("qwen3.5-122b-a10b", "j-lens"),
    layers: [6, 12, 18, 24, 30, 36, 42],
  },
  {
    // We did not fit this R-Lens: the fit needs the bf16 model (about 570 GB).
    subject: "deepseek-ai/DeepSeek-V4-Flash",
    np: "deepseek-v4-flash",
    jlens: "DeepSeek-V4-Flash_cb_jlens_n25",
    cb: cbLens("deepseek-v4-flash", "j-lens"),
    cbRlens: cbLens("deepseek-v4-flash", "r-lens"),
    layers: [5, 11, 16, 22, 27, 32, 38],
  },
];
const NAMES = {
  "logit-lens": "Logit Lens",
  "jacobian-lens": "J-Lens",
  "r-lens": "R-Lens",
  "jpp-lens": "J++ Lens",
  "oracle-lens": "Oracle Lens",
};

async function cached(name, url) {
  const local = join(CACHE, name);
  if (!existsSync(local)) {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    mkdirSync(dirname(local), { recursive: true });
    writeFileSync(local, await res.text());
  }
  return readFileSync(local, "utf8");
}

/** The fit params in a Neuronpedia config.yaml. `defaultConfig`: the dataset config, when the
 * file has none. */
function fitParams(yaml, where, defaultConfig) {
  // A J-Lens fit can stop early: prompts_fitted is the real count, n_prompts the plan.
  const n = Number(
    (yaml.match(/prompts_fitted: (\d+)/) ??
      yaml.match(/n_prompts: (\d+)/))?.[1],
  );
  const name = yaml.match(/dataset:\n\s+name: "([^"]+)"/)?.[1];
  const config =
    yaml.match(/dataset:\n\s+name: "[^"]+"\n\s+config: "([^"]+)"/)?.[1] ??
    defaultConfig;
  if (!n || !name) throw new Error(`${where}: no prompt count or dataset`);
  return { fitPrompts: n, fitData: config ? `${name} (${config})` : name };
}

/** The rows of a CSV with a header and no quoted commas. */
function csv(path) {
  const [head, ...lines] = readFileSync(path, "utf8").trim().split("\n");
  const cols = head.split(",");
  return lines.map((l) => {
    const cells = l.split(",");
    if (cells.length !== cols.length) throw new Error(`${path}: bad row ${l}`);
    return Object.fromEntries(cols.map((c, i) => [c, cells[i]]));
  });
}

/** The rank rows of a sample file, as in the CSVs, for all items not in the J++ fit split. */
function sampleRows(path) {
  const [head, ...lines] = gunzipSync(readFileSync(path))
    .toString("utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
  const layers = head.header.layers;
  const rows = [];
  for (const s of lines) {
    if (s.split === "fit") continue;
    for (const [lens, d] of Object.entries(s.lenses ?? {}))
      for (const [intermediate, ranks] of Object.entries(d.ranks))
        ranks.forEach((rank, i) =>
          rows.push({
            lens,
            eval: s.eval,
            item: s.item,
            intermediate,
            layer: layers[i],
            rank,
          }),
        );
  }
  return rows;
}

const sha256 = (path) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

/** `{lens: {task: {k: recall}}}` over `layers`. */
function recall(rows, layers) {
  const keep = new Set(layers);
  const best = new Map();
  for (const r of rows) {
    if (!keep.has(Number(r.layer))) continue;
    const key = [r.lens, r.eval, r.item, r.intermediate].join("\t");
    best.set(key, Math.min(best.get(key) ?? Infinity, Number(r.rank)));
  }
  const items = new Map();
  for (const [key, rank] of best) {
    const [lens, task, item] = key.split("\t");
    const k = [lens, task, item].join("\t");
    items.set(k, [...(items.get(k) ?? []), rank]);
  }
  const out = {};
  for (const [key, ranks] of items) {
    const [lens, task] = key.split("\t");
    for (const k of KS) {
      const hit = ranks.filter((r) => r <= k).length / ranks.length;
      (((out[lens] ??= {})[task] ??= {})[k] ??= []).push(hit);
    }
  }
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  for (const tasks of Object.values(out))
    for (const byK of Object.values(tasks))
      for (const k of KS) byK[k] = mean(byK[k]);
  return out;
}

const round = (x) => Math.round(x * 1000) / 1000;

/** The macro recall@k and recall@10 of each task, from `{task: {k: recall}}`. */
function metricsOf(byTask) {
  const tasks = TASKS.filter((t) => byTask[t]);
  const metrics = {};
  for (const k of KS)
    metrics[`recall_at_${k}`] = round(
      tasks.reduce((a, t) => a + byTask[t][k], 0) / tasks.length,
    );
  for (const t of tasks) metrics[`${t}_recall_at_10`] = round(byTask[t][10]);
  return metrics;
}

/** `{lens: metrics}` from a probe-swap success table, at each lens's best top-1 scale of the main
 * trials (ties go to the smaller scale), as the harness's `best_scale_rows`. */
const SWAP_PREFIX = [
  ["main", "swap_top1"],
  ["answer_swap", "answer_swap_top1"],
  ["random_null", "random_swap_top1"],
];

function swapMetrics(rows) {
  const at = (lens, variant, scale) =>
    rows.find(
      (r) =>
        r.lens === lens &&
        r.variant === variant &&
        Number(r.scale) === Number(scale),
    );
  const out = {};
  for (const lens of new Set(rows.map((r) => r.lens))) {
    const main = rows
      .filter((r) => r.lens === lens && r.variant === "main")
      .sort(
        (a, b) =>
          Number(b.top1_rate) - Number(a.top1_rate) ||
          Number(a.scale) - Number(b.scale),
      );
    const best = main[0];
    out[lens] = {
      swap_top1: round(Number(best.top1_rate)),
      swap_top5: round(Number(best.top5_rate)),
      answer_swap_top1: round(
        Number(at(lens, "answer_swap", best.scale).top1_rate),
      ),
      random_swap_top1: round(
        Number(at(lens, "random_null", best.scale).top1_rate),
      ),
    };
    // Each variant at each scale: the seed key is `<prefix>_scale_<0_5|1|2|4>`.
    for (const [variant, prefix] of SWAP_PREFIX)
      for (const r of rows.filter(
        (r) => r.lens === lens && r.variant === variant,
      ))
        out[lens][
          `${prefix}_scale_${String(Number(r.scale)).replace(".", "_")}`
        ] = round(Number(r.top1_rate));
  }
  return out;
}

const inputs = {};

/** The WorkspaceBench result of a variant on WSB_SUBJECT, or [] when it has none. */
function wsbResult(variant, subject) {
  const lens = WSB_LENS[variant];
  if (subject !== WSB_SUBJECT || !lens) return [];
  const metrics = {};
  let sum = 0;
  for (const fam of WSB_FAMILIES) {
    const path = join(WSB, lens, fam, "results.json");
    const res = JSON.parse(readFileSync(path, "utf8"));
    if (res.family !== fam || typeof res.numbers?.value !== "number")
      throw new Error(`${path}: no score for ${fam}`);
    inputs[`workspacebench/${lens}/${fam}/results.json`] = sha256(path);
    metrics[fam] = Math.round(res.numbers.value * 1000) / 1000;
    sum += res.numbers.value;
  }
  const macro = Math.round((sum / WSB_FAMILIES.length) * 1000) / 1000;
  return [
    ...wsbFastResult(lens),
    {
      eval: WSB_EVAL,
      version: WSB_VERSION,
      sourceUrl: WSB_RUNNER,
      metrics: { macro_score: macro, ...metrics },
    },
  ];
}

/** The fast WorkspaceBench result of a lens, or [] when its run is not in WSB_FAST. */
function wsbFastResult(lens) {
  const path = join(WSB_FAST, lens, "results.json");
  if (!existsSync(path)) return [];
  const run = JSON.parse(readFileSync(path, "utf8")).runs?.[WSB_SUBJECT];
  const res = run?.evals?.[WSB_EVAL];
  if (run?.partial || res?.version !== WSB_FAST_VERSION || res.failed?.length)
    throw new Error(`${path}: not a complete ${WSB_FAST_VERSION} run`);
  inputs[`workspacebench/${WSB_FAST_VERSION}/${lens}/results.json`] = sha256(path);
  const { macro_families: _, ...metrics } = res.metrics;
  return [
    {
      eval: WSB_EVAL,
      version: WSB_FAST_VERSION,
      sourceUrl: WSB_FAST_RUNNER,
      metrics,
    },
  ];
}

const out = [];
for (const m of MODELS) {
  const slug = m.subject.split("/")[1];
  // `evaluate all` writes one CSV; `ref` and `rlens` write one each.
  const all = join(IN, `${slug}_eval_ranks_all.csv`);
  const files = existsSync(all)
    ? [all]
    : (m.cbRlens ? ["ref"] : ["ref", "rlens"]).map((w) =>
        join(IN, `${slug}_eval_ranks_${w}.csv`),
      );
  for (const f of files) inputs[f.slice(IN.length + 1)] = sha256(f);
  const scores = recall(files.flatMap(csv), m.layers);
  const samples = join(SAMPLES, `${slug}_readout_samples.jsonl.gz`);
  inputs[`samples/${slug}_readout_samples.jsonl.gz`] = sha256(samples);
  const allScores = recall(sampleRows(samples), m.layers);
  const stripSamples = join(STRIP_SAMPLES, `${slug}_readout_samples.jsonl.gz`);
  inputs[`samples-strip/${slug}_readout_samples.jsonl.gz`] =
    sha256(stripSamples);
  const stripScores = recall(sampleRows(stripSamples), m.layers);
  const swapFile = join(SWAPS, m.np, `${slug}_probe_swap_success.csv`);
  const swaps = existsSync(swapFile) ? swapMetrics(csv(swapFile)) : {};
  if (existsSync(swapFile))
    inputs[`probe-swap/${slug}_probe_swap_success.csv`] = sha256(swapFile);

  const npDir = (method) => `${m.np}/${method}/Salesforce-wikitext`;
  const npConfig = (method) =>
    cached(
      `${NP_REV}/${npDir(method)}/config.yaml`,
      `https://huggingface.co/${NP}/resolve/${NP_REV}/${npDir(method)}/config.yaml`,
    );
  const npTree = (method) =>
    `https://huggingface.co/${NP}/tree/${NP_REV}/${npDir(method)}`;
  const ourConfig = m.cbRlens
    ? null
    : readFileSync(
        join(IN, "..", "np-export", npDir("rlens"), "config.yaml"),
        "utf8",
      );
  const lenses = {
    "logit-lens": { lens: "logit", params: {} },
    "jacobian-lens": m.cb
      ? {
          lens: m.jlens,
          params: m.cb.params,
          license: m.cb.license,
          sourceUrl: m.cb.sourceUrl,
        }
      : {
          lens: m.jlens,
          params:
            m.jlensFit ?? fitParams(await npConfig("jlens"), npDir("jlens")),
          license: "Apache-2.0",
          sourceUrl: npTree("jlens"),
        },
    "jpp-lens": {
      lens: `${slug}_jpp_lens`,
      params: fitParams(await npConfig("jpp"), npDir("jpp"), JPP_WIKITEXT),
      license: "Apache-2.0",
      sourceUrl: npTree("jpp"),
    },
    "r-lens": m.cbRlens
      ? { lens: `${slug}_cb_rlens_n25`, ...m.cbRlens }
      : {
          lens: `${slug}_rlens`,
          params: fitParams(ourConfig, npDir("rlens"), JPP_WIKITEXT),
        },
  };
  for (const [variant, l] of Object.entries(lenses)) {
    if (!scores[l.lens] || !allScores[l.lens] || !stripScores[l.lens])
      throw new Error(`${slug}: no ranks for ${l.lens}`);
    out.push({
      key: `openaudit-2026-10/${variant}/${m.subject.toLowerCase()}`,
      method: METHOD,
      variant,
      displayName: `${NAMES[variant]}, ${slug} (OpenAudit run)`,
      subject: m.subject,
      sites: [{ role: "read", source: `layers ${m.layers.join(", ")}` }],
      params: { resultsBy: "OpenAudit", ...l.params },
      ...(l.license && { license: l.license }),
      ...(l.sourceUrl && { sourceUrl: l.sourceUrl }),
      results: [
        {
          eval: EVAL,
          version: STRIP,
          sourceUrl: RUNNER,
          metrics: metricsOf(stripScores[l.lens]),
        },
        {
          eval: EVAL,
          version: NO_FILTER,
          sourceUrl: RUNNER,
          metrics: metricsOf(allScores[l.lens]),
        },
        {
          eval: EVAL,
          version: VERSION,
          sourceUrl: RUNNER,
          metrics: metricsOf(scores[l.lens]),
        },
        ...(swaps[l.lens]
          ? [
              {
                eval: SWAP_EVAL,
                version: SWAP_VERSION,
                sourceUrl: RUNNER,
                metrics: swaps[l.lens],
              },
            ]
          : []),
        ...wsbResult(variant, m.subject),
      ],
    });
  }
}
// The Oracle Lens reads at the WorkspaceBench layers, not at the readout layers.
out.push({
  key: `openaudit-2026-10/oracle-lens/${WSB_SUBJECT.toLowerCase()}`,
  method: METHOD,
  variant: "oracle-lens",
  displayName: `${NAMES["oracle-lens"]}, ${WSB_SUBJECT.split("/")[1]} (OpenAudit run)`,
  subject: WSB_SUBJECT,
  sites: [{ role: "read", source: `layers ${WSB_LAYERS.join(", ")}` }],
  params: { resultsBy: "OpenAudit" },
  license: "Apache-2.0",
  sourceUrl: OLENS,
  results: wsbResult("oracle-lens", WSB_SUBJECT),
});

out.sort((a, b) => a.key.localeCompare(b.key));
const header = JSON.stringify({
  runner: RUNNER,
  harness:
    "https://github.com/safety-research/jpp_lens/tree/d7efc0de372e20589e899188c0cfe8434acc63ec",
  neuronpedia: `https://huggingface.co/${NP}@${NP_REV}`,
  inputs,
});
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  `{"source":${header},"artifacts":[\n${out.map((a) => JSON.stringify(a)).join(",\n")}\n]}\n`,
);
console.log(`Wrote ${OUT}: ${out.length} artifacts`);
for (const a of out)
  console.log(
    `  ${a.displayName}: ${a.results.map((r) => `${r.eval === WSB_EVAL ? "WSB " : ""}${r.version} ${r.metrics.recall_at_10 ?? r.metrics.swap_top1 ?? r.metrics.macro_score}`).join(", ")} (${a.params.fitPrompts ?? "-"} prompts)`,
  );
