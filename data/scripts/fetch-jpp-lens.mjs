// Reads Tables 1 and 3 of the J++ Lens paper (LessWrong nc9dHfcB22JdMzGbr: readout recall and
// intermediate swaps) and the lens repos on Hugging Face, and writes
// data/extracted/methods/jpp-lens.json: one artifact for each lens (Logit Lens, J-Lens, R-Lens,
// J++ Lens) and subject model. Table 1 gives recall@10 on six models; Table 3 gives more metrics
// on Qwen3.6-27B. The paper's "External Model Usage" section tells which J-Lens and R-Lens file
// each model used. Downloads are cached in data/cache/jpp-lens/.
//   node data/scripts/fetch-jpp-lens.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PAPER =
  "https://www.lesswrong.com/posts/nc9dHfcB22JdMzGbr/j-lens-jacobian-filtering-enables-more-faithful-workspace";
const POST_MD = "https://www.lesswrong.com/api/post/nc9dHfcB22JdMzGbr";
const EVAL = "workspace-lens-readout";
const VERSION = "2026-10";
const METHOD = "workspace-lenses";
const OUT = join(ROOT, "data", "extracted", "methods", "jpp-lens.json");
const CACHE = join(ROOT, "data", "cache", "jpp-lens");
const JPP = "koayon/jpp-lenses";
const NP = "neuronpedia/jacobian-lens";
const CB = "camilablank/workspace-lenses";
const LICENSES = { "apache-2.0": "Apache-2.0", mit: "MIT" };

// Where a lens came from: a repo folder, or the J++ authors' own fit. `same`: fitted with the J++
// data and budget. Without `same`, the paper does not give the fit data.
const own = (same = false) => ({ own: true, same });

// Table 1 column: the subject, its J++ folder, and the source of its J-Lens and R-Lens.
const MODELS = {
  "Qwen3.5 9B": {
    subject: "Qwen/Qwen3.5-9B",
    jpp: "qwen3.5-9b",
    "jacobian-lens": { repo: CB, dir: "qwen3.5-9b/j-lens" },
    "r-lens": { repo: CB, dir: "qwen3.5-9b/r-lens" },
  },
  "Qwen3.6 27B": {
    subject: "Qwen/Qwen3.6-27B",
    jpp: "qwen3.6-27b",
    "jacobian-lens": own(true),
    "r-lens": own(true),
  },
  "Gemma 4 31B": {
    subject: "google/gemma-4-31B",
    jpp: "gemma-4-31b",
    "jacobian-lens": { repo: NP, dir: "gemma-4-31b/jlens/Salesforce-wikitext" },
    "r-lens": own(),
  },
  "Olmo 3 32B": {
    subject: "allenai/Olmo-3-1125-32B",
    jpp: "olmo-3-1125-32b",
    "jacobian-lens": {
      repo: NP,
      dir: "olmo-3-1125-32b/jlens/Salesforce-wikitext",
    },
    "r-lens": own(),
  },
  "Qwen3.5 122B-A10B": {
    subject: "Qwen/Qwen3.5-122B-A10B",
    jpp: "qwen3.5-122b-a10b",
    "jacobian-lens": { repo: CB, dir: "qwen3.5-122b-a10b/j-lens" },
    "r-lens": { repo: CB, dir: "qwen3.5-122b-a10b/r-lens" },
  },
  "DeepSeek-V4-Flash (284B)": {
    subject: "deepseek-ai/DeepSeek-V4-Flash",
    jpp: "deepseek-v4-flash",
    "jacobian-lens": { repo: CB, dir: "deepseek-v4-flash/j-lens" },
    "r-lens": { repo: CB, dir: "deepseek-v4-flash/r-lens" },
  },
};
// The paper's row name: the variant slug.
const ROWS = {
  "Logit Lens": "logit-lens",
  "J-Lens": "jacobian-lens",
  "R-Lens": "r-lens",
  "J++ Lens": "jpp-lens",
};
const NAMES = Object.fromEntries(
  Object.entries(ROWS).map(([name, slug]) => [slug, name]),
);
// Table 3 column: the seed metric.
const TABLE3 = {
  a: { Macro: "recall_at_1", "Intermediate swap top-1 (%) ↑": "swap_top1" },
  b: {
    Multihop: "multihop_recall_at_10",
    Multilingual: "multilingual_recall_at_10",
    Typo: "typo_recall_at_10",
    Association: "association_recall_at_10",
    Poetry: "poetry_recall_at_10",
    Macro: "recall_at_10",
    "Intermediate swap top-5 (%) ↑": "swap_top5",
  },
};

async function cached(name, url, as = "text") {
  const local = join(CACHE, name);
  if (!existsSync(local)) {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    mkdirSync(dirname(local), { recursive: true });
    writeFileSync(local, await res.text());
  }
  const text = readFileSync(local, "utf8");
  return as === "json" ? JSON.parse(text) : text;
}

/** The rows of the Markdown table after `caption`, as cell lists (header rows included). */
function table(md, caption) {
  const start = md.indexOf(caption);
  if (start < 0) throw new Error(`No ${caption}`);
  const lines = md.slice(start).split("\n");
  const first = lines.findIndex((l) => l.startsWith("|"));
  const rows = [];
  for (const l of lines.slice(first)) {
    if (!l.startsWith("|")) break;
    if (/^\|\s*:?-/.test(l)) continue;
    rows.push(
      l
        .slice(1, -1)
        .split("|")
        .map((c) => c.replace(/\*\*/g, "").trim()),
    );
  }
  return rows;
}

/** The lens name in a row's first cell (`$\textcolor{...}{\textbf{J-Lens}}$`). */
const rowName = (cell) =>
  Object.keys(ROWS).find((n) => cell.includes(`{${n}`)) ?? null;

/** A percent cell as a fraction. */
function share(cell, where) {
  const v = Number(cell);
  if (!Number.isFinite(v)) throw new Error(`${where}: ${cell} is not a number`);
  return Math.round(v * 10) / 1000;
}

const md = await cached("post.md", POST_MD);

const t1 = table(md, "**Table 1.**");
const t1head = t1[1];
const recall10 = {};
for (const row of t1.slice(2)) {
  const variant = ROWS[rowName(row[0])];
  if (!variant) continue;
  for (const [col, m] of Object.entries(MODELS)) {
    const i = t1head.indexOf(col);
    if (i < 0) throw new Error(`Table 1 has no column ${col}`);
    recall10[`${variant}|${m.subject}`] = share(row[i], `Table 1 ${col}`);
  }
}

// Table 3 is for Qwen3.6-27B: its macro recall@10 must equal Table 1.
const QWEN = MODELS["Qwen3.6 27B"].subject;
const t3 = {};
for (const part of ["a", "b"]) {
  const rows = table(
    md,
    `\\(${part}\\) ${part === "a" ? "Strict" : "Lenient"}`,
  );
  const head = rows[1];
  for (const row of rows.slice(2)) {
    const variant = ROWS[rowName(row[0])];
    if (!variant) continue;
    for (const [col, metric] of Object.entries(TABLE3[part])) {
      const i = head.indexOf(col);
      if (i < 0) throw new Error(`Table 3${part} has no column ${col}`);
      (t3[variant] ??= {})[metric] = share(row[i], `Table 3${part} ${col}`);
    }
  }
}
for (const variant of Object.values(ROWS)) {
  const a = t3[variant]?.recall_at_10;
  const b = recall10[`${variant}|${QWEN}`];
  if (a === undefined || a !== b)
    throw new Error(`${variant}: Table 3 gives ${a}, Table 1 gives ${b}`);
  delete t3[variant].recall_at_10;
}

const repo = async (id) =>
  cached(`${id}/info.json`, `https://huggingface.co/api/models/${id}`, "json");
const file = async (id, sha, path) =>
  cached(
    `${id}/${sha}/${path}`,
    `https://huggingface.co/${id}/resolve/${sha}/${path}`,
  );
const [jpp, np, cb] = await Promise.all([repo(JPP), repo(NP), repo(CB)]);
const info = { [JPP]: jpp, [NP]: np, [CB]: cb };
const license = (id) => {
  const l = info[id].cardData?.license;
  if (!LICENSES[l]) throw new Error(`${id}: license ${l}`);
  return LICENSES[l];
};
const has = (id, dir) =>
  info[id].siblings.some((s) => s.rfilename.startsWith(`${dir}/`));

// J++ fit: "64 prompts, 128 tokens" on WikiText-103. Readout layers by model.
const jppReadme = await file(JPP, jpp.sha, "README.md");
const jppPrompts = Number(jppReadme.match(/(\d+) prompts, 128 tokens/)?.[1]);
if (!jppPrompts || !jppReadme.includes("WikiText-103"))
  throw new Error(`${JPP}: no fit prompts or data in README`);
const jppFit = { fitPrompts: jppPrompts, fitData: "WikiText-103" };
const layers = {};
for (const [, names, ls] of jppReadme.matchAll(
  /^\| ([^|]+) \| ((?:\d+, )+\d+) \|$/gm,
))
  for (const n of names.split(","))
    layers[n.trim().replace(/[-\s]/g, "").toLowerCase()] = ls;
const layersOf = (col) => {
  const k = col
    .replace(/ \(.*\)$/, "")
    .replace(/[-\s]/g, "")
    .toLowerCase();
  if (!layers[k]) throw new Error(`No readout layers for ${col}`);
  return [{ role: "read", source: `layers ${layers[k]}` }];
};

// Camila Blank's lenses: "n = 25 prompts from `NeelNanda/pile-10k`".
const cbReadme = await file(CB, cb.sha, "README.md");
const cbFit = cbReadme.match(/n = (\d+)(?:\*\*)? prompts from `([^`]+)`/);
if (!cbFit) throw new Error(`${CB}: no fit prompts in README`);

/** The params, weights URL and license of a lens from `src`. */
async function lensOf(src) {
  if (src.own) return { params: src.same ? jppFit : {}, sourceUrl: PAPER };
  if (!has(src.repo, src.dir)) throw new Error(`${src.repo}: no ${src.dir}`);
  const out = {
    sourceUrl: `https://huggingface.co/${src.repo}/tree/${info[src.repo].sha}/${src.dir}`,
    license: license(src.repo),
  };
  if (src.repo === JPP) return { ...out, params: jppFit };
  if (src.repo === CB)
    return {
      ...out,
      params: { fitPrompts: Number(cbFit[1]), fitData: cbFit[2] },
    };
  const config = await file(NP, np.sha, `${src.dir}/config.yaml`);
  const n = Number(config.match(/prompts_fitted: (\d+)/)?.[1]);
  const data = config.match(/name: "([^"]+)"\n\s+config: "([^"]+)"/);
  if (!n || !data) throw new Error(`${src.dir}: no prompts_fitted or dataset`);
  return {
    ...out,
    params: { fitPrompts: n, fitData: `${data[1]} (${data[2]})` },
  };
}

const out = [];
for (const [col, m] of Object.entries(MODELS)) {
  const short = m.subject.split("/")[1];
  for (const variant of Object.values(ROWS)) {
    const lens =
      variant === "logit-lens"
        ? { params: {} }
        : await lensOf(
            variant === "jpp-lens" ? { repo: JPP, dir: m.jpp } : m[variant],
          );
    const results = [
      {
        eval: EVAL,
        version: VERSION,
        sourceUrl: PAPER,
        sourceTable: "Table 1",
        metrics: { recall_at_10: recall10[`${variant}|${m.subject}`] },
      },
    ];
    if (m.subject === QWEN)
      results.push({
        eval: EVAL,
        version: VERSION,
        sourceUrl: PAPER,
        sourceTable: "Table 3",
        metrics: t3[variant],
      });
    out.push({
      key: `jpp-paper/${variant}/${m.subject.toLowerCase()}`,
      method: METHOD,
      variant,
      displayName: `${NAMES[variant]}, ${short}`,
      subject: m.subject,
      sites: layersOf(col),
      params: { resultsBy: "J++ authors", ...lens.params },
      ...(lens.license && { license: lens.license }),
      ...(lens.sourceUrl && { sourceUrl: lens.sourceUrl }),
      results,
    });
  }
}

out.sort((a, b) => a.key.localeCompare(b.key));
const header = JSON.stringify({
  paper: PAPER,
  jppLenses: `https://huggingface.co/${JPP}@${jpp.sha}`,
  neuronpedia: `https://huggingface.co/${NP}@${np.sha}`,
  camilablank: `https://huggingface.co/${CB}@${cb.sha}`,
});
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  `{"source":${header},"artifacts":[\n${out.map((a) => JSON.stringify(a)).join(",\n")}\n]}\n`,
);
console.log(`Wrote ${OUT}: ${out.length} artifacts`);
for (const a of out)
  console.log(
    `  ${a.displayName}: ${a.results.map((r) => JSON.stringify(r.metrics)).join(" ")} (${a.params.fitPrompts ?? "-"} prompts)`,
  );
