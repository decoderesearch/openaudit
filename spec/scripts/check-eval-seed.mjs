// Checks eval seed files (data/seed/evals/*.json) against the Eval and EvalVersion schemas.
//   node spec/scripts/check-eval-seed.mjs [--names | --families] [<file.json>...]
// Also checks that slugs and aliases are unique, that each dataset with terms on showing samples
// (data/extracted/dataset-terms.json) has a `sampleTerms` rule, and counts the card results each
// eval matches.
// With --names, lists the matched raw names, and the most common card names that match no eval.
// With --families, groups the names that match no eval by the text before " — ", " - ", ":" or a
// last "(...)", and lists the groups that the most documents use.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { evalEntryErrors, norm } from "./eval-entry.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const EVALS = join(ROOT, "data", "seed", "evals");
const CARDS = join(ROOT, "data", "extracted", "system-cards");
const TERMS = join(ROOT, "data", "extracted", "dataset-terms.json");

const argv = process.argv.slice(2);
const names = argv.includes("--names");
const families = argv.includes("--families");
const files = argv.filter((a) => !a.startsWith("--"));
const all = readdirSync(EVALS).filter((f) => f.endsWith(".json"));
const targets = files.length ? files.map((f) => f.split("/").pop()) : all;

const publisher = new Map(
  JSON.parse(
    readFileSync(join(ROOT, "data", "seed", "system_cards.json"), "utf8"),
  ).documents.map((d) => [d.key, d.publisherId]),
);
const datasetTerms = new Map(
  existsSync(TERMS)
    ? JSON.parse(readFileSync(TERMS, "utf8")).entries.map((t) => [
        `${t.slug}@${t.version}`,
        t,
      ])
    : [],
);
const restrictive = (t) => Boolean(t.gated) || t.quotes.length > 0;

/** A gated source, or one with terms on showing samples, needs a rule. */
function termsErrors(slug, v, at) {
  const t = datasetTerms.get(`${slug}@${v.version}`);
  if (!t) return [];
  const errors = [];
  const flagged = [t, ...(t.loads ?? [])]
    .filter(restrictive)
    .map((x) => x.source);
  if (flagged.length && !v.sampleTerms)
    errors.push(
      `${at} ${flagged.join(", ")} is gated or has terms on showing samples; set sampleTerms`,
    );
  for (const s of (t.subsets ?? []).filter(restrictive))
    if (
      !v.sampleTerms?.subsets?.some(
        (r) => r.key === s.key && r.value === s.value,
      )
    )
      errors.push(
        `${at} subset ${s.value} (${s.source}) is gated or has terms; add a sampleTerms.subsets rule`,
      );
  return errors;
}

const rawNames = new Map();
for (const f of readdirSync(CARDS).filter((f) => f.endsWith(".json"))) {
  const card = JSON.parse(readFileSync(join(CARDS, f), "utf8"));
  for (const r of card.evalResults ?? []) {
    const k = norm(r.rawEvalName);
    const e = rawNames.get(k) ?? {
      count: 0,
      name: r.rawEvalName,
      docs: new Set(),
    };
    e.count++;
    e.docs.add(card.document);
    rawNames.set(k, e);
  }
}

const owner = new Map();
const seeds = new Map();
let bad = 0;
for (const file of all) {
  const errors = [];
  let s;
  try {
    s = JSON.parse(readFileSync(join(EVALS, file), "utf8"));
  } catch (e) {
    seeds.set(file, { errors: [`not JSON: ${e.message}`] });
    continue;
  }
  const e = s.eval ?? {};
  errors.push(...evalEntryErrors(s));
  if (
    e.suite &&
    !existsSync(join(EVALS, "..", "eval-suites", `${e.suite}.json`))
  )
    errors.push(`/eval/suite: ${e.suite} is not in data/seed/eval-suites`);
  if (`${e.slug}.json` !== file)
    errors.push(`/eval/slug is "${e.slug}", but the file is ${file}`);
  (s.versions ?? []).forEach((v, i) => {
    errors.push(...termsErrors(e.slug, v, `/versions/${i}`));
  });
  for (const n of [e.slug, e.displayName, ...(e.aliases ?? [])].filter(
    Boolean,
  )) {
    const k = norm(n);
    const other = owner.get(k);
    if (other && other !== file) errors.push(`name "${n}" is also in ${other}`);
    owner.set(k, file);
  }
  seeds.set(file, { errors, eval: e });
}

for (const file of targets) {
  const s = seeds.get(file);
  if (!s) {
    bad++;
    console.log(`FAIL ${file}: not in data/seed/evals`);
    continue;
  }
  const keys = s.eval
    ? [
        ...new Set(
          [s.eval.slug, s.eval.displayName, ...(s.eval.aliases ?? [])]
            .filter(Boolean)
            .map(norm),
        ),
      ]
    : [];
  const matched = keys.map((k) => rawNames.get(k)).filter(Boolean);
  const count = matched.reduce((n, m) => n + m.count, 0);
  if (s.errors.length) {
    bad++;
    console.log(`FAIL ${file}`);
    for (const e of s.errors.slice(0, 40)) console.log(`  ${e}`);
  } else {
    console.log(`OK   ${file} (${count} card results match)`);
  }
  if (names && matched.length)
    console.log(
      `  matches: ${matched.map((m) => `${m.name} (${m.count})`).join("; ")}`,
    );
}

if (names && !files.length) {
  const unmatched = [...rawNames.entries()]
    .filter(([k]) => !owner.has(k))
    .sort((a, b) => b[1].count - a[1].count);
  console.log(
    `\nCard names that match no eval (${unmatched.length}), most results first:`,
  );
  for (const [, v] of unmatched.slice(0, 80))
    console.log(`  ${v.count}\t${v.name}`);
}

if (families && !files.length) {
  const head = (s) =>
    s
      .split(/ [—–-] |: /)[0]
      .replace(/(\s*\([^()]*\))+$/, "")
      .trim();
  const groups = new Map();
  for (const [k, v] of rawNames) {
    if (owner.has(k)) continue;
    const key = norm(head(v.name)) || k;
    const g = groups.get(key) ?? {
      name: head(v.name),
      results: 0,
      docs: new Set(),
      names: [],
    };
    g.results += v.count;
    for (const d of v.docs) g.docs.add(d);
    g.names.push(v.name);
    groups.set(key, g);
  }
  const list = [...groups.values()].sort(
    (a, b) => b.docs.size - a.docs.size || b.results - a.results,
  );
  console.log(
    `\nGroups of names that match no eval (${list.length}), most documents first:`,
  );
  console.log("  docs\tlabs\tresults\tnames\tgroup: example names");
  for (const g of list.filter((g) => g.docs.size > 1)) {
    const labs = new Set([...g.docs].map((d) => publisher.get(d) ?? d)).size;
    console.log(
      `  ${g.docs.size}\t${labs}\t${g.results}\t${g.names.length}\t${g.name}: ${g.names.slice(0, 3).join(" | ")}`,
    );
  }
}
process.exit(bad ? 1 : 0);
