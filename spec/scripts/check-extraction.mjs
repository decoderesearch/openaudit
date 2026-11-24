// Checks system-card extraction files against data/extracted/system-card.schema.yaml and the seed.
//   node spec/scripts/check-extraction.mjs [--text <document text>] <file.json>...
// No files: all of data/extracted/system-cards. With --text (one file only), every quote must be in
// the text. The match ignores case, spaces and punctuation, so a PDF's table layout does not matter.
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { bundle } from "./generate.mjs";
import { sources, squash } from "./sources.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const DIR = join(ROOT, "data", "extracted", "system-cards");
const seed = JSON.parse(
  readFileSync(join(ROOT, "data", "seed", "system_cards.json"), "utf8"),
);
const docKeys = new Set(seed.documents.map((d) => d.key));
const docKind = new Map(seed.documents.map((d) => [d.key, d.kind]));
const modelIds = new Set(seed.models.flatMap((m) => [m.id, ...m.checkpoints]));
const evals = readdirSync(join(ROOT, "data", "seed", "evals"))
  .filter((f) => f.endsWith(".json"))
  .map(
    (f) =>
      JSON.parse(readFileSync(join(ROOT, "data", "seed", "evals", f), "utf8"))
        .eval,
  );
const evalSlugs = new Set(evals.map((e) => e.slug));
// Same name match as the importer (apps/web/scripts/import-seed.ts).
const norm = (s) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
const evalByName = new Map(
  evals.flatMap((e) =>
    [e.slug, e.displayName, ...e.aliases].map((n) => [norm(n), e]),
  ),
);
const orgByName = new Map(
  seed.organizations.flatMap((d) =>
    [d.id, d.displayName, ...d.aliases].map((n) => [norm(n), d.id]),
  ),
);
const docPublisher = new Map(seed.documents.map((d) => [d.key, d.publisherId]));
// Checked external links: "name | alias -> URL".
const evalLinks = readFileSync(
  join(ROOT, "data", "extracted", "eval-links.txt"),
  "utf8",
)
  .split("\n")
  .filter((l) => l.includes(" -> ") && !l.startsWith("#"))
  .map((l) => {
    const [names, url] = l.split(" -> ");
    return { names: names.split("|").map((n) => n.trim()), url: url.trim() };
  });

/**
 * Eval names that text in this card must link, with the link. A public registry eval always; a
 * lab_internal or gated one only when the card's results match it (as the importer links them).
 */
function linkTargets(data) {
  const matched = new Set();
  for (const r of data.evalResults ?? []) {
    const e = evalByName.get(norm(r.rawEvalName ?? ""));
    if (!e) continue;
    const labs = e.maintainers
      .map((m) => orgByName.get(norm(m.name)))
      .filter(Boolean);
    if (
      e.access !== "lab_internal" ||
      !labs.length ||
      labs.includes(docPublisher.get(data.document))
    )
      matched.add(e);
  }
  const targets = evalLinks.map(({ names, url }) => ({ names, url }));
  for (const e of evals)
    if (e.access === "public" || matched.has(e))
      targets.push({
        names: [e.displayName, ...e.aliases],
        url: `/evals/${e.slug}`,
      });
  // Short names match other words; keep registry acronyms such as "BBQ".
  const long = (n, url) =>
    n.length >= 4 || (url.startsWith("/evals/") && /^[A-Z]{3}$/.test(n));
  return targets.map(({ names, url }) => ({
    names: names.filter((n) => long(n, url)),
    url,
  }));
}

/** The first eval name in the text that has a known link but no link in this field. */
function unlinked(text, targets) {
  const urls = new Set(
    [...text.matchAll(LINK)].map(([, , url]) => url.split("#")[0]),
  );
  const bare = text.replace(LINK, " ");
  for (const { names, url } of targets) {
    if (urls.has(url)) continue;
    const hit = names.find((n) =>
      new RegExp(
        `(?<![\\p{L}\\p{N}-])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}-])`,
        "u",
      ).test(bare),
    );
    if (hit) return { name: hit, url };
  }
}
const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;
// Model names with long version numbers ("Grok 4.20", "Codestral 25.08"). They are not values.
const versionNames = new Set(
  [...JSON.stringify(seed).matchAll(/[A-Za-z][A-Za-z-]* v?\d+\.\d{2,}\b/g)].map(
    ([n]) => n.toLowerCase(),
  ),
);

/** Our Markdown text fields: links go to /evals/<slug> or http(s); short numbers and no ±. */
function checkText(where, text, errors, warnings, targets) {
  for (const [, , url] of text.matchAll(LINK)) {
    const slug = url.match(/^\/evals\/([^/#?]+)$/)?.[1];
    if (slug ? !evalSlugs.has(slug) : !/^https?:\/\/\S+$/.test(url))
      errors.push(`${where}: bad link "${url}"`);
  }
  const plain = text.replace(LINK, "$1");
  if (/\[[^\]]*\]\(|\]\(/.test(plain))
    errors.push(`${where}: broken Markdown link`);
  if (/±|\+\/-/.test(plain))
    warnings.push(`${where}: has ±; keep only a large error bar`);
  // A value below 1 may keep 2 significant digits (0.73, 0.04%). Section numbers and versions are not values.
  const VALUE =
    /(?<!(?:section|§|table|figure|fig\.|appendix|v)\s?)(?<![\d.])(\d+)\.(\d{2,})(?![.\d])/gi;
  let numbers = plain;
  for (const n of versionNames)
    numbers = numbers.replace(new RegExp(n.replace(/[.-]/g, "\\$&"), "gi"), "");
  const long = [...numbers.matchAll(VALUE)].find(([, int, dec]) =>
    Number(int) ? true : dec.replace(/^0+/, "").length > 2,
  );
  if (long) errors.push(`${where}: "${long[0]}" has too many decimals`);
  const miss = targets && unlinked(text, targets);
  if (miss) errors.push(`${where}: link "${miss.name}" to ${miss.url}`);
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats.default(ajv);
ajv.addSchema(bundle());
const validate = ajv.compile(
  YAML.parse(
    readFileSync(
      join(ROOT, "data", "extracted", "system-card.schema.yaml"),
      "utf8",
    ),
  ),
);

function check(file, text) {
  const errors = [];
  const warnings = [];
  let data;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    return { errors: [`not JSON: ${e.message}`], warnings };
  }
  if (!validate(data)) {
    for (const e of validate.errors)
      errors.push(
        `${e.instancePath || "/"} ${e.message}${e.params?.allowedValues ? ` (${e.params.allowedValues.join(", ")})` : ""}`,
      );
  }
  const name = file
    .split("/")
    .pop()
    .replace(/\.json$/, "");
  if (data.document !== name)
    errors.push(
      `/document is "${data.document}", but the file is ${name}.json`,
    );
  for (const key of [
    data.document,
    ...(data.alsoDocuments ?? []),
    ...(data.basedOn ? [data.basedOn] : []),
  ]) {
    if (key && !docKeys.has(key))
      errors.push(`document key "${key}" is not in the seed`);
  }
  if (
    data.covers?.length === 0 &&
    docKind.get(data.document) !== "technical_report"
  ) {
    errors.push(
      "/covers is empty; only a technical report on an eval may cover no model",
    );
  }
  const refs = [...(data.covers ?? []), ...(data.evalResults ?? [])];
  for (const r of refs) {
    if (r.model && !modelIds.has(r.model))
      errors.push(
        `model "${r.model}" is not a seed model or checkpoint id; use rawModelName`,
      );
  }
  const unmatched = new Set(
    refs.filter((r) => !r.model).map((r) => r.rawModelName),
  );
  if (unmatched.size)
    warnings.push(
      `models not in the seed: ${[...unmatched].slice(0, 12).join("; ")}`,
    );
  const targets = linkTargets(data);
  (data.findings ?? []).forEach((f, i) => {
    checkText(`/findings/${i}/text`, f.text, errors, warnings, targets);
    if (!f.tone) errors.push(`/findings/${i}: no tone`);
  });
  const covered = new Set(
    (data.covers ?? []).flatMap((c) => (c.model ? [c.model] : [])),
  );
  (data.riskDecisions ?? []).forEach((r, i) => {
    checkText(
      `/riskDecisions/${i}/labLabel`,
      r.labLabel,
      errors,
      warnings,
      targets,
    );
    for (const m of r.models ?? [])
      if (!covered.has(m))
        errors.push(`/riskDecisions/${i}/models: "${m}" is not in /covers`);
    if (r.models && covered.size > 0 && r.models.length === covered.size)
      errors.push(
        `/riskDecisions/${i}/models: lists every covered model; leave it out`,
      );
  });
  (data.topics ?? []).forEach(
    (t, i) =>
      t.headline &&
      checkText(`/topics/${i}/headline`, t.headline, errors, warnings, targets),
  );
  for (const { where, source } of sources(data)) {
    if (source.pdfPage && data.pageCount && source.pdfPage > data.pageCount) {
      errors.push(
        `${where}: pdfPage ${source.pdfPage} is past pageCount ${data.pageCount}`,
      );
    }
  }
  if (text !== undefined) {
    const haystack = squash(text);
    const missing = [...sources(data)].filter(
      (q) => !haystack.includes(squash(q.source.quote)),
    );
    for (const q of missing)
      errors.push(
        `${q.where}: quote is not in the text: "${q.source.quote.slice(0, 100)}"`,
      );
  }
  return { errors, warnings, results: data.evalResults?.length ?? 0 };
}

const argv = process.argv.slice(2);
const textAt = argv.indexOf("--text");
const text =
  textAt === -1 ? undefined : readFileSync(argv.splice(textAt, 2)[1], "utf8");
if (text !== undefined && argv.length !== 1)
  throw new Error("--text needs exactly one extraction file");
const files = argv.length
  ? argv
  : readdirSync(DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => join(DIR, f));
let bad = 0;
for (const file of files) {
  const { errors, warnings, results } = check(file, text);
  const label = file.split("/").pop();
  if (errors.length) {
    bad++;
    console.log(`FAIL ${label}`);
    for (const e of errors.slice(0, 40)) console.log(`  ${e}`);
    if (errors.length > 40) console.log(`  ... and ${errors.length - 40} more`);
  } else {
    console.log(`OK   ${label} (${results} results)`);
  }
  for (const w of warnings) console.log(`  warning: ${w}`);
}
process.exit(bad ? 1 : 0);
