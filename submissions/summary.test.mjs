import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { summaryErrors, summaryOf } from "./summary.mjs";

const GOOD =
  "We submit a new variant of the Probes method. It reads only the last tokens of the reply, where the model gives its answer. We fit it on Qwen3.5-4B with the Varied Deception harness. It got 0.871, and the usual probe got 0.864: the gain is in the noise.";

/** The errors and warnings of a folder with this README (no README for null). */
function check(readme) {
  const dir = mkdtempSync(join(tmpdir(), "summary-"));
  if (readme !== null) writeFileSync(join(dir, "README.md"), readme);
  const errors = [];
  const warnings = [];
  summaryErrors(dir, errors, warnings);
  return { errors, warnings };
}

test("a plain summary, first, passes", () => {
  assert.deepEqual(check(`# X\n\n## Summary\n\n${GOOD}\n\n## More\n\n1. a\n`), {
    errors: [],
    warnings: [],
  });
});

test("the summary is only the text up to the next heading", () => {
  assert.equal(summaryOf(`# X\n## Summary\n\n${GOOD}\n### Detail\nmore`), GOOD);
  assert.equal(summaryOf("# X\n\nNo summary.\n"), null);
});

test("a README with no summary fails", () => {
  assert.match(check(null).errors[0], /^README.md: required/);
  assert.match(
    check("# X\n\n## Steps\n").errors[0],
    /^README.md: no "## Summary"/,
  );
});

test("a placeholder and a bad length fail", () => {
  assert.ok(
    check(`## Summary\n\nTODO: ${GOOD}`).errors.includes(
      "README.md: the summary has a placeholder. Write it.",
    ),
  );
  assert.ok(
    check(`## Summary\n\n<what you found> ${GOOD}`).errors.includes(
      "README.md: the summary has a placeholder. Write it.",
    ),
  );
  assert.deepEqual(
    check(`## Summary\n\nSee <https://example.com>. ${GOOD}`).errors,
    [],
  );
  assert.deepEqual(check("## Summary\n\nToo short.").errors, [
    "README.md: the summary has 2 words. Write 30 to 150.",
  ]);
  assert.match(
    check(`## Summary\n\n${`${GOOD} `.repeat(4)}`).errors[0],
    /has 196 words/,
  );
});

test("a list, many numbers, or a later place give warnings", () => {
  assert.deepEqual(check(`## Summary\n\n${GOOD}\n\n- one\n- two\n`).warnings, [
    "README.md: the summary has a table, a list or code. Write sentences.",
  ]);
  assert.match(
    check(`## Summary\n\n${GOOD} Also 0.1, 0.2, 3% and 1,319 items.`)
      .warnings[0],
    /has 6 numbers/,
  );
  assert.deepEqual(
    check(`## Summary\n\n${GOOD} On Qwen3-14B and Llama 70B.`).warnings,
    [],
  );
  assert.deepEqual(
    check(`## Steps\n\nRun it.\n\n## Summary\n\n${GOOD}`).warnings,
    ['README.md: put "## Summary" before the other sections'],
  );
});
