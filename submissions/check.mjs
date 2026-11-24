// Checks the method variant submissions in submissions/<method>/<variant>/: the form of
// submission.json, the code in code/, and that results.json has a full harness run of each file. The rules of a method
// are in evals/<harness>/submission/rules.json. It does not check the scores: we run each file again
// before it goes on the site. Folders in submissions/evals/ are model evals: check-eval.mjs.
//   node submissions/check.mjs [folder ...]   (default: all submissions)
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { summaryErrors } from "./summary.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SHA256 = /^[0-9a-f]{64}$/;
// A file at one commit, so that the file we run is the file you ran.
const HF_FILE =
  /^https:\/\/huggingface\.co\/((datasets|spaces)\/)?[\w.-]+\/[\w.-]+\/(blob|resolve)\/[0-9a-f]{40}\/\S+$/;
const GITHUB_FILE =
  /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/blob\/[0-9a-f]{40}\/\S+$/;
const COMMIT = /^[0-9a-f]{40}$/;
const DATA_FILE = /\.(parquet|jsonl|json|csv)$/;
const PICKLE_FILE = /\.(pkl|pickle|joblib|dill)$/i;
// The template's commit and hash.
const PLACEHOLDER = /(^|\/)0{40,}(\/|$)/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MODEL_ID = /^[\w.-]+\/[\w.-]+$/;
const LINK_KINDS = [
  "paper",
  "repo",
  "dataset",
  "hf_benchmark",
  "leaderboard",
  "homepage",
  "blog",
];
const RECIPE_KEYS = [
  "summary",
  "fitData",
  "selection",
  "evalItemsUsed",
  "script",
  "compute",
];
// For a harness with `fit`: the recipe file that it fits on each model, and its data.
const FIT_KEYS = ["file", "trainData"];
const FILES = [
  "submission.json",
  "results.json",
  "README.md",
  "research-log.md",
];
const MAX_BYTES = 1_000_000;
// Code goes in the pull request, in code/, so that we review it there. Weights stay on Hugging Face.
const CODE_DIR = "code";
const CODE_URL = /\.py$/;
const CODE_PATH = /^code\/(?!.*\.\.)[\w./-]+$/;
const CODE_TEXT = [
  ".py",
  ".md",
  ".json",
  ".jsonl",
  ".csv",
  ".txt",
  ".toml",
  ".yaml",
  ".yml",
];
// The code runs in the harness's environment: it cannot add packages.
const PACKAGE_FILE =
  /(^|\/)(requirements[\w-]*\.txt|pyproject\.toml|setup\.py|[\w.-]+\.lock)$/;

/** Loaders that can run code from a data file (pickles). Each error text says what to use. */
const UNSAFE_LOADS = [
  [
    /torch\.load\((?![^)]*weights_only\s*=\s*True)/,
    "torch.load with no weights_only=True",
  ],
  [/\b(c?pickle|dill|joblib)\.loads?\(/, "a pickle load"],
  [/allow_pickle\s*=\s*True/, "allow_pickle=True"],
];

// Files with keys and passwords. Submitted code never needs them.
const CREDENTIALS =
  /(~|\$HOME|\$\{HOME\}|expanduser\(["']~)\/?\.(aws|ssh|netrc|git-credentials|docker|kube|config\/gh|wrangler|cloudflared|runpod|pypirc|npmrc)\b|\bid_(rsa|ed25519)\b|\.env\.local\b|huggingface\/(stored_)?tokens?\b|\bget_token\s*\(|\bHfFolder\b|\/proc\/[^"'\s]*\/environ\b/;

/** An error for code that reads files with keys or passwords. */
export function credentialReads(rel, text, errors) {
  if (CREDENTIALS.test(text)) {
    errors.push(
      `${rel}: it reads a file with keys or passwords (${text.match(CREDENTIALS)[0]}). Submitted code must not.`,
    );
  }
}

/** The errors and warnings of the Python file `rel`: code that can run what a file or a repo gives
 * it. `trust_remote_code` is a warning: it can be necessary for a dataset at a pinned revision. */
export function unsafeCode(rel, text, errors, warnings) {
  credentialReads(rel, text, errors);
  for (const [re, what] of UNSAFE_LOADS) {
    if (re.test(text)) {
      errors.push(
        `${rel}: ${what}. A submitted file can run code then: use safetensors, or torch.load(..., weights_only=True).`,
      );
    }
  }
  if (/trust_remote_code["']?\s*[:=]\s*True/.test(text)) {
    warnings.push(
      `${rel}: trust_remote_code=True runs code from the Hub. Pin the revision, and tell why in the README.`,
    );
  }
}

// Code that can send a key: we run it with only the keys that it needs (run-isolated.sh).
const ENV_READ = /\bos\.environ\b|\bgetenv\(/;
const NETWORK =
  /\b(urllib|requests|httpx|aiohttp|socket|http\.client|openai|anthropic)\b/;
const PROCESS =
  /\b(subprocess|os\.system|os\.popen|os\.exec\w*|os\.spawn\w*|pty\.spawn)\b/;

export const sha256Of = (path) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

/** The rules of each harness in evals/, by method slug: a method can have more than one harness.
 * Submit the other methods with the site's form. `models`: our leaderboard models. A file on
 * another model is good too, unless `anyModel` is false. `required`: the evals that each model
 * needs (default: all but `optional`). `unitMetrics: false`: metrics can be out of 0 to 1. `fit`: the harness
 * fits a recipe file on each model. `coreModels`: the models that we rank on. */
export const METHODS = {};
for (const harness of readdirSync(join(ROOT, "evals")).map((dir) =>
  join("evals", dir),
)) {
  const path = join(ROOT, harness, "submission", "rules.json");
  if (!existsSync(path)) continue;
  const rules = JSON.parse(readFileSync(path, "utf8"));
  for (const m of rules.methods ?? [rules.method]) {
    (METHODS[m] ??= []).push({ ...rules, harness });
  }
}

/** The rules of `method` for a results.json `schema`. With no match, its first harness. */
export function rulesOf(method, schema) {
  const all = METHODS[method];
  return all?.find((r) => r.results === schema) ?? all?.[0];
}

/** The rules of each harness, by folder name. */
const HARNESS_RULES = Object.fromEntries(
  Object.values(METHODS)
    .flat()
    .map((r) => [basename(r.harness), r]),
);

/** A new method: no harness lists it, and its folder has method.json. */
export const isNewMethod = (dir) =>
  !METHODS[basename(dir)] && existsSync(join(dir, "method.json"));

/** The rules for a submission: its method's harness, or for a new method, the harness that it
 * names (`harness`). The new method's params are also params. */
export function rulesFor(s, schema, methodDir) {
  if (!isNewMethod(methodDir)) return rulesOf(s.method, schema);
  const rules = HARNESS_RULES[s.harness];
  if (!rules) return undefined;
  const own = readJsonOr(join(methodDir, "method.json"))?.params ?? [];
  return {
    ...rules,
    params: [...rules.params, ...own.map((p) => p?.key).filter(isText)],
  };
}

function readJsonOr(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

const isText = (v) => typeof v === "string" && v.trim().length > 0;

function seedVariants(method) {
  const path = join(ROOT, "data", "seed", "methods", `${method}.json`);
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf8")).variants.map((v) => v.slug);
}

function readJson(path, errors) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    errors.push(`${basename(path)}: ${e.message}`);
    return null;
  }
}

/** `{ errors, warnings }` of one submission folder. */
export function checkSubmission(dir) {
  const errors = [];
  const warnings = [];
  const methodDir = basename(dirname(dir));
  const variantDir = basename(dir);

  for (const name of readdirSync(dir)) {
    if (name === CODE_DIR && statSync(join(dir, name)).isDirectory()) {
      checkCode(dir, errors, warnings);
    } else if (!FILES.includes(name)) {
      errors.push(
        `${name}: not one of ${FILES.join(", ")} or ${CODE_DIR}/. Put weights and other large files on Hugging Face.`,
      );
    } else if (statSync(join(dir, name)).size > MAX_BYTES) {
      errors.push(`${name}: larger than ${MAX_BYTES} bytes`);
    }
  }
  summaryErrors(dir, errors, warnings);
  const s = readJson(join(dir, "submission.json"), errors);
  if (!s) return { errors, warnings };

  if (s.schema !== "openaudit.submission/1") {
    errors.push('schema: must be "openaudit.submission/1"');
  }
  const resultsPath = join(dir, "results.json");
  const results = existsSync(resultsPath)
    ? readJson(resultsPath, errors)
    : undefined;
  const newMethod = isNewMethod(dirname(dir));
  const method = rulesFor(s, results?.schema, dirname(dir));
  if (newMethod && !method) {
    errors.push(
      `harness: a new method names the harness that ran it, one of ${Object.keys(HARNESS_RULES).join(", ")}`,
    );
  } else if (!method) {
    errors.push(
      `method: ${JSON.stringify(s.method)} has no harness. Use one of ${Object.keys(METHODS).join(", ")}, or add ${methodDir}/method.json for a new method (submissions/README.md).`,
    );
  } else if (
    !newMethod &&
    s.harness !== undefined &&
    s.harness !== basename(method.harness)
  ) {
    errors.push(
      `harness: ${s.method} runs on ${basename(method.harness)}. Remove harness, or set it to that.`,
    );
  }
  if (s.method !== methodDir) {
    errors.push(`method: ${s.method} is not the folder name ${methodDir}`);
  }
  if (!SLUG.test(s.variant ?? "")) {
    errors.push("variant: use lowercase letters, digits and hyphens");
  } else if (s.variant !== variantDir) {
    errors.push(`variant: ${s.variant} is not the folder name ${variantDir}`);
  } else if (s.variant === "submit") {
    errors.push('variant: "submit" is the name of a page on the site');
  } else if (seedVariants(s.method).includes(s.variant)) {
    errors.push(`variant: ${s.variant} is a variant on the site already`);
  }
  for (const key of ["displayName", "summary", "license"]) {
    if (!isText(s[key])) errors.push(`${key}: required`);
  }
  if (!EMAIL.test(s.contact ?? "")) errors.push("contact: an email address");
  if (
    !Array.isArray(s.authors) ||
    !s.authors.length ||
    !s.authors.every((a) => isText(a?.name))
  ) {
    errors.push("authors: a list with a name for each author");
  }
  const placeholder = (v) =>
    /\b(TBD|TODO|your name)\b|example\.(com|org)\b/i.test(v ?? "");
  for (const [key, value] of [
    ["license", s.license],
    ["contact", s.contact],
    ...(s.authors ?? []).map((a, i) => [`authors[${i}]`, a?.name]),
  ]) {
    if (placeholder(value)) {
      errors.push(
        `${key}: a placeholder. Ask the person for it (checkpoint 4).`,
      );
    }
  }
  for (const [i, link] of (s.links ?? []).entries()) {
    if (!LINK_KINDS.includes(link?.kind)) {
      errors.push(`links[${i}].kind: one of ${LINK_KINDS.join(", ")}`);
    }
    if (!/^https?:\/\/\S+$/.test(link?.url ?? "")) {
      errors.push(`links[${i}].url: a URL`);
    }
  }

  const artifact = method?.artifact ?? "artifact";
  const artifacts = Array.isArray(s.artifacts) ? s.artifacts : [];
  const recipeFile = method?.fit ? s.recipe?.file : undefined;
  if (!artifacts.length && !recipeFile) {
    errors.push(
      method?.fit
        ? `artifacts: at least one ${artifact} file, or a recipe file (recipe.file)`
        : `artifacts: at least one ${artifact} file`,
    );
  }
  const seen = new Set();
  for (const [i, a] of artifacts.entries()) {
    const at = `artifacts[${i}]`;
    if (!MODEL_ID.test(a.model ?? "")) {
      errors.push(`${at}.model: a Hugging Face model ID, <owner>/<name>`);
    } else if (method?.anyModel === false && !method.models.includes(a.model)) {
      errors.push(`${at}.model: one of ${method.models.join(", ")}`);
    }
    if (seen.has(a.model))
      errors.push(`${at}.model: ${a.model} is there two times`);
    seen.add(a.model);
    if (a.path === undefined) {
      if (!HF_FILE.test(a.url ?? "") || PLACEHOLDER.test(a.url)) {
        errors.push(
          `${at}.url: a Hugging Face file at a commit, https://huggingface.co/<owner>/<repo>/blob/<40-character commit>/<file>. For code: path`,
        );
      }
      if (PICKLE_FILE.test(a.url ?? "")) {
        errors.push(
          `${at}.url: a pickle file can run code when we load it. Use safetensors, or a .pt file of tensors only.`,
        );
      }
    }
    fileErrors(dir, a, at, errors);
    for (const key of Object.keys(a.params ?? {})) {
      if (method && !method.params.includes(key)) {
        errors.push(
          `${at}.params.${key}: not a param. Use ${method.params.join(", ")}.`,
        );
      }
    }
  }

  if (
    method &&
    method.anyModel !== false &&
    artifacts.length &&
    !artifacts.some((a) => method.models.includes(a.model))
  ) {
    warnings.push(
      `artifacts: no ${artifact} on our leaderboard models (${method.models.join(", ")}). We still review it. If it looks promising, we can fit it on our models: give the recipe and its script.`,
    );
  }

  if (s.recipe === undefined) {
    warnings.push(
      "recipe: none. It is optional, but it helps us trust the results.",
    );
  } else if (typeof s.recipe !== "object" || s.recipe === null) {
    errors.push("recipe: an object");
  } else {
    const keys = method?.fit ? [...RECIPE_KEYS, ...FIT_KEYS] : RECIPE_KEYS;
    for (const [key, value] of Object.entries(s.recipe)) {
      if (!keys.includes(key)) {
        errors.push(`recipe.${key}: not a recipe key. Use ${keys.join(", ")}.`);
      } else if (!FIT_KEYS.includes(key) && !isText(value)) {
        errors.push(`recipe.${key}: text`);
      }
    }
    if (recipeFile !== undefined) checkRecipeFile(dir, recipeFile, errors);
    if (method?.fit && (recipeFile !== undefined || s.recipe.trainData)) {
      errors.push(...trainDataErrors(s.recipe.trainData));
    }
  }
  if (method?.fit && recipeFile === undefined) {
    warnings.push(
      "recipe.file: none. We rank a variant only when we can fit its recipe on our core models.",
    );
  }

  if (method) {
    checkResults(
      results,
      METHODS[s.method] ?? [method],
      method,
      artifacts,
      recipeFile === undefined ? null : s.recipe,
      errors,
      warnings,
    );
  }
  copyWarnings(dir, results, warnings);
  return { errors, warnings };
}

/** The sha256 of each file in `dir`, by its path in `dir`. */
function fileHashes(dir, base = dir, out = {}) {
  for (const n of readdirSync(dir)) {
    if (n === "__pycache__" || n === ".pytest_cache") continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) fileHashes(p, base, out);
    else out[relative(base, p)] = sha256Of(p);
  }
  return out;
}

const withoutHashes = (v) =>
  canonical(
    JSON.parse(JSON.stringify(v, (k, x) => (k === "sha256" ? undefined : x))),
  );

/** The variant folders of submissions/examples/methods/. */
function exampleDirs() {
  const root = join(HERE, "examples", "methods");
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap((m) =>
    statSync(join(root, m)).isDirectory()
      ? readdirSync(join(root, m))
          .map((v) => join(root, m, v))
          .filter((d) => existsSync(join(d, "submission.json")))
      : [],
  );
}

/** Warnings for a folder that is a copy of an example or of another submission, or whose results
 * are another folder's results with only the hashes changed. */
function copyWarnings(dir, results, warnings) {
  const self = resolve(dir);
  const others = [...exampleDirs(), ...submissionDirs()].filter(
    (d) => resolve(d) !== self,
  );
  const hashes = canonical(fileHashes(dir));
  const ours = results ? withoutHashes(results) : null;
  for (const other of others) {
    const name = relative(ROOT, other);
    if (canonical(fileHashes(other)) === hashes) {
      warnings.push(
        `the files are a copy of ${name}. Reviewer: ask what is new.`,
      );
      return;
    }
    const theirs = readJsonOr(join(other, "results.json"));
    if (ours && theirs && withoutHashes(theirs) === ours) {
      warnings.push(
        `results.json: the results of ${name}, with other sha256 values. Reviewer: it is not a run of this recipe.`,
      );
      return;
    }
  }
}

/** `{ errors }` of a new method's folder: method.json and its variant folders. The schema check
 * needs the spec packages (pnpm install). */
export async function checkMethod(methodDir) {
  const errors = [];
  const slug = basename(methodDir);
  const m = readJson(join(methodDir, "method.json"), errors);
  if (!m) return { errors };
  const { specModule } = await import("./spec-module.mjs");
  const { methodEntryErrors } = await specModule("method-entry.mjs");
  errors.push(...methodEntryErrors(m));
  if (m.slug !== slug) {
    errors.push(`method.json slug: ${m.slug} is not the folder name ${slug}`);
  }
  const seeds = join(ROOT, "data", "seed", "methods");
  if (existsSync(join(seeds, `${slug}.json`))) {
    errors.push(`method.json: ${slug} is a method on the site already`);
  }
  for (const f of readdirSync(seeds).filter((f) => f.endsWith(".json"))) {
    const old = readJsonOr(join(seeds, f))?.method ?? {};
    for (const key of [
      "displayName",
      "tagline",
      "summary",
      "expertSummary",
      "safetyUse",
    ]) {
      if (isText(m[key]) && m[key].trim() === old[key]?.trim()) {
        errors.push(
          `method.json ${key}: the same text as ${old.slug}. Write it for the new method.`,
        );
      }
    }
  }
  const names = readdirSync(methodDir);
  const isDir = (n) => statSync(join(methodDir, n)).isDirectory();
  if (!names.some(isDir)) {
    errors.push("method.json: a new method needs a variant folder");
  }
  for (const n of names.filter((n) => !isDir(n))) {
    if (!["method.json", "README.md"].includes(n)) {
      errors.push(`${n}: not method.json or README.md`);
    }
  }
  return { errors };
}

function checkRecipeFile(dir, file, errors) {
  if (typeof file !== "object" || file === null) {
    errors.push('recipe.file: { "path": "code/<file>", "sha256": ... }');
    return;
  }
  const url = file.url ?? "";
  if (
    file.path === undefined &&
    (!(HF_FILE.test(url) || GITHUB_FILE.test(url)) || PLACEHOLDER.test(url))
  ) {
    errors.push(
      'recipe.file.path: the recipe file in code/, for example "code/recipe.py"',
    );
  }
  fileErrors(dir, file, "recipe.file", errors);
}

/** The sha256 of an artifact or a recipe file, and its place: code in code/ (`path`), else a
 * Hugging Face file (`url`). */
function fileErrors(dir, f, at, errors) {
  if (f.path !== undefined) {
    if (f.url !== undefined) errors.push(`${at}: path or url, not both`);
    if (!CODE_PATH.test(f.path) || !existsSync(join(dir, f.path))) {
      errors.push(
        `${at}.path: a file in the code/ folder of this submission, for example "code/recipe.py"`,
      );
    } else if (!PLACEHOLDER.test(f.sha256 ?? "")) {
      const actual = sha256Of(join(dir, f.path));
      if (f.sha256 !== actual) {
        errors.push(`${at}.sha256: ${f.path} has the sha256 ${actual}`);
      }
      return;
    }
  } else if (CODE_URL.test(f.url ?? "")) {
    errors.push(
      `${at}.url: code goes in the pull request. Copy the file into code/, and give "path": "code/<file>" in place of url.`,
    );
  }
  if (!SHA256.test(f.sha256 ?? "") || PLACEHOLDER.test(f.sha256)) {
    errors.push(`${at}.sha256: the sha256 of the file, 64 hex characters`);
  }
}

/** The code/ folder: text files that run in the harness's environment, with tests. */
function checkCode(dir, errors, warnings) {
  const files = [];
  const walk = (sub) => {
    for (const name of readdirSync(join(dir, sub))) {
      const rel = `${sub}/${name}`;
      if (statSync(join(dir, rel)).isDirectory()) {
        if (!name.startsWith(".") && name !== "__pycache__") walk(rel);
      } else if (name !== ".DS_Store") files.push(rel);
    }
  };
  walk(CODE_DIR);
  for (const rel of files) {
    if (PACKAGE_FILE.test(rel)) {
      errors.push(
        `${rel}: the code runs in the harness's environment, so it cannot add packages. If you need one, ask in the pull request.`,
      );
    } else if (!CODE_TEXT.includes(extname(rel))) {
      errors.push(
        `${rel}: not a code or text file. Put weights and data on Hugging Face, at a commit.`,
      );
    } else if (statSync(join(dir, rel)).size > MAX_BYTES) {
      errors.push(`${rel}: larger than ${MAX_BYTES} bytes`);
    } else if (rel.endsWith(".py")) {
      const text = readFileSync(join(dir, rel), "utf8");
      unsafeCode(rel, text, errors, warnings);
      if (ENV_READ.test(text) && NETWORK.test(text)) {
        warnings.push(
          `${rel}: it reads environment variables and uses the network. Reviewer: check what it sends.`,
        );
      }
      if (PROCESS.test(text)) {
        warnings.push(
          `${rel}: it starts other programs (${text.match(PROCESS)[0]}). Reviewer: check each command.`,
        );
      }
    }
  }
  if (
    files.some((f) => f.endsWith(".py")) &&
    !files.some((f) => /^code\/tests\/test_[\w-]+\.py$/.test(f))
  ) {
    warnings.push(
      "code/tests/: no tests. Add code/tests/test_<name>.py: it helps us trust the code.",
    );
  }
}

/** The errors in `recipe.trainData`: the recipe's TRAIN_DATA. The harness has the same rules. */
export function trainDataErrors(spec) {
  const at = "recipe.trainData";
  if (typeof spec !== "object" || spec === null || Array.isArray(spec)) {
    return [`${at}: the recipe's TRAIN_DATA, an object`];
  }
  const errors = Object.keys(spec)
    .filter((k) => !["kind", "sources", "generator"].includes(k))
    .map((k) => `${at}.${k}: not a key. Use kind, sources, generator.`);
  if (spec.kind === "none") {
    return [
      ...errors,
      ...["sources", "generator"]
        .filter((k) => k in spec)
        .map((k) => `${at}.${k}: not with kind "none"`),
    ];
  }
  if (!["fixed", "generated"].includes(spec.kind)) {
    errors.push(`${at}.kind: "fixed", "generated" or "none"`);
  }
  const generator = spec.generator ?? "";
  if (
    spec.kind === "generated" &&
    !(HF_FILE.test(generator) || GITHUB_FILE.test(generator))
  ) {
    errors.push(
      `${at}.generator: the script or card that tells how the data was made, a Hugging Face or GitHub file at a commit`,
    );
  }
  const sources = spec.sources;
  if (
    typeof sources !== "object" ||
    sources === null ||
    !Object.keys(sources).length
  ) {
    return [...errors, `${at}.sources: an object of name to source`];
  }
  for (const [name, s] of Object.entries(sources)) {
    const sat = `${at}.sources.${name}`;
    if (typeof s !== "object" || s === null) {
      errors.push(`${sat}: an object`);
      continue;
    }
    for (const k of Object.keys(s)) {
      if (!["dataset", "revision", "file"].includes(k)) {
        errors.push(`${sat}.${k}: not a key. Use dataset, revision, file.`);
      }
    }
    if (!MODEL_ID.test(s.dataset ?? "")) {
      errors.push(`${sat}.dataset: a Hugging Face dataset, <owner>/<name>`);
    }
    if (!COMMIT.test(s.revision ?? "")) {
      errors.push(`${sat}.revision: a 40-character commit`);
    }
    if (!DATA_FILE.test(s.file ?? "")) {
      errors.push(`${sat}.file: a .parquet, .jsonl, .json or .csv file`);
    } else if (s.file.includes("{subset}") && spec.kind !== "generated") {
      errors.push(`${sat}.file: {subset} is only for "generated" data`);
    }
  }
  return errors;
}

/** JSON with sorted keys, to compare two values. */
const canonical = (v) =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.entries(x).sort(([a], [b]) => a.localeCompare(b)),
        )
      : x,
  );

/** `recipe`: when the method fits a recipe file. Then the runs on models with no artifact must be
 * fits of that file. */
function checkResults(r, all, method, artifacts, recipe, errors, warnings) {
  if (r === undefined) {
    const runs = all.map((h) => `${h.harness}/run.sh`).join(" or ");
    errors.push(`results.json: required. It is the output of ${runs}.`);
    return;
  }
  if (!r) return;
  if (r.schema !== method.results) {
    const schemas = all.map((h) => `"${h.results}"`).join(" or ");
    errors.push(`results.json: schema must be ${schemas}`);
  }
  for (const a of artifacts) {
    const run = r.runs?.[a.model];
    const at = `results.json ${a.model}`;
    if (!run) {
      errors.push(`${at}: no run`);
      continue;
    }
    if (run[method.artifact]?.sha256 !== a.sha256) {
      errors.push(
        `${at}: the ${method.artifact} sha256 is not the artifact's sha256`,
      );
    }
    checkRun(run, at, a.model, method, errors, warnings);
  }
  if (!recipe) return;
  const fits = Object.entries(r.runs ?? {}).filter(
    ([model]) => !artifacts.some((a) => a.model === model),
  );
  if (!fits.length && !artifacts.length) {
    errors.push("results.json: no run. Run the harness with --recipe.");
  }
  for (const [model, run] of fits) {
    const at = `results.json ${model}`;
    if (method.anyModel === false && !method.models.includes(model)) {
      errors.push(`${at}: one of ${method.models.join(", ")}`);
    }
    if (!run.fit || run.fit.recipe?.sha256 !== recipe.file?.sha256) {
      errors.push(
        `${at}: not a fit of recipe.file. Run the harness with --recipe on that file.`,
      );
    } else if (canonical(run.fit.trainData) !== canonical(recipe.trainData)) {
      errors.push(`${at}: the fit's TRAIN_DATA is not recipe.trainData`);
    }
    checkRun(run, at, model, method, errors, warnings);
  }
  const core = method.coreModels ?? [];
  const missing = core.filter((m) => !fits.some(([model]) => model === m));
  if (core.length && missing.length) {
    warnings.push(
      `results.json: a fit on ${core.length - missing.length} of ${core.length} core models. We fit the recipe on the others (${missing.join(", ")}) before we rank it.`,
    );
  }
}

export function checkRun(run, at, model, method, errors, warnings) {
  if (run.tier !== "full" || run.partial) {
    errors.push(`${at}: a full run without --limit`);
  }
  if (run.harness?.openauditDirty) {
    warnings.push(
      `${at}: the harness had local changes when it ran. Say why in the pull request.`,
    );
  }
  const evals = run.evals ?? {};
  for (const evalSlug of method.required?.[model] ??
    Object.keys(method.evals).filter((e) => !method.optional?.includes(e))) {
    if (!evals[evalSlug]) {
      errors.push(`${at}: no ${evalSlug} ${method.evals[evalSlug]} result`);
    }
  }
  for (const [evalSlug, e] of Object.entries(evals)) {
    const version = method.evals[evalSlug];
    if (!version) {
      errors.push(`${at}: ${evalSlug} is not an eval of this harness`);
      continue;
    }
    if (e?.version !== version) {
      errors.push(`${at}: ${evalSlug} must be version ${version}`);
      continue;
    }
    for (const [key, value] of Object.entries(e.metrics ?? {})) {
      if (!Number.isFinite(value)) {
        errors.push(`${at}: ${evalSlug} ${key} is not a number`);
      } else if (method.unitMetrics !== false && (value < 0 || value > 1)) {
        errors.push(`${at}: ${evalSlug} ${key} is not from 0 to 1`);
      }
    }
  }
}

/** The variant folders, submissions/<method>/<variant>/. Not evals/ (model evals), harnesses/ or
 * examples/. */
export function submissionDirs() {
  const dirs = [];
  for (const m of readdirSync(HERE)) {
    const md = join(HERE, m);
    if (
      !statSync(md).isDirectory() ||
      ["evals", "harnesses", "examples"].includes(m)
    )
      continue;
    for (const v of readdirSync(md)) {
      const vd = join(md, v);
      if (statSync(vd).isDirectory() && !onlyCaches(vd)) dirs.push(vd);
    }
  }
  return dirs;
}

/** A folder with no files but Python caches: what git leaves after a checkout of another branch. */
function onlyCaches(dir) {
  return readdirSync(dir).every((n) => {
    if (n === "__pycache__" || n === ".pytest_cache") return true;
    const p = join(dir, n);
    return statSync(p).isDirectory() && onlyCaches(p);
  });
}

const isEvalDir = (dir) => basename(dirname(resolve(dir))) === "evals";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const evalDirs = join(HERE, "evals");
  const dirs =
    process.argv.length > 2
      ? process.argv.slice(2)
      : [
          ...submissionDirs(),
          ...(existsSync(evalDirs)
            ? readdirSync(evalDirs)
                .map((d) => join(evalDirs, d))
                .filter((d) => statSync(d).isDirectory())
            : []),
        ];
  // The eval check needs the spec packages (pnpm install), so it loads only for eval folders.
  const evals = dirs.some(isEvalDir) ? await import("./check-eval.mjs") : null;
  let failed = false;
  const methodDirs = new Set(
    dirs
      .filter((d) => !isEvalDir(d))
      .map((d) => dirname(resolve(d)))
      .filter(isNewMethod),
  );
  for (const md of methodDirs) {
    const { errors } = await checkMethod(md);
    const name = relative(ROOT, md);
    for (const e of errors) console.log(`${name}: error: ${e}`);
    if (errors.length) failed = true;
    else console.log(`${name}: OK (a new method)`);
  }
  for (const dir of dirs) {
    const { errors, warnings } = isEvalDir(dir)
      ? evals.checkEvalSubmission(dir)
      : checkSubmission(dir);
    const name = relative(ROOT, dir) || dir;
    for (const w of warnings) console.log(`${name}: warning: ${w}`);
    for (const e of errors) console.log(`${name}: error: ${e}`);
    if (errors.length) failed = true;
    else console.log(`${name}: OK`);
  }
  if (!dirs.length) console.log("no submissions");
  process.exit(failed ? 1 : 0);
}
