// The "## Summary" of a submission's README.md: the text that a reviewer reads first.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const SUMMARY_WORDS = { min: 30, max: 150 };
const MAX_NUMBERS = 5;
const PLACEHOLDER = /\b(TEMPLATE|TODO|TBD)\b|<(?!https?:)[a-z][^>\n]*>/i;
// A number on its own: 0.87, 1,319 or 12%. Not a part of a name, such as Qwen3-14B or 70B.
const NUMBER = /(?<![\w.,-])\d[\d,]*(?:\.\d+)?%?(?![\w.-]*[A-Za-z])/g;
const HELP = "submissions/README.md#the-summary";

/** The text of the `## Summary` section, or null. */
export function summaryOf(text) {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.trim() === "## Summary");
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && /^#{1,6} /.test(l));
  return lines
    .slice(start + 1, end < 0 ? undefined : end)
    .join("\n")
    .trim();
}

/** Adds the problems of the summary in `<dir>/README.md` to `errors` and `warnings`. */
export function summaryErrors(dir, errors, warnings) {
  const path = join(dir, "README.md");
  if (!existsSync(path)) {
    errors.push(`README.md: required, with a "## Summary" (${HELP})`);
    return;
  }
  const text = readFileSync(path, "utf8");
  const summary = summaryOf(text);
  if (summary === null) {
    errors.push(`README.md: no "## Summary" (${HELP})`);
    return;
  }
  if (
    text
      .split("\n")
      .find((l) => /^## /.test(l))
      ?.trim() !== "## Summary"
  ) {
    warnings.push('README.md: put "## Summary" before the other sections');
  }
  if (PLACEHOLDER.test(summary)) {
    errors.push("README.md: the summary has a placeholder. Write it.");
  }
  const words = summary.split(/\s+/).filter(Boolean).length;
  const { min, max } = SUMMARY_WORDS;
  if (words < min || words > max) {
    errors.push(
      `README.md: the summary has ${words} words. Write ${min} to ${max}.`,
    );
  }
  if (/^\s*(\||[-*+] |\d+\. |```)/m.test(summary)) {
    warnings.push(
      "README.md: the summary has a table, a list or code. Write sentences.",
    );
  }
  const numbers = summary.match(NUMBER) ?? [];
  if (numbers.length > MAX_NUMBERS) {
    warnings.push(
      `README.md: the summary has ${numbers.length} numbers. Keep the ${MAX_NUMBERS} that matter most, and put the others in the results.`,
    );
  }
}
