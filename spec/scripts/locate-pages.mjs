// Sets `pdfPage` on each cited source: the page of our saved PDF that has the quote, from 1.
// `page` stays the page number printed in the document.
//   node spec/scripts/locate-pages.mjs [--write] <file.json>...
// No files: all of data/extracted/system-cards. The PDF is data/cache/documents/<document>.pdf
// (apps/web/scripts/mirror-documents.ts saves it); a file with no saved PDF is skipped. Without
// --write, it only prints counts. A quote on more than one page goes to the page nearest to its
// printed page plus the document's usual offset. A quote not in the PDF gets no pdfPage.
// If a quote is on one page only and that page prints its number, `page` is set to that number.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";
import { sources, squash } from "./sources.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const DIR = join(ROOT, "data", "extracted", "system-cards");
const CACHE = join(ROOT, "data", "cache", "documents");

/** The number a page prints on its own line ("7", "Page 7", "7 of 30") in its first or last 3 lines. */
function printedNumber(text) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  for (const l of [...lines.slice(-3).reverse(), ...lines.slice(0, 3)]) {
    const m = l.match(/^(?:page\s+)?(\d{1,4})(?:\s+of\s+\d+)?$/i);
    if (m) return Number(m[1]);
  }
  return undefined;
}

/**
 * The printed number of each page (index 0 is page 1). A number counts only if a page at most 2
 * away agrees with it; a short gap between agreeing pages is filled in.
 */
function printedNumbers(pages) {
  const raw = pages.map(printedNumber);
  const offset = (i) => (raw[i] === undefined ? undefined : raw[i] - i);
  const sure = raw.map((n, i) =>
    [-2, -1, 1, 2].some((d) => offset(i + d) === offset(i)) ? n : undefined,
  );
  return sure.map((n, i) => {
    if (n !== undefined) return n;
    let a = i - 1;
    let b = i + 1;
    while (a >= 0 && sure[a] === undefined) a--;
    while (b < sure.length && sure[b] === undefined) b++;
    const same =
      a >= 0 && b < sure.length && b - a <= 6 && sure[a] - a === sure[b] - b;
    return same ? sure[a] + (i - a) : undefined;
  });
}

/** Squashed text of all pages, where each page starts in it, and each page's printed number. */
function pdfPages(pdf) {
  const text = execFileSync("pdftotext", ["-layout", pdf, "-"], {
    maxBuffer: 1 << 30,
    encoding: "utf8",
  });
  const pages = text.split("\f");
  if (pages.at(-1) === "") pages.pop();
  const starts = [];
  let all = "";
  for (const p of pages) {
    starts.push(all.length);
    all += squash(p);
  }
  const lines = pages.map((p) =>
    p.split("\n").map((l) => l.trim().replace(/\s+/g, " ")),
  );
  return {
    all,
    starts,
    lines,
    count: pages.length,
    numbers: printedNumbers(pages),
  };
}

/**
 * The first page (from 1) with a line that starts with the section label ("Results", "5.1"),
 * for a quote not in the PDF text, such as a table saved as an image. Contents lines, which end
 * in a page number, do not count.
 */
function sectionPage(label, { lines }) {
  if (!label || printed(label) !== undefined) return undefined;
  const esc = label
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${esc}(:|\\s|$)`, "i");
  const i = lines.findIndex((page) =>
    page.some((l) => re.test(l) && !/[\s.]\d+$/.test(l)),
  );
  return i === -1 ? undefined : i + 1;
}

/**
 * The pages (from 1) where the quote starts. If the whole quote is not found: its first or last
 * 50 characters (a quote across a page break), then, for a table row, its longest run of digits on
 * a page that also has the row's first letters.
 */
function pagesOf(quote, pdf) {
  const q = squash(quote);
  if (!q) return [];
  let found = find(q, pdf);
  if (!found.length && q.length >= 80) found = find(q.slice(0, 50), pdf);
  if (!found.length && q.length >= 80) found = find(q.slice(-50), pdf);
  if (!found.length) {
    const run = (q.match(/\d+/g) ?? []).reduce(
      (a, b) => (b.length > a.length ? b : a),
      "",
    );
    const label = q.match(/^\D{6,}/)?.[0].slice(0, 8);
    const text = (p) =>
      pdf.all.slice(pdf.starts[p - 1], pdf.starts[p] ?? pdf.all.length);
    if (run.length >= 12 && label)
      found = find(run, pdf).filter((p) => text(p).includes(label));
  }
  return found;
}

function find(q, { all, starts }) {
  const found = new Set();
  for (
    let i = all.indexOf(q);
    i !== -1 && found.size < 50;
    i = all.indexOf(q, i + 1)
  ) {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= i) lo = mid;
      else hi = mid - 1;
    }
    found.add(lo + 1);
  }
  return [...found].sort((a, b) => a - b);
}

const printed = (page) => (/^\d+$/.test(page ?? "") ? Number(page) : undefined);

function locate(data, pdf, relabels) {
  const list = [...sources(data)].map((s) => ({
    ...s,
    pages: pagesOf(s.source.quote, pdf),
  }));
  const offsets = list
    .filter((s) => s.pages.length === 1 && printed(s.source.page) !== undefined)
    .map((s) => s.pages[0] - printed(s.source.page))
    .sort((a, b) => a - b);
  const offset = offsets.length ? offsets[offsets.length >> 1] : 0;
  const counts = {
    quotes: list.length,
    located: 0,
    chosen: 0,
    missing: 0,
    bySection: 0,
    relabeled: 0,
  };
  for (const { source, pages } of list) {
    if (!pages.length) {
      const at = sectionPage(source.page, pdf);
      if (at === undefined) {
        counts.missing++;
        delete source.pdfPage;
        continue;
      }
      counts.bySection++;
      pages.push(at);
    }
    let page = pages[0];
    if (pages.length > 1) {
      counts.chosen++;
      const want =
        printed(source.page) === undefined
          ? undefined
          : printed(source.page) + offset;
      if (want !== undefined)
        page = pages.reduce((a, b) =>
          Math.abs(b - want) < Math.abs(a - want) ? b : a,
        );
    }
    counts.located++;
    // Keep the key order of the schema: page, pdfPage, table, quote.
    let { page: p, table, quote, ...rest } = source;
    const n = pdf.numbers[page - 1];
    if (
      pages.length === 1 &&
      printed(p) !== undefined &&
      n !== undefined &&
      n !== printed(p)
    ) {
      relabels.push({ quote, from: p, to: String(n) });
      p = String(n);
      counts.relabeled++;
    }
    for (const k of Object.keys(source)) delete source[k];
    Object.assign(source, {
      ...(p && { page: p }),
      pdfPage: page,
      ...(table && { table }),
      quote,
      ...rest,
    });
  }
  return { counts, offset };
}

/** `text` with each relabeled source's `"page"` changed; the key is before `"quote"` in its object. */
function relabel(text, relabels) {
  for (const { quote, from, to } of relabels) {
    const at = text.indexOf(`"quote": ${JSON.stringify(quote)}`);
    const key = `"page": ${JSON.stringify(from)}`;
    const i = at === -1 ? -1 : text.lastIndexOf(key, at);
    if (i === -1 || text.slice(i, at).includes("}")) return undefined;
    text =
      text.slice(0, i) +
      `"page": ${JSON.stringify(to)}` +
      text.slice(i + key.length);
  }
  return text;
}

const argv = process.argv.slice(2);
const WRITE = argv.includes("--write");
const files = argv.filter((a) => a !== "--write");
const targets = files.length
  ? files
  : readdirSync(DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => join(DIR, f));
const total = {
  files: 0,
  skipped: 0,
  changed: 0,
  quotes: 0,
  located: 0,
  bySection: 0,
  chosen: 0,
  missing: 0,
  relabeled: 0,
};
for (const file of targets) {
  const text = readFileSync(file, "utf8");
  const data = JSON.parse(text);
  const label = file.split("/").pop();
  const pdf = join(CACHE, `${data.document}.pdf`);
  if (!existsSync(pdf)) {
    total.skipped++;
    console.log(`skip ${label}: no saved PDF`);
    continue;
  }
  const pages = pdfPages(pdf);
  const relabels = [];
  const { counts, offset } = locate(data, pages, relabels);
  const oldCount = data.pageCount;
  total.files++;
  for (const k of [
    "quotes",
    "located",
    "bySection",
    "chosen",
    "missing",
    "relabeled",
  ])
    total[k] += counts[k];
  const notes = [
    `${counts.located - counts.bySection}/${counts.quotes} located`,
    counts.bySection && `${counts.bySection} by section heading`,
    counts.chosen && `${counts.chosen} on several pages`,
    offset && `offset ${offset > 0 ? "+" : ""}${offset}`,
    counts.relabeled && `${counts.relabeled} printed pages fixed`,
    oldCount !== pages.count &&
      `pageCount ${oldCount ?? "none"} -> ${pages.count}`,
  ].filter(Boolean);
  console.log(
    `${counts.missing ? "part" : "ok  "} ${label}: ${notes.join(", ")}`,
  );
  // The saved PDF is what links open, so its page count is the one to show.
  if (oldCount === undefined) {
    const entries = Object.entries(data);
    const at = entries.findIndex(([k]) => k === "disclosures");
    entries.splice(at === -1 ? entries.length : at, 0, [
      "pageCount",
      pages.count,
    ]);
    for (const k of Object.keys(data)) delete data[k];
    Object.assign(data, Object.fromEntries(entries));
  } else {
    data.pageCount = pages.count;
  }
  if (JSON.stringify(data) === JSON.stringify(JSON.parse(text))) continue;
  // Write in the file's own style: plain JSON.stringify or Prettier. If only printed pages
  // changed, edit them in place, because Prettier keeps each object's line breaks from its input.
  const plain = JSON.stringify(JSON.parse(text), null, 2) + "\n" === text;
  const json = JSON.stringify(data, null, 2) + "\n";
  const patched = relabel(text, relabels);
  const out =
    patched && JSON.stringify(JSON.parse(patched)) === JSON.stringify(data)
      ? patched
      : plain
        ? json
        : await format(json, {
            ...(await resolveConfig(file)),
            parser: "json",
          });
  if (out !== text) {
    total.changed++;
    if (WRITE) writeFileSync(file, out);
  }
}
console.log(
  `\n${total.files} files (${total.skipped} with no saved PDF): ${total.located - total.bySection}/${total.quotes} quotes located, ` +
    `${total.bySection} by section heading, ${total.chosen} on several pages, ${total.missing} not in the PDF, ${total.relabeled} printed pages fixed. ${total.changed} files ${WRITE ? "written" : "would change"}.`,
);
