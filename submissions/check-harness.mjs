// Checks a harness: the code that runs a method eval on a submitted artifact (a lens, an SAE, a
// detector). A new harness comes in submissions/harnesses/<harness>/; the harnesses that we run are
// in evals/. It checks the files, the pins, submission/rules.json, the eval entries and the
// baseline run. It does not run the harness: we run each accepted harness on our side.
//   node submissions/check-harness.mjs [folder ...]   (default: submissions/harnesses/*)
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkRun, credentialReads, METHODS, unsafeCode } from "./check.mjs";
import { specModule } from "./spec-module.mjs";
import { summaryErrors } from "./summary.mjs";

const { evalEntryErrors } = await specModule("eval-entry.mjs");

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SEED = join(ROOT, "data", "seed");
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const COMMIT = /\b[0-9a-f]{40}\b/;
// The template's commit and hash.
const PLACEHOLDER = /\b0{40}\b|\b0{64}\b/;
const SHA256 = /^[0-9a-f]{64}$/;
const MODEL_ID = /^[\w.-]+\/[\w.-]+$/;
// A branch or a tag can change after we review it.
const MOVING_REF = /@(main|master)\b|:latest\b|--branch\b/;
const TEXT_FILES = [
  ".py",
  ".sh",
  ".md",
  ".json",
  ".jsonl",
  ".csv",
  ".txt",
  ".in",
  ".toml",
  ".yaml",
  ".yml",
  ".patch",
  ".lock",
];
const MAX_BYTES = 1_000_000;
// uv locks of large packages are bigger.
const MAX_LOCK_BYTES = 5_000_000;
const RULES_KEYS = [
  "method",
  "methods",
  "artifact",
  "anyModel",
  "results",
  "params",
  "evals",
  "models",
  "optional",
  "required",
  "unitMetrics",
  "fit",
  "coreModels",
];
const README_PARTS = ["## Steps", "## Rules", "## Output", "## Submit"];

const isText = (v) => typeof v === "string" && v.trim().length > 0;

function readJson(path, errors) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    errors.push(`${relative(ROOT, path)}: ${e.message}`);
    return null;
  }
}

/** The files of the harness, relative to `dir`. Not the run outputs and local environments. */
function filesOf(dir) {
  const files = [];
  const walk = (sub) => {
    for (const name of readdirSync(join(dir, sub))) {
      const rel = sub ? `${sub}/${name}` : name;
      if (statSync(join(dir, rel)).isDirectory()) {
        if (name.startsWith(".") || ["out", "__pycache__"].includes(name))
          continue;
        walk(rel);
      } else if (name !== ".DS_Store") files.push(rel);
    }
  };
  walk("");
  return files;
}

function fileErrors(dir, files, errors) {
  for (const rel of files) {
    const ext = extname(rel);
    const size = statSync(join(dir, rel)).size;
    if (basename(rel) === ".gitignore") continue;
    if (!TEXT_FILES.includes(ext)) {
      errors.push(
        `${rel}: not a text file. Put weights and data on Hugging Face, at a commit.`,
      );
    } else if (size > (ext === ".lock" ? MAX_LOCK_BYTES : MAX_BYTES)) {
      errors.push(
        `${rel}: larger than ${ext === ".lock" ? MAX_LOCK_BYTES : MAX_BYTES} bytes`,
      );
    }
  }
  for (const need of [
    "README.md",
    "run.sh",
    "submission/rules.json",
    "submission/submission.json",
    "submission/README.md",
  ]) {
    if (!files.includes(need)) errors.push(`${need}: required`);
  }
  if (
    files.includes("run.sh") &&
    !(statSync(join(dir, "run.sh")).mode & 0o111)
  ) {
    errors.push("run.sh: not executable (chmod +x run.sh)");
  }
  if (!files.some((f) => /^tests\/test_[\w-]+\.py$/.test(f))) {
    errors.push("tests/: a tests/test_<name>.py file for the scoring");
  }
  if (!files.some((f) => f.startsWith("examples/"))) {
    errors.push(
      "examples/: at least one artifact or script for the self-test, for example a baseline",
    );
  }
}

/** The packages of a `pip install` line that have no exact version. */
export function unpinnedPackages(line) {
  const m = line.match(/\bpip install\b(.*)/);
  if (!m) return [];
  return m[1]
    .trim()
    .split(/\s+/)
    .filter(
      (t) =>
        t &&
        !/^[-.$/"']/.test(t) &&
        !t.includes("==") &&
        !(t.includes("@") && COMMIT.test(t)),
    );
}

/** The pins: each package and repo at a fixed version, so that our run uses the code you ran. */
function pinErrors(dir, files, errors) {
  const texts = Object.fromEntries(
    files
      .filter((f) => TEXT_FILES.includes(extname(f)) && extname(f) !== ".lock")
      .map((f) => [f, readFileSync(join(dir, f), "utf8")]),
  );
  // A commit can be in the script, or in a file that the script reads (a pin file).
  const hasCommit = Object.values(texts).some((t) => COMMIT.test(t));
  let locked = files.some(
    (f) => f.endsWith(".lock") || texts[f]?.includes("--hash=sha256:"),
  );
  for (const [rel, text] of Object.entries(texts)) {
    if (!/\.(sh|py|txt|in|toml)$/.test(rel)) continue;
    if (MOVING_REF.test(text)) {
      errors.push(`${rel}: a branch or "latest". Pin a commit or a version.`);
    }
    if (/\.(sh|py)$/.test(rel) && PLACEHOLDER.test(text)) {
      errors.push(`${rel}: a placeholder commit or sha256 (all zeros)`);
    }
    if (!rel.endsWith(".sh")) continue;
    for (const line of text.split("\n")) {
      const loose = unpinnedPackages(line);
      if (loose.length) {
        errors.push(
          `${rel}: pip install ${loose.join(" ")} has no version. Use <package>==<version>.`,
        );
      }
    }
    if (text.includes("git clone")) {
      if (!/\bcheckout\b/.test(text) || !hasCommit) {
        errors.push(
          `${rel}: git clone with no commit. Check out a 40-character commit.`,
        );
      } else {
        // A repo at a commit, with its own lock.
        locked = true;
      }
    }
  }
  if (!locked) {
    errors.push(
      "no lock: add a uv lock (uv lock --script run.py gives run.py.lock), or a requirements file with --hash",
    );
  }
}

function codeErrors(dir, files, errors, warnings) {
  for (const rel of files.filter((f) => f.endsWith(".py"))) {
    unsafeCode(rel, readFileSync(join(dir, rel), "utf8"), errors, warnings);
  }
  for (const rel of files.filter((f) => f.endsWith(".sh"))) {
    credentialReads(rel, readFileSync(join(dir, rel), "utf8"), errors);
  }
}

/** The eval entry of `slug`: the harness's seed/<slug>.json, else data/seed/evals/<slug>.json. */
function evalEntry(dir, slug, errors) {
  for (const path of [
    join(dir, "seed", `${slug}.json`),
    join(SEED, "evals", `${slug}.json`),
  ]) {
    if (existsSync(path)) return readJson(path, errors);
  }
  return undefined;
}

function rulesErrors(dir, rules, errors, warnings) {
  const harness = basename(dir);
  for (const key of Object.keys(rules)) {
    if (!RULES_KEYS.includes(key)) {
      errors.push(
        `rules.json: ${key} is not a rule. Use ${RULES_KEYS.join(", ")}.`,
      );
    }
  }
  const methods = rules.methods ?? (rules.method ? [rules.method] : []);
  if (!methods.length)
    errors.push("rules.json: methods, a list of method slugs");
  for (const m of methods) {
    if (!existsSync(join(SEED, "methods", `${m}.json`))) {
      errors.push(
        `rules.json: ${m} is not a method on the site. Suggest the method first (the Submit form).`,
      );
    }
  }
  if (!SLUG.test(rules.artifact ?? "")) {
    errors.push(
      'rules.json: artifact, what a submitter gives, in lowercase (for example "lens")',
    );
  }
  const schema = `openaudit.${harness}.results/`;
  if (
    !new RegExp(`^${schema.replaceAll(".", "\\.")}\\d+$`).test(
      rules.results ?? "",
    )
  ) {
    errors.push(`rules.json: results must be "${schema}<n>"`);
  }
  for (const [m, hs] of Object.entries(METHODS)) {
    for (const h of hs) {
      if (
        h.results === rules.results &&
        resolve(ROOT, h.harness) !== resolve(dir)
      ) {
        errors.push(
          `rules.json: ${h.harness} (${m}) has the results schema ${rules.results}`,
        );
      }
    }
  }
  if (
    !Array.isArray(rules.params) ||
    !rules.params.every((p) => /^[a-z][A-Za-z0-9]*$/.test(p))
  ) {
    errors.push("rules.json: params, a list of camelCase names (can be empty)");
  }

  const models = Array.isArray(rules.models) ? rules.models : [];
  if (!models.length || !models.every((m) => MODEL_ID.test(m))) {
    errors.push(
      "rules.json: models, the Hugging Face IDs of the leaderboard models",
    );
  }
  if (new Set(models).size !== models.length) {
    errors.push("rules.json: a model is in models two times");
  }
  for (const m of rules.coreModels ?? []) {
    if (!models.includes(m))
      errors.push(`rules.json: core model ${m} is not in models`);
  }
  if (rules.fit && !rules.coreModels?.length) {
    errors.push(
      "rules.json: a harness with fit needs coreModels, the models that we fit on",
    );
  }

  const evals = rules.evals ?? {};
  if (!Object.keys(evals).length) {
    errors.push("rules.json: evals, each eval slug to its version");
  }
  for (const [slug, version] of Object.entries(evals)) {
    const entry = evalEntry(dir, slug, errors);
    if (entry === undefined) {
      errors.push(
        `rules.json: ${slug} has no eval entry. Add seed/${slug}.json.`,
      );
      continue;
    }
    if (!entry) continue;
    if (!entry.eval?.facets?.subjects?.includes("method")) {
      errors.push(`${slug}: facets.subjects must have "method"`);
    }
    if (!entry.versions?.some((v) => v.version === version)) {
      errors.push(`rules.json: ${slug} has no version ${version}`);
    }
  }
  for (const slug of rules.optional ?? []) {
    if (!evals[slug])
      errors.push(`rules.json: optional ${slug} is not in evals`);
  }
  for (const [model, needed] of Object.entries(rules.required ?? {})) {
    if (!models.includes(model))
      errors.push(`rules.json: required ${model} is not in models`);
    for (const slug of needed ?? []) {
      if (!evals[slug])
        errors.push(`rules.json: required ${slug} is not in evals`);
    }
  }
  return methods;
}

/** The new evals in seed/: each one in the format of data/seed/evals. */
function seedErrors(dir, files, rules, errors) {
  for (const rel of files.filter((f) => f.startsWith("seed/"))) {
    const slug = basename(rel, ".json");
    const entry = readJson(join(dir, rel), errors);
    if (!entry) continue;
    if (!rel.endsWith(".json") || entry.eval?.slug !== slug) {
      errors.push(`${rel}: the file name must be <eval slug>.json`);
    }
    if (existsSync(join(SEED, "evals", `${slug}.json`))) {
      errors.push(`${rel}: ${slug} is an eval on the site already`);
    }
    if (!rules?.evals?.[slug])
      errors.push(`${rel}: ${slug} is not in rules.json evals`);
    for (const e of evalEntryErrors(entry)) errors.push(`${rel}: ${e}`);
    const placeholder = JSON.stringify(entry).match(
      /\b(TODO|TBD)\b|\bexample\.(com|org)\b|"(0{40}|0{64})"/i,
    );
    if (placeholder) {
      errors.push(`${rel}: a placeholder (${placeholder[0]}). Fill it in.`);
    }
  }
}

function readmeErrors(dir, warnings, errors) {
  const path = join(dir, "README.md");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const part of README_PARTS) {
    if (!text.split("\n").includes(part))
      errors.push(`README.md: no "${part}"`);
  }
  const todo = text.match(/\b(TODO|TBD)\b/);
  if (todo) errors.push(`README.md: a placeholder (${todo[0]}). Fill it in.`);
  if (!/^### Self-test$/m.test(text)) {
    warnings.push(
      'README.md: no "### Self-test": the command and the scores of a known artifact',
    );
  }
}

function templateErrors(dir, rules, methods, errors) {
  const s = readJson(join(dir, "submission", "submission.json"), errors);
  if (!s) return;
  if (s.schema !== "openaudit.submission/1") {
    errors.push(
      'submission/submission.json: schema must be "openaudit.submission/1"',
    );
  }
  if (!methods.includes(s.method)) {
    errors.push(
      `submission/submission.json: method must be one of ${methods.join(", ")}`,
    );
  }
  for (const [i, a] of (s.artifacts ?? []).entries()) {
    for (const key of Object.keys(a.params ?? {})) {
      if (!rules.params?.includes(key)) {
        errors.push(
          `submission/submission.json: artifacts[${i}].params.${key} is not in rules.json params`,
        );
      }
    }
  }
}

/** A full run of the harness on a known artifact: one of the method's variants, or the example. */
function baselineErrors(dir, rules, errors, warnings) {
  const path = join(dir, "baseline-results.json");
  if (!existsSync(path)) {
    errors.push(
      "baseline-results.json: required. It is the results.json of a full run on a known artifact.",
    );
    return;
  }
  const r = readJson(path, errors);
  if (!r) return;
  if (r.schema !== rules.results) {
    errors.push(`baseline-results.json: schema must be ${rules.results}`);
  }
  if (/"(0{40}|0{64})"/.test(JSON.stringify(r))) {
    errors.push(
      "baseline-results.json: a placeholder commit or sha256 (all zeros). Run it on the pinned data.",
    );
  }
  if (/"localCopy":\s*true/.test(JSON.stringify(r))) {
    errors.push(
      "baseline-results.json: a run on a local copy of the data. Run it on the pinned data.",
    );
  }
  const runs = Object.entries(r.runs ?? {});
  if (!runs.length) errors.push("baseline-results.json: no run");
  const method = { ...rules, harness: relative(ROOT, dir) };
  for (const [model, run] of runs) {
    const at = `baseline-results.json ${model}`;
    if (!rules.models?.includes(model) && rules.anyModel === false) {
      errors.push(`${at}: not one of the models of rules.json`);
    }
    const artifact = run[rules.artifact];
    if (!isText(artifact?.file) || !SHA256.test(artifact?.sha256 ?? "")) {
      errors.push(`${at}: ${rules.artifact} must have the file and its sha256`);
    }
    if (!isText(run.harness?.openaudit)) {
      errors.push(`${at}: harness.openaudit, the repo commit of the run`);
    }
    checkRun(run, at, model, method, errors, warnings);
  }
}

/** `{ errors, warnings }` of one harness folder. `submitted`: a new harness, in submissions/. */
export function checkHarness(dir, { submitted = true } = {}) {
  const errors = [];
  const warnings = [];
  if (!SLUG.test(basename(dir))) {
    errors.push("the folder name: lowercase letters, digits and hyphens");
  }
  if (
    submitted &&
    existsSync(join(ROOT, "evals", basename(dir))) &&
    resolve(dir) !== resolve(ROOT, "evals", basename(dir))
  ) {
    errors.push(`evals/${basename(dir)} is a harness already`);
  }
  const files = filesOf(dir);
  fileErrors(dir, files, errors);
  pinErrors(dir, files, errors);
  codeErrors(dir, files, errors, warnings);
  readmeErrors(dir, warnings, errors);
  if (submitted) summaryErrors(dir, errors, warnings);

  const rulesPath = join(dir, "submission", "rules.json");
  const rules = existsSync(rulesPath) ? readJson(rulesPath, errors) : null;
  if (rules) {
    const methods = rulesErrors(dir, rules, errors, warnings);
    templateErrors(dir, rules, methods, errors);
    if (submitted) baselineErrors(dir, rules, errors, warnings);
  }
  seedErrors(dir, files, rules, errors);
  return { errors, warnings };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const base = join(ROOT, "submissions", "harnesses");
  const dirs =
    process.argv.length > 2
      ? process.argv.slice(2)
      : existsSync(base)
        ? readdirSync(base)
            .filter((d) => !d.startsWith("_"))
            .map((d) => join(base, d))
            .filter((d) => statSync(d).isDirectory())
        : [];
  let failed = false;
  for (const dir of dirs) {
    const inEvals = basename(dirname(resolve(dir))) === "evals";
    const { errors, warnings } = checkHarness(dir, { submitted: !inEvals });
    const name = relative(ROOT, resolve(dir));
    for (const w of warnings) console.log(`${name}: warning: ${w}`);
    for (const e of errors) console.log(`${name}: error: ${e}`);
    if (errors.length) failed = true;
    else console.log(`${name}: OK`);
  }
  if (!dirs.length) console.log("no harness submissions");
  process.exit(failed ? 1 : 0);
}
