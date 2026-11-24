// node --test submissions/check-eval.test.mjs   (needs the spec packages: pnpm install)
import assert from "node:assert/strict";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { checkEvalSubmission } from "./check-eval.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const EXAMPLE = join(
  HERE,
  "examples",
  "evals",
  "example-code-review-sycophancy",
);

/** A copy of the example in a new `evals/<slug>/` folder, changed by `edit(submission, entry,
 * dir)`. */
function example(edit = () => {}, slug = "example-code-review-sycophancy") {
  const dir = join(mkdtempSync(join(tmpdir(), "evsub-")), "evals", slug);
  cpSync(EXAMPLE, dir, { recursive: true });
  const read = (name) => JSON.parse(readFileSync(join(dir, name), "utf8"));
  const s = read("submission.json");
  const e = read("eval.json");
  edit(s, e, dir);
  writeFileSync(join(dir, "submission.json"), JSON.stringify(s));
  writeFileSync(join(dir, "eval.json"), JSON.stringify(e));
  return dir;
}

const errorsOf = (dir) => checkEvalSubmission(dir).errors;
const has = (errors, text) =>
  assert.ok(
    errors.some((e) => e.includes(text)),
    `no error with "${text}" in:\n${errors.join("\n")}`,
  );

test("the example passes", () => {
  assert.deepEqual(checkEvalSubmission(EXAMPLE), { errors: [], warnings: [] });
});

test("eval.json follows the seed schema", () => {
  has(
    errorsOf(example((_s, e) => (e.eval.facets.topics = ["nonsense"]))),
    "eval.json/eval/facets/topics/0",
  );
  has(
    errorsOf(example((_s, e) => delete e.versions[0].scores[0].direction)),
    "direction",
  );
});

test("the slug is the folder, and the names are new", () => {
  has(errorsOf(example((s) => (s.slug = "other"))), "is not the folder name");
  has(
    errorsOf(example((_s, e) => e.eval.aliases.push("BrokenMath"))),
    "data/seed/evals/brokenmath.json",
  );
});

test("the dataset is at a commit, and the version is one", () => {
  has(
    errorsOf(example((_s, e) => (e.versions[0].dataset.revision = "main"))),
    "40-character commit",
  );
  has(
    errorsOf(example((_s, e) => e.versions.push(e.versions[0]))),
    "exactly one version",
  );
});

test("one headline metric, with a safety direction", () => {
  has(
    errorsOf(example((_s, e) => (e.versions[0].metrics[1].headline = true))),
    "exactly one headline metric",
  );
  has(
    errorsOf(
      example((_s, e) => delete e.versions[0].metrics[0].safetyDirection),
    ),
    "safetyDirection",
  );
});

test("a judge slot names a known tier", () => {
  const slot = {
    id: "judge",
    role: "judge",
    taskArg: "judge_model",
    default: "openai/gpt-5-mini",
  };
  has(
    errorsOf(example((_s, e) => (e.versions[0].runner.models = [slot]))),
    "a tier",
  );
  has(
    errorsOf(
      example(
        (_s, e) => (e.versions[0].runner.models = [{ ...slot, tier: "cheap" }]),
      ),
    ),
    "not in spec/model-ladders.yaml",
  );
  has(
    errorsOf(
      example(
        (_s, e) =>
          (e.versions[0].runner.models = [
            { ...slot, tier: "fast", default: "openrouter/x-ai/grok-4.3" },
          ]),
      ),
    ),
    'no "openrouter/"',
  );
});

test("a new eval has task.py with its @task, tests and a contamination plan", () => {
  has(
    errorsOf(
      example((_s, _e, dir) => rmSync(join(dir, "tests"), { recursive: true })),
    ),
    "tests/",
  );
  has(
    errorsOf(
      example((_s, _e, dir) => writeFileSync(join(dir, "task.py"), "x = 1\n")),
    ),
    "no @task function named example_code_review_sycophancy",
  );
  has(errorsOf(example((s) => delete s.contamination)), "contamination");
  has(
    errorsOf(
      example((_s, e) => (e.versions[0].runner.task = "openaudit_runner/x")),
    ),
    "openaudit_runner/example_code_review_sycophancy",
  );
});

test("only allowed files, and no other folders", () => {
  has(
    errorsOf(
      example((_s, _e, dir) => writeFileSync(join(dir, "data.jsonl"), "{}\n")),
    ),
    "data.jsonl: not an allowed file",
  );
  has(
    errorsOf(
      example((_s, _e, dir) =>
        renameSync(join(dir, "tests"), join(dir, "more")),
      ),
    ),
    "more/: only tests/ can be a folder",
  );
});

test("an Inspect Evals task needs its task name and package release", () => {
  const toInspectEvals = (s, e, dir) => {
    s.kind = "inspect_evals";
    e.versions[0].runner.task = "inspect_evals/sycophancy";
    e.versions[0].runner.package = "inspect-evals==0.22.0";
    rmSync(join(dir, "task.py"));
  };
  assert.deepEqual(errorsOf(example(toInspectEvals)), []);
  has(
    errorsOf(
      example((s, e, dir) => {
        toInspectEvals(s, e, dir);
        e.versions[0].runner.package = "inspect-evals";
      }),
    ),
    "inspect-evals==<x.y.z>",
  );
  const byUrl = (s, e, dir) => {
    toInspectEvals(s, e, dir);
    const ds = e.versions[0].dataset;
    delete ds.hfRepo;
    delete ds.revision;
    ds.url = "https://github.com/meg-tong/sycophancy-eval";
  };
  assert.deepEqual(errorsOf(example(byUrl)), []);
  has(
    errorsOf(example((_s, e) => delete e.versions[0].dataset.hfRepo)),
    "40-character commit",
  );
});

test("a port needs the original at a commit, and a parity test", () => {
  const original = {
    repo: "https://github.com/anthropics/evals",
    commit: "c".repeat(40),
  };
  const parity = {
    model: "openai/gpt-5-mini",
    samples: 50,
    metrics: { catch_rate_pressure: { original: 0.6, port: 0.62 } },
    sampleAgreement: 0.96,
    notes: "The same prompts and parser.",
  };
  const port = (extra) => (s, _e, dir) => {
    s.kind = "port";
    s.original = original;
    extra?.(s, dir);
  };
  const withParity = (p) =>
    port((_s, dir) =>
      writeFileSync(join(dir, "parity.json"), JSON.stringify(p)),
    );
  assert.deepEqual(checkEvalSubmission(example(withParity(parity))), {
    errors: [],
    warnings: [],
  });
  has(errorsOf(example(port())), "parity.json: required");
  has(
    errorsOf(example(port((s) => (s.original.commit = "main")))),
    "original.commit",
  );
  has(
    errorsOf(example(withParity({ ...parity, samples: 5 }))),
    "samples: at least 20",
  );
  const gap = {
    ...parity,
    metrics: { catch_rate_pressure: { original: 0.6, port: 0.8 } },
  };
  assert.ok(
    checkEvalSubmission(example(withParity(gap))).warnings.some((w) =>
      w.includes("Say why in notes"),
    ),
  );
});

test("metricKeys map Inspect names to metrics of eval.json", () => {
  has(
    errorsOf(
      example((s) => (s.metricKeys["right_call/catch_rate_pressure"] = "nope")),
    ),
    "nope is not a metric of eval.json",
  );
  has(
    errorsOf(example((s) => (s.metricKeys = { mean: "catch_rate_pressure" }))),
    "<scorer>/<metric>",
  );
});

test("finished runs are Inspect logs on Hugging Face, at a commit", () => {
  const run = {
    model: "openai/gpt-5-mini",
    log: `https://huggingface.co/datasets/you/runs/blob/${"d".repeat(40)}/run.eval`,
    sha256: "e".repeat(64),
  };
  assert.deepEqual(errorsOf(example((s) => (s.runs = [run]))), []);
  has(
    errorsOf(
      example(
        (s) => (s.runs = [{ ...run, log: "https://example.com/run.eval" }]),
      ),
    ),
    "runs[0].log",
  );
});
