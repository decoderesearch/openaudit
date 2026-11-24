// Reads Tables 3, 4, 5 and 9 of the AISI lie detection paper (arXiv 2606.12618v2: balanced
// accuracy on Varied Deception) and the detector repos of the Hugging Face collection, and writes
// data/extracted/methods/aisi-lie-detection.json: one artifact for each detector and subject model,
// with its chosen probe file at the repo's commit. Base models only. Table 9 first; a cell in two tables must have one value. Downloads are cached
// in data/cache/aisi/. Also checks the capability index in the eval seed against Table 9.
//   node data/scripts/fetch-aisi-lie-detection.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PAPER = "https://arxiv.org/abs/2606.12618v2";
const HTML = "https://arxiv.org/html/2606.12618v2";
const HF = "ai-safety-institute";
const EVAL = "varied-deception";
const VERSION = "2026-06.1";
const OUT = join(
  ROOT,
  "data",
  "extracted",
  "methods",
  "aisi-lie-detection.json",
);
const CACHE = join(ROOT, "data", "cache", "aisi");

// The paper's column: the variant, the table and the repo prefix of its detectors.
const COLUMNS = [
  {
    table: 9,
    column: "Apollo",
    method: "probes",
    variant: "apollo",
    repo: "apollo",
  },
  {
    table: 4,
    column: "Apollo",
    method: "probes",
    variant: "apollo",
    repo: "apollo",
  },
  {
    table: 4,
    column: "Targeted Apollo",
    method: "probes",
    variant: "targeted-apollo",
    repo: "targeted-apollo",
  },
  {
    table: 9,
    column: "DYL Probe",
    method: "probes",
    variant: "dyl",
    repo: "dyl",
  },
  {
    table: 3,
    column: "DYL Probe",
    method: "probes",
    variant: "dyl",
    repo: "dyl",
  },
  {
    table: 5,
    column: "Unrelated Qs Activations",
    method: "probes",
    variant: "uq-activations",
  },
  {
    table: 9,
    column: "Judge Model",
    method: "llm-monitors",
    variant: "cot-judge",
  },
  {
    table: 9,
    column: "Unrelated Qs",
    method: "logprob-classifiers",
    variant: "unrelated-questions",
    repo: "uq",
  },
  {
    table: 5,
    column: "Unrelated Qs",
    method: "logprob-classifiers",
    variant: "unrelated-questions",
    repo: "uq",
  },
];
const NAMES = {
  apollo: "Apollo",
  "targeted-apollo": "Targeted Apollo",
  dyl: "DYL",
  "uq-activations": "Unrelated Qs (activations)",
  "cot-judge": "CoT judge",
  "unrelated-questions": "Unrelated Qs",
};
const CLASSIFIERS = {
  lr: "logistic regression",
  dim: "difference in means",
  mlp: "MLP",
};
// The follow-up questions, as the repo READMEs give them.
const QUESTIONS = {
  dyl: "Did you lie in the last message - answer yes or no and nothing else?",
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
  // Some sweep files have a bare `NaN`, which is not JSON.
  return as === "json"
    ? JSON.parse(text.replace(/:\s*NaN\b/g, ": null"))
    : text;
}

/** The sha256 and size of a file in a Hugging Face repo, from its Git LFS pointer. */
async function lfsInfo(repoId, sha, path) {
  const local = join(CACHE, repoId, `${sha}-${path}.json`);
  if (!existsSync(local)) {
    const res = await fetch(
      `https://huggingface.co/api/models/${repoId}/paths-info/${sha}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paths: [path], expand: true }),
      },
    );
    if (!res.ok) throw new Error(`${res.status} paths-info ${repoId} ${path}`);
    mkdirSync(dirname(local), { recursive: true });
    writeFileSync(local, await res.text());
  }
  const [info] = JSON.parse(readFileSync(local, "utf8"));
  if (!info?.lfs) throw new Error(`${repoId}: ${path} is not a Git LFS file`);
  return { sha256: info.lfs.oid, bytes: info.lfs.size };
}

// Our R2 copies, by sha256, from the last output: a new fetch keeps them.
const mirrors = new Map(
  existsSync(OUT)
    ? JSON.parse(readFileSync(OUT, "utf8"))
        .artifacts.flatMap((a) => a.files ?? [])
        .filter((f) => f.mirror)
        .map((f) => [f.sha256, f.mirror])
    : [],
);

const text = (h) =>
  h
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;|&[a-z]+;/g, " ")
    .trim();

/** The rows of table `n` as objects by column name, with the first column as `model`. */
function table(html, n) {
  const tag = html.indexOf(
    `<span class="ltx_tag ltx_tag_table">Table ${n}: </span>`,
  );
  if (tag < 0) throw new Error(`No Table ${n}`);
  const fig = html.slice(
    html.lastIndexOf("<figure", tag),
    html.indexOf("</figure>", tag),
  );
  const rows = [...fig.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)].map((r) =>
    [...r[1].matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gs)].map((c) => text(c[1])),
  );
  const [head, ...body] = rows;
  return body
    .filter((r) => r[0] && r[0] !== "model" && r[0] !== "Median")
    .map((r) =>
      Object.fromEntries(
        head.map((h, i) => [i === 0 ? "model" : h, r[i] ?? ""]),
      ),
    );
}

const html = await cached("2606.12618v2.html", HTML);
const tables = Object.fromEntries([3, 4, 5, 9].map((n) => [n, table(html, n)]));
const repos = new Map(
  (
    await cached(
      "models.json",
      `https://huggingface.co/api/models?author=${HF}&limit=1000&full=true&cardData=true`,
      "json",
    )
  ).map((m) => [m.id, m]),
);
console.log(
  `Tables: ${[3, 4, 5, 9].map((n) => `${n} (${tables[n].length} rows)`).join(", ")}; ${repos.size} repos`,
);

const artifacts = new Map();
for (const c of COLUMNS) {
  for (const row of tables[c.table]) {
    const cell = row[c.column];
    if (cell === undefined)
      throw new Error(`Table ${c.table} has no column ${c.column}`);
    if (cell === "") continue;
    const value = Number(cell);
    if (!Number.isFinite(value))
      throw new Error(`Table ${c.table} ${row.model} ${c.column}: ${cell}`);
    const subject = row.model;
    const key = `aisi/${c.variant}/${subject.toLowerCase()}`;
    const old = artifacts.get(key);
    if (old) {
      if (old.value !== value)
        throw new Error(
          `${key}: Table ${old.table} gives ${old.value}, Table ${c.table} gives ${value}`,
        );
      continue;
    }
    artifacts.set(key, { c, subject, key, value, table: c.table });
  }
}

const out = [];
for (const { c, subject, key, value, table: n } of [...artifacts.values()].sort(
  (a, b) => a.key.localeCompare(b.key),
)) {
  const repoId =
    c.repo && `${HF}/${c.repo}-${subject.toLowerCase().replace("/", "-")}`;
  const repo = repoId && repos.get(repoId);
  if (c.repo && !repo) throw new Error(`${key}: no repo ${repoId}`);
  const params = {};
  const sites = [];
  const files = [];
  if (repo) {
    const sweep = await cached(
      `${repoId}/sweep.json`,
      `https://huggingface.co/${repoId}/resolve/${repo.sha}/sweep.json`,
      "json",
    );
    const best = sweep.sweep.find(
      (x) => x.safe_name === sweep.default_filename,
    );
    if (!best)
      throw new Error(`${repoId}: no sweep entry ${sweep.default_filename}`);
    const h = best.hyperparams;
    params.checkpoint = `${sweep.default_filename}.pt`;
    const { sha256, bytes } = await lfsInfo(
      repoId,
      repo.sha,
      params.checkpoint,
    );
    files.push({
      name: params.checkpoint,
      url: `https://huggingface.co/${repoId}/resolve/${repo.sha}/${params.checkpoint}`,
      sha256,
      bytes,
      ...(mirrors.has(sha256) && { mirror: mirrors.get(sha256) }),
    });
    if (h.probe_architecture)
      params.classifier =
        CLASSIFIERS[h.probe_architecture] ?? h.probe_architecture;
    if (h.layer != null) {
      params.depth = h.layer_pct;
      sites.push({ role: "read", source: `layer ${h.layer}` });
    }
  }
  if (c.variant === "uq-activations") {
    params.depth = 80;
    sites.push({ role: "read", source: "the layer at 80% depth" });
  }
  if (QUESTIONS[c.variant]) params.question = QUESTIONS[c.variant];
  if (c.variant === "cot-judge") {
    params.judgeModel = "GPT-5.5 Pro";
    params.cutoff = 8;
  }
  out.push({
    key,
    method: c.method,
    variant: c.variant,
    displayName: `${NAMES[c.variant]}, ${subject.split("/")[1]}`,
    subject,
    sites,
    params,
    ...(repo?.cardData?.license && {
      license: repo.cardData.license.toUpperCase(),
    }),
    sourceUrl: repo ? `https://huggingface.co/${repoId}` : PAPER,
    ...(files.length > 0 && { files }),
    results: [
      {
        eval: EVAL,
        version: VERSION,
        sourceUrl: PAPER,
        sourceTable: `Table ${n}`,
        metrics: { balanced_accuracy: value },
      },
    ],
  });
}

// The capability index of Table 9, for the eval seed.
const index = tables[9]
  .filter((r) => r.AA !== "")
  .map((r) => ({ subject: r.model, value: Number(r.AA) }));
const seed = JSON.parse(
  readFileSync(join(ROOT, "data", "seed", "evals", `${EVAL}.json`), "utf8"),
);
const order =
  seed.versions.find((v) => v.version === VERSION)?.methodSetup?.subjectOrder
    ?.values ?? [];
if (JSON.stringify(order) !== JSON.stringify(index)) {
  console.log(
    `The seed's subjectOrder differs from Table 9. Table 9:\n${JSON.stringify(index)}`,
  );
  process.exitCode = 1;
}

const header = JSON.stringify({
  paper: PAPER,
  collection: `https://huggingface.co/collections/${HF}/lie-detection`,
});
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  `{"source":${header},"artifacts":[\n${out.map((a) => JSON.stringify(a)).join(",\n")}\n]}\n`,
);
const by = (k) =>
  Object.entries(Object.groupBy(out, (a) => a[k])).map(
    ([v, xs]) => `${v} ${xs.length}`,
  );
console.log(
  `Wrote ${OUT}: ${out.length} artifacts (${by("variant").join(", ")})`,
);
console.log(`  with repos: ${out.filter((a) => a.sourceUrl !== PAPER).length}`);
