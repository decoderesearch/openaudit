// Reads incident sources for `scripts/incident-pages.ts`: OpenAI's misalignment reports as items
// (headings, paragraphs and labeled log blocks), other pages as text with their images, and the
// check that a log step is in its source. No network here.
import type { IncidentLogRole } from '@openaudit/spec';
import { Window } from 'happy-dom';

export type ReportItem =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'block'; label: string; role: IncidentLogRole; text: string };

/** A misalignment report: its title, the model line ("Internal model · RL training"), its dates
 * and its items in page order. `unread`: headings that are block labels ("CoT"), so a log block in
 * a format that `parseReport` does not read. */
export type Report = { title: string; scope?: string; meta: string[]; items: ReportItem[]; unread: string[] };

export const isOpenAIReport = (url: string) =>
  /^https:\/\/alignment\.openai\.com\/misalignment-reports\/[a-z0-9-]+\/?$/.test(url);

/** The role of a block label of a misalignment report. Undefined: not known. */
export function labelRole(label: string): IncidentLogRole | undefined {
  const l = label.trim().toLowerCase();
  if (/^((parent|subagent) )?cot\b/.test(l)) return 'reasoning';
  if (/^(tool call|new test)/.test(l)) return 'tool_call';
  if (/^(tool result|decoded check output|runtime error|system receipt|task grader record|slack notification)/.test(l))
    return 'tool_result';
  if (/^(system instruction|developer|recorded extraction instructions)/.test(l)) return 'system';
  if (/^(user|task prompt)/.test(l)) return 'user';
  if (
    /^(assistant|model response|final|saved note|compaction|parent message|subagent message|earlier agent-to-agent)/.test(
      l,
    )
  )
    return 'assistant';
  return undefined;
}

function parse(html: string) {
  const window = new Window({
    settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true },
  });
  // The parser loads `<link>` resources, and it throws on a relative URL.
  const clean = html.replace(/<link\b[^>]*>/gi, '').replace(/<script\b[\s\S]*?<\/script>/gi, '');
  return new window.DOMParser().parseFromString(clean, 'text/html');
}

type El = ReturnType<typeof parse>['body'];

/** An element's text, with a line break for each `<br>`, and no-break spaces as spaces. */
function textOf(el: El) {
  const copy = el.cloneNode(true) as El;
  for (const br of copy.querySelectorAll('br')) br.replaceWith('\n');
  return copy.textContent.replace(/\u00a0/g, ' ');
}

/** The lines of a block: one per paragraph, with its own line breaks. */
const lines = (ps: El[]) => ps.map((p) => textOf(p).replace(/\n+$/, ''));

/** The report formats: a block is a `div[data-report-role-block]`, a cell of a one-column table,
 * or a `section.cot-excerpt`. The first block is the report's facts. */
export function parseReport(html: string): Report {
  const doc = parse(html);
  const root = (doc.querySelector('article') ?? doc.body) as El;
  const report: Report = { title: '', meta: [], items: [], unread: [] };
  // The first block, before the first heading, is the report's facts.
  const block = (ps: El[]) => {
    if (!report.items.length) {
      const [scope, ...meta] = lines(ps).map((l) => l.trim());
      report.scope = scope;
      report.meta = meta.filter(Boolean);
      return;
    }
    const [first = '', ...rest] = lines(ps);
    // A label can hold the first line of the text after a vertical tab.
    const [label, ...more] = first.split(/[\v\n]/);
    const text = [...more, ...rest].join('\n').trim();
    if (!text) return;
    const role = labelRole(label) ?? 'tool_result';
    report.items.push({ kind: 'block', label: label.trim(), role, text });
  };
  const walk = (el: El) => {
    for (const child of [...el.children] as El[]) {
      const tag = child.tagName.toLowerCase();
      if (child.getAttribute('aria-hidden') === 'true' || tag === 'nav') continue;
      if (tag === 'h1') report.title = textOf(child).trim();
      else if (/^h[2-4]$/.test(tag)) {
        const text = textOf(child).trim();
        if (labelRole(text) && text.split(/\s+/).length <= 2) report.unread.push(text);
        if (text) report.items.push({ kind: 'heading', text });
      } else if (tag === 'table') {
        // A table of one column: each cell is a block.
        const rows = [...child.querySelectorAll('tr')].map((tr) => [...tr.querySelectorAll('td')] as unknown as El[]);
        if (rows.every((cells) => cells.length === 1))
          for (const [td] of rows) block([...td.querySelectorAll('p')] as El[]);
        else
          for (const td of child.querySelectorAll('td')) {
            const label = lines([...td.querySelectorAll('p')] as El[])[0]
              ?.split(/[\v\n]/)[0]
              .trim();
            if (label && labelRole(label)) report.unread.push(label);
          }
      } else if (child.hasAttribute('data-report-role-block')) {
        block([...child.querySelectorAll('p')] as El[]);
      } else if (child.classList.contains('cot-excerpt')) {
        // A CoT with an "Original" and a "Translation" view: only the original is the log.
        const label = child.querySelector('.cot-title') as El | null;
        block([...(label ? [label] : []), ...child.querySelectorAll('[data-cot-panel="original"] p')] as El[]);
      } else if (tag === 'p') {
        if (child.hasAttribute('data-layout-spacer') || child.hasAttribute('data-web-metadata')) continue;
        const text = textOf(child).trim();
        if (text) report.items.push({ kind: 'paragraph', text });
      } else walk(child);
    }
  };
  walk(root);
  return report;
}

/** The model of a report from its scope line: "Internal model" from "Internal model · RL training". */
export const reportModel = (scope?: string) => scope?.split('·')[0].trim() || undefined;

/** A page as text for a model to read: paragraphs, headings, lists, code and quotes, with
 * `[image N: alt]` where the article's images are. `images`: their URLs, in order. */
export function pageText(html: string, base: string): { title: string; text: string; images: string[] } {
  const doc = parse(html);
  for (const el of doc.querySelectorAll('script, style, noscript, svg, nav, footer, header, form, iframe')) el.remove();
  const root = (doc.querySelector('article') ?? doc.querySelector('main') ?? doc.body) as El;
  const images: string[] = [];
  for (const img of [...root.querySelectorAll('img')] as unknown as El[]) {
    const src = bestSource(img, base);
    const w = Number(img.getAttribute('width') ?? 0);
    if (!src || /\.svg(\?|$)|^data:|logo|avatar|icon|sprite|pixel/i.test(src) || (w && w < 200)) {
      img.remove();
      continue;
    }
    images.push(src);
    img.replaceWith(`\n[image ${images.length}: ${img.getAttribute('alt') ?? ''}]\n`);
  }
  for (const el of root.querySelectorAll('p, h1, h2, h3, h4, li, pre, blockquote, tr, div')) el.append('\n');
  const text = textOf(root)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { title: doc.querySelector('title')?.textContent.trim() ?? '', text, images };
}

function bestSource(img: El, base: string) {
  const set = img.getAttribute('srcset') ?? img.getAttribute('data-srcset');
  const best = set
    ?.split(',')
    .map((s) => s.trim().split(/\s+/))
    .sort((a, b) => parseFloat(b[1] ?? '0') - parseFloat(a[1] ?? '0'))[0]?.[0];
  const src = best ?? img.getAttribute('src') ?? img.getAttribute('data-src');
  if (!src) return undefined;
  try {
    return new URL(src, base).href;
  } catch {
    return undefined;
  }
}

/** Text for a loose match: one kind of quote and dash, no `[...]` marks, and one space. */
export const loose = (s: string) =>
  s
    .normalize('NFKC')
    .replace(/[‘’‚‛′`]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐‑‒–—―−]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** The parts of a step's text that are not in the source. A step can cut the source with `[...]`
 * or `[…]`; each part between cuts must be in the source. Parts of fewer than 4 characters do
 * not count. */
export function missingParts(text: string, source: string): string[] {
  const hay = loose(source);
  return text
    .split(/\[(?:\.\.\.|…)\]/)
    .map(loose)
    .filter((p) => p.length >= 4 && !hay.includes(p));
}

type JsonNode = {
  start: number;
  end: number;
  members?: { key: string; keyStart: number; value: JsonNode }[];
  items?: JsonNode[];
};

/** Parses JSON text into nodes with their positions in the text. */
function jsonNodes(s: string): JsonNode {
  let i = 0;
  const ws = () => {
    while (/\s/.test(s[i] ?? '')) i++;
  };
  const str = () => {
    const start = i++;
    while (s[i] !== '"') i += s[i] === '\\' ? 2 : 1;
    i++;
    return JSON.parse(s.slice(start, i)) as string;
  };
  const value = (): JsonNode => {
    ws();
    const start = i;
    if (s[i] === '{' || s[i] === '[') {
      const object = s[i++] === '{';
      const node: JsonNode = { start, end: 0, ...(object ? { members: [] } : { items: [] }) };
      for (;;) {
        ws();
        if (s[i] === '}' || s[i] === ']') break;
        if (object) {
          const keyStart = i;
          const key = str();
          ws();
          i++;
          node.members!.push({ key, keyStart, value: value() });
        } else node.items!.push(value());
        ws();
        if (s[i] === ',') i++;
      }
      node.end = ++i;
      return node;
    }
    if (s[i] === '"') str();
    else while (i < s.length && !/[\s,\]}]/.test(s[i])) i++;
    return { start, end: i };
  };
  return value();
}

/** Sets one field of an incident in the text of an org file, and keeps the rest of the text as it
 * is. `undefined` removes the field. A new field goes after the last field. */
export function setIncidentField(text: string, slug: string, field: string, value: unknown): string {
  const root = jsonNodes(text);
  const incident = root.members
    ?.find((m) => m.key === 'incidents')
    ?.value.items?.find((n) =>
      n.members?.some((m) => m.key === 'slug' && JSON.parse(text.slice(m.value.start, m.value.end)) === slug),
    );
  const members = incident?.members;
  if (!members?.length) throw new Error(`no incident ${slug}`);
  const lineStart = text.lastIndexOf('\n', members[0].keyStart) + 1;
  const indent = text.slice(lineStart, members[0].keyStart);
  const format = (v: unknown) => JSON.stringify(v, null, 2).replace(/\n/g, `\n${indent}`);
  const at = members.findIndex((m) => m.key === field);
  if (at < 0) {
    if (value === undefined) return text;
    const end = members.at(-1)!.value.end;
    return `${text.slice(0, end)},\n${indent}${JSON.stringify(field)}: ${format(value)}${text.slice(end)}`;
  }
  const m = members[at];
  if (value !== undefined) return text.slice(0, m.value.start) + format(value) + text.slice(m.value.end);
  if (at > 0) return text.slice(0, members[at - 1].value.end) + text.slice(m.value.end);
  return text.slice(0, m.keyStart) + text.slice(members[1]?.keyStart ?? m.value.end);
}

/** Joins the hard line breaks of PDF prose, and removes the `,→` marks of wrapped code lines.
 * A break stays after `.`, `:`, `!` or `?`, and before a list item or an empty line. */
export const unwrapPdf = (s: string) =>
  s.replace(/[ \t]*\n?[ \t]*,→[ \t]*\n?[ \t]*/g, ' ').replace(/([^\n.:!?])[ \t]*\n(?=[ \t]*[^\s\-•*\d])/g, '$1 ');
