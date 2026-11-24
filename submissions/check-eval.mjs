// Checks a model eval submission in submissions/evals/<slug>/: the form of submission.json, the eval
// entry in eval.json (the same schema as data/seed/evals), and the task files. It does not run the
// task: check_eval_task.py does that, and we run each accepted eval again on our side.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { specModule } from "./spec-module.mjs";
import { summaryErrors } from "./summary.mjs";

const { evalEntryErrors, norm } = await specModule("eval-entry.mjs");

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SEED_EVALS = join(ROOT, "data", "seed", "evals");
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const COMMIT = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HF_FILE =
  /^https:\/\/huggingface\.co\/((datasets|spaces)\/)?[\w.-]+\/[\w.-]+\/(blob|resolve)\/[0-9a-f]{40}\/\S+$/;
const GITHUB_REPO = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/;
const INSPECT_EVALS_TASK = /^inspect_evals\/[a-z0-9_]+$/;
const INSPECT_EVALS_PACKAGE = /^inspect-evals(\[[\w,-]+\])?==\d+\.\d+\.\d+$/;
const MODEL_ID = /^[\w.-]+(\/[\w.:-]+)+$/;
const KINDS = ["inspect_evals", "port", "new"];
const LINK_KINDS = [
  "paper",
  "repo",
  "dataset",
  "hf_benchmark",
  "leaderboard",
  "homepage",
  "blog",
];
const MAX_BYTES = 1_000_000;
/** The least samples of a parity test. */
export const PARITY_MIN_SAMPLES = 20;
/** A larger gap between the headline metric of the original and of the port gives a warning. */
export const PARITY_MAX_GAP = 0.05;

const isText = (v) => typeof v === "string" && v.trim().length > 0;

/** The Python name of the task of a slug: `my-eval` is `my_eval`. */
export const taskName = (slug) => slug.replaceAll("-", "_");

function readJson(path, errors) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    errors.push(`${basename(path)}: ${e.message}`);
    return null;
  }
}

/** The names, normalized, of the evals in data/seed/evals, to their files. */
function seedNames() {
  const names = new Map();
  for (const file of readdirSync(SEED_EVALS).filter((f) =>
    f.endsWith(".json"),
  )) {
    const e = JSON.parse(readFileSync(join(SEED_EVALS, file), "utf8")).eval;
    for (const n of [e.slug, e.displayName, ...(e.aliases ?? [])])
      if (n) names.set(norm(n), file);
  }
  return names;
}

/** The files of the folder: only JSON, Markdown and Python, and Python tests in `tests/`. */
function fileErrors(dir, errors) {
  const files = [];
  const walk = (sub) => {
    for (const name of readdirSync(join(dir, sub))) {
      const rel = sub ? `${sub}/${name}` : name;
      const path = join(dir, rel);
      if (name === "__pycache__" || name === ".pytest_cache") continue;
      if (statSync(path).isDirectory()) {
        if (rel === "tests") walk(rel);
        else errors.push(`${rel}/: only tests/ can be a folder`);
        continue;
      }
      files.push(rel);
      const ok = sub
        ? name.endsWith(".py")
        : [
            "submission.json",
            "eval.json",
            "parity.json",
            "README.md",
            "research-log.md",
          ].includes(name) || name.endsWith(".py");
      if (!ok) {
        errors.push(
          `${rel}: not an allowed file. Put datasets and logs on Hugging Face, at a commit.`,
        );
      } else if (statSync(path).size > MAX_BYTES) {
        errors.push(`${rel}: larger than ${MAX_BYTES} bytes`);
      }
    }
  };
  walk("");
  return files;
}

/** `{ errors, warnings }` of one eval submission folder. */
export function checkEvalSubmission(dir) {
  const errors = [];
  const warnings = [];
  const slugDir = basename(dir);
  const files = fileErrors(dir, errors);
  summaryErrors(dir, errors, warnings);

  const s = readJson(join(dir, "submission.json"), errors);
  const entry = readJson(join(dir, "eval.json"), errors);
  if (!s || !entry) return { errors, warnings };

  if (s.schema !== "openaudit.eval-submission/1") {
    errors.push('schema: must be "openaudit.eval-submission/1"');
  }
  if (!SLUG.test(s.slug ?? "")) {
    errors.push("slug: use lowercase letters, digits and hyphens");
  } else if (s.slug !== slugDir) {
    errors.push(`slug: ${s.slug} is not the folder name ${slugDir}`);
  }
  if (!KINDS.includes(s.kind)) {
    errors.push(
      `kind: one of ${KINDS.join(", ")} (an Inspect Evals task, a port of an eval to Inspect, or a new eval)`,
    );
  }
  if (!isText(s.license)) errors.push("license: required");
  if (!EMAIL.test(s.contact ?? "")) errors.push("contact: an email address");
  if (
    !Array.isArray(s.authors) ||
    !s.authors.length ||
    !s.authors.every((a) => isText(a?.name))
  ) {
    errors.push("authors: a list with a name for each author");
  }
  for (const [i, link] of (s.links ?? []).entries()) {
    if (!LINK_KINDS.includes(link?.kind)) {
      errors.push(`links[${i}].kind: one of ${LINK_KINDS.join(", ")}`);
    }
    if (!/^https?:\/\/\S+$/.test(link?.url ?? "")) {
      errors.push(`links[${i}].url: a URL`);
    }
  }
  if (s.kind === "new" && !isText(s.contamination)) {
    errors.push(
      "contamination: how the items stay out of training data (a canary string, a private held-out set, or why it is not necessary)",
    );
  }
  if (s.kind === "port") {
    if (!GITHUB_REPO.test(s.original?.repo ?? "")) {
      errors.push(
        "original.repo: the GitHub repo of the original eval, https://github.com/<owner>/<repo>",
      );
    }
    if (!COMMIT.test(s.original?.commit ?? "")) {
      errors.push(
        "original.commit: the 40-character commit of the original that you ported",
      );
    }
  }
  if (s.researchLog !== undefined && !/^https:\/\/\S+$/.test(s.researchLog)) {
    errors.push("researchLog: a URL");
  }
  for (const [i, run] of (s.runs ?? []).entries()) {
    const at = `runs[${i}]`;
    if (!MODEL_ID.test(run?.model ?? "")) {
      errors.push(`${at}.model: the model as Inspect names it (openai/gpt-5)`);
    }
    if (!HF_FILE.test(run?.log ?? "")) {
      errors.push(
        `${at}.log: the Inspect .eval log on Hugging Face, at a commit`,
      );
    }
    if (!SHA256.test(run?.sha256 ?? "")) {
      errors.push(`${at}.sha256: the sha256 of the log, 64 hex characters`);
    }
  }

  checkEntry(entry, s, slugDir, errors, warnings);
  const v = entry.versions?.[0];

  if (s.kind === "port" || s.kind === "new") {
    const name = taskName(slugDir);
    const task = join(dir, "task.py");
    if (!existsSync(task)) {
      errors.push("task.py: required. It has the Inspect task.");
    } else if (
      !new RegExp(`@task\\s*(\\(\\s*\\))?\\s*\\ndef ${name}\\(`).test(
        readFileSync(task, "utf8"),
      )
    ) {
      errors.push(`task.py: no @task function named ${name}`);
    }
    if (!files.some((f) => /^tests\/test_[\w]+\.py$/.test(f))) {
      errors.push("tests/: at least one test file, tests/test_<name>.py");
    }
  }
  if (s.kind === "port") checkParity(dir, v, errors, warnings);

  const keys = new Set((v?.metrics ?? []).map((m) => m.key));
  for (const [raw, key] of Object.entries(s.metricKeys ?? {})) {
    if (!raw.includes("/")) {
      errors.push(
        `metricKeys.${raw}: an Inspect metric name, <scorer>/<metric>`,
      );
    }
    if (!keys.has(key)) {
      errors.push(`metricKeys.${raw}: ${key} is not a metric of eval.json`);
    }
  }
  return { errors, warnings };
}

/** The eval entry: the seed schema, one version, a new slug and names, a pinned dataset, and a
 * runner that we can run. */
function checkEntry(entry, s, slugDir, errors, warnings) {
  errors.push(...evalEntryErrors(entry).map((e) => `eval.json${e}`));
  const e = entry.eval ?? {};
  if (e.slug !== slugDir) {
    errors.push(
      `eval.json /eval/slug: ${e.slug} is not the folder name ${slugDir}`,
    );
  }
  const names = seedNames();
  for (const n of [e.slug, e.displayName, ...(e.aliases ?? [])].filter(
    Boolean,
  )) {
    const other = names.get(norm(n));
    if (other) {
      errors.push(
        `eval.json: the name "${n}" is the eval in data/seed/evals/${other} already`,
      );
    }
  }
  if (entry.versions?.length !== 1) {
    errors.push("eval.json /versions: exactly one version");
    return;
  }
  const v = entry.versions[0];
  const ds = v.dataset ?? {};
  const pinned = ds.hfRepo && COMMIT.test(ds.revision ?? "");
  // The Inspect Evals release fixes the data, so its source can be a URL.
  if (!pinned && !(s.kind === "inspect_evals" && !ds.hfRepo && ds.url)) {
    errors.push(
      s.kind === "inspect_evals"
        ? "eval.json /versions/0/dataset: hfRepo and revision (a 40-character commit), or url"
        : "eval.json /versions/0/dataset: hfRepo, and revision as a 40-character commit",
    );
  }
  if (!isText(ds.license)) {
    errors.push("eval.json /versions/0/dataset/license: required");
  }
  const runner = v.runner ?? {};
  if (runner.kind !== "inspect") {
    errors.push('eval.json /versions/0/runner/kind: "inspect"');
  }
  if (!runner.defaultLimit) {
    errors.push(
      "eval.json /versions/0/runner/defaultLimit: the samples of a full run",
    );
  }
  for (const m of runner.models ?? []) {
    if (!m.tier) {
      errors.push(
        `eval.json /versions/0/runner/models ${m.id}: a tier (spec/model-ladders.yaml), not only a model`,
      );
    }
    if (m.default?.startsWith("openrouter/")) {
      errors.push(
        `eval.json /versions/0/runner/models ${m.id}: default is a route id with no "openrouter/" (for example openai/gpt-6-luna)`,
      );
    }
  }
  if (s.kind === "inspect_evals") {
    if (!INSPECT_EVALS_TASK.test(runner.task ?? "")) {
      errors.push(
        "eval.json /versions/0/runner/task: an Inspect Evals task, inspect_evals/<name>",
      );
    }
    if (!INSPECT_EVALS_PACKAGE.test(runner.package ?? "")) {
      errors.push(
        "eval.json /versions/0/runner/package: the Inspect Evals release, inspect-evals==<x.y.z>",
      );
    }
  } else if (s.kind === "port" || s.kind === "new") {
    const task = `openaudit_runner/${taskName(slugDir)}`;
    if (runner.task !== task) {
      errors.push(`eval.json /versions/0/runner/task: ${task}`);
    }
  }
  const headlines = (v.metrics ?? []).filter((m) => m.headline);
  if (headlines.length !== 1) {
    errors.push("eval.json /versions/0/metrics: exactly one headline metric");
  }
  for (const m of v.metrics ?? []) {
    if (!m.safetyDirection) {
      errors.push(
        `eval.json /versions/0/metrics ${m.key}: safetyDirection (which value is safer)`,
      );
    }
  }
  if (e.access !== "public") {
    warnings.push(
      "eval.json /eval/access: not public. We agree with you how to run the private parts.",
    );
  }
}

/** parity.json: the original and the port on the same samples and model. */
function checkParity(dir, v, errors, warnings) {
  const path = join(dir, "parity.json");
  if (!existsSync(path)) {
    errors.push(
      "parity.json: required for a port. Run the original and the port on the same samples and model.",
    );
    return;
  }
  const p = readJson(path, errors);
  if (!p) return;
  if (!MODEL_ID.test(p.model ?? ""))
    errors.push("parity.json model: the model");
  if (!Number.isInteger(p.samples) || p.samples < PARITY_MIN_SAMPLES) {
    errors.push(`parity.json samples: at least ${PARITY_MIN_SAMPLES}`);
  }
  const headline = v?.metrics?.find((m) => m.headline)?.key;
  const metrics = p.metrics ?? {};
  if (headline && !metrics[headline]) {
    errors.push(`parity.json metrics: no ${headline} (the headline metric)`);
  }
  for (const [key, m] of Object.entries(metrics)) {
    if (!Number.isFinite(m?.original) || !Number.isFinite(m?.port)) {
      errors.push(`parity.json metrics.${key}: original and port numbers`);
    } else if (
      key === headline &&
      Math.abs(m.original - m.port) > PARITY_MAX_GAP
    ) {
      warnings.push(
        `parity.json: ${key} is ${m.original} in the original and ${m.port} in the port. Say why in notes.`,
      );
    }
  }
  if (
    p.sampleAgreement !== undefined &&
    !(p.sampleAgreement >= 0 && p.sampleAgreement <= 1)
  ) {
    errors.push("parity.json sampleAgreement: from 0 to 1");
  }
  if (!isText(p.notes)) {
    warnings.push(
      "parity.json notes: none. Say what is different from the original, and why.",
    );
  }
}
