// Writes the text of incident pages into data/seed/orgs/<org>.json (see ADD_INCIDENT.md):
//
//   node scripts/with-env.mjs tsx scripts/incident-pages.ts logs <target> [--write] [--fresh]
//   node scripts/with-env.mjs tsx scripts/incident-pages.ts describe <target> [--write] [--fresh]
//
// `logs`: log excerpts from the sources. An OpenAI misalignment report gives its blocks as they
// are, and the model groups them and writes a title and description for each group. From other
// sources, the model copies excerpts, with text from screenshots; a step that is not in the
// source text is dropped. `describe`: a short `description` from the incident's fields.
// <target>: `<org>/<incident slug>`, `<org>` or `all`. For `logs`, an organization or `all` gives
// only the incidents with a `model_*` primary category. Without --write, it only prints. Sources
// are cached in data/cache/incident-sources/, replies in data/cache/incident-pages/ (--fresh:
// ask again). The model is the first `incident_writer` model that is not of the incident's lab.
import { lab, roleModels } from '@/lib/model-ladders';
import type { IncidentLog, IncidentLogStep, OrgSource } from '@openaudit/spec';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isOpenAIReport,
  missingParts,
  pageText,
  parseReport,
  reportModel,
  setIncidentField,
  unwrapPdf,
  type Report,
} from './incident-sources';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const ORGS = join(ROOT, 'data/seed/orgs');
const SOURCES = join(ROOT, 'data/cache/incident-sources');
const REPLIES = join(ROOT, 'data/cache/incident-pages');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
/** Characters of source text in one request; a longer source is read in parts. */
const CHUNK = 300_000;
/** Pages that need a browser to show their text. */
const SKIP_HOSTS = /(^|\.)(x\.com|twitter\.com|facebook\.com|instagram\.com|tiktok\.com|youtube\.com|linkedin\.com)$/;
/** Hosts of primary sources, other than the labs' own sites. */
const PRIMARY_HOSTS =
  /(^|\.)(gov|gov\.uk|arxiv\.org|website-files\.com|alignment\.org|lesswrong\.com|huggingface\.co|meta\.ai|x\.ai)$/;

type Obj = Record<string, unknown>;
type Incident = Obj & {
  slug: string;
  title: string;
  primaryCategory: string;
  models: string[];
  sources: OrgSource[];
  timeline: (Obj & { sources?: (OrgSource | string)[] })[];
  logs?: IncidentLog[];
};
type OrgFile = Obj & { slug: string; name: string; website?: string; incidents: Incident[] };

const args = process.argv.slice(2);
const [command, target] = args.filter((a) => !a.startsWith('--'));
const WRITE = args.includes('--write');
const FRESH = args.includes('--fresh');
if (!['logs', 'describe'].includes(command) || !target) {
  console.error('usage: incident-pages.ts logs|describe <org>/<slug>|<org>|all [--write] [--fresh]');
  process.exit(2);
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const orgFiles = () => readdirSync(ORGS).filter((f) => f.endsWith('.json'));
const readOrg = (slug: string): OrgFile => JSON.parse(readFileSync(join(ORGS, `${slug}.json`), 'utf8'));
const LAB_SITES = orgFiles()
  .map((f) => readOrg(f.replace(/\.json$/, '')).website)
  .flatMap((w) => (w ? [new URL(w).hostname.replace(/^www\./, '')] : []));

// ---------------------------------------------------------------------------------------------
// Models

const usage: Record<string, { input: number; output: number; calls: number }> = {};

/** The writers for an incident, in order: the `incident_writer` models of no lab in the
 * incident, then the others, for when a model refuses. */
function writer(org: string, models: string[]) {
  const all = roleModels('incident_writer');
  const labs = new Set([lab(`${org}/x`), ...models.map(lab)]);
  return [...all.filter((m) => !labs.has(lab(m))), ...all.filter((m) => labs.has(lab(m)))];
}

type Part = { type: 'text'; text: string } | { type: 'image'; mediaType: string; data: string };

class Refusal extends Error {}

/** The first reply of `models` that does not refuse. */
async function ask(models: string[], system: string, parts: Part[], maxTokens = 32_000): Promise<string> {
  for (const [n, model] of models.entries()) {
    try {
      return await askOne(model, system, parts, maxTokens);
    } catch (e) {
      if (!(e instanceof Refusal) || n === models.length - 1) throw e;
      console.log(`    ${model} refused; next model`);
    }
  }
  throw new Error('no models');
}

async function askOne(model: string, system: string, parts: Part[], maxTokens: number): Promise<string> {
  const [provider, name] = [model.split('/')[0], model.split('/').slice(1).join('/')];
  for (let attempt = 1; ; attempt++) {
    const res =
      provider === 'anthropic'
        ? await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: name.replace(/\./g, '-'),
              max_tokens: maxTokens,
              system,
              messages: [
                {
                  role: 'user',
                  content: parts.map((p) =>
                    p.type === 'text'
                      ? p
                      : { type: 'image', source: { type: 'base64', media_type: p.mediaType, data: p.data } },
                  ),
                },
              ],
            }),
          })
        : await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ''}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: name,
              max_completion_tokens: maxTokens,
              response_format: { type: 'json_object' },
              messages: [
                { role: 'system', content: system },
                {
                  role: 'user',
                  content: parts.map((p) =>
                    p.type === 'text'
                      ? p
                      : { type: 'image_url', image_url: { url: `data:${p.mediaType};base64,${p.data}` } },
                  ),
                },
              ],
            }),
          });
    const body = (await res.json().catch(() => ({}))) as Obj;
    if (res.ok) {
      const u = (usage[model] ??= { input: 0, output: 0, calls: 0 });
      u.calls++;
      if (provider === 'anthropic') {
        const x = body.usage as { input_tokens: number; output_tokens: number };
        u.input += x.input_tokens;
        u.output += x.output_tokens;
        if (body.stop_reason === 'refusal') throw new Refusal(`${model} refused`);
        if (body.stop_reason !== 'end_turn') throw new Error(`${model}: stopped: ${String(body.stop_reason)}`);
        return (body.content as { type: string; text?: string }[])
          .map((c) => (c.type === 'text' ? c.text : ''))
          .join('');
      }
      const x = body.usage as { prompt_tokens: number; completion_tokens: number };
      u.input += x.prompt_tokens;
      u.output += x.completion_tokens;
      const [choice] = body.choices as {
        finish_reason: string;
        message: { content: string | null; refusal?: string };
      }[];
      if (choice.message.refusal || choice.finish_reason === 'content_filter') throw new Refusal(`${model} refused`);
      if (choice.finish_reason !== 'stop') throw new Error(`${model}: stopped: ${choice.finish_reason}`);
      return choice.message.content ?? '';
    }
    const retry = res.status === 429 || res.status >= 500;
    if (!retry || attempt >= 5) throw new Error(`${model}: HTTP ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
}

/** The first JSON object in a reply. */
function json<T>(text: string): T {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error(`no JSON in reply: ${text.slice(0, 200)}`);
  return JSON.parse(text.slice(start, end + 1)) as T;
}

/** A cached reply: the same key and prompt give the same reply, unless --fresh. */
async function cached<T>(key: string, prompt: string, run: () => Promise<T>): Promise<T> {
  const file = join(REPLIES, `${key}.json`);
  const hash = sha(prompt);
  if (!FRESH && existsSync(file)) {
    const old = JSON.parse(readFileSync(file, 'utf8')) as { hash: string; reply: T };
    if (old.hash === hash) return old.reply;
  }
  const reply = await run();
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, JSON.stringify({ hash, reply }, null, 2));
  return reply;
}

// ---------------------------------------------------------------------------------------------
// Sources

type Source = { kind: 'html'; html: string } | { kind: 'pdf'; text: string } | { kind: 'error'; error: string };

async function source(url: string): Promise<Source> {
  mkdirSync(SOURCES, { recursive: true });
  const base = join(SOURCES, sha(url));
  if (existsSync(`${base}.pdf`)) return { kind: 'pdf', text: pdfText(`${base}.pdf`) };
  if (existsSync(`${base}.html`)) return { kind: 'html', html: readFileSync(`${base}.html`, 'utf8') };
  if (existsSync(`${base}.err`) && !FRESH) return { kind: 'error', error: readFileSync(`${base}.err`, 'utf8') };
  if (SKIP_HOSTS.test(new URL(url).hostname)) return { kind: 'error', error: 'needs a browser' };
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: '*/*' }, signal: AbortSignal.timeout(90_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get('content-type') ?? '';
    const bytes = Buffer.from(await res.arrayBuffer());
    if (type.includes('pdf') || bytes.subarray(0, 5).toString() === '%PDF-') {
      writeFileSync(`${base}.pdf`, bytes);
      return { kind: 'pdf', text: pdfText(`${base}.pdf`) };
    }
    writeFileSync(`${base}.html`, bytes);
    return { kind: 'html', html: bytes.toString('utf8') };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    writeFileSync(`${base}.err`, error);
    return { kind: 'error', error };
  }
}

/** A PDF's text, with `[page N]` before each page. */
function pdfText(file: string) {
  const text = execFileSync('pdftotext', ['-enc', 'UTF-8', file, '-'], { maxBuffer: 1 << 28 }).toString('utf8');
  return text
    .split('\f')
    .map((page, i) => `[page ${i + 1}]\n${page.trim()}`)
    .join('\n\n');
}

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

/** An image as a request part, or undefined when it is not a likely screenshot. */
async function image(url: string): Promise<Part | undefined> {
  const file = join(SOURCES, `${sha(url)}.img`);
  let bytes: Buffer;
  let mediaType: string;
  if (existsSync(file) && existsSync(`${file}.type`)) {
    bytes = readFileSync(file);
    mediaType = readFileSync(`${file}.type`, 'utf8');
  } else {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60_000) });
      if (!res.ok) return undefined;
      mediaType = (res.headers.get('content-type') ?? '').split(';')[0].trim();
      bytes = Buffer.from(await res.arrayBuffer());
      writeFileSync(file, bytes);
      writeFileSync(`${file}.type`, mediaType);
    } catch {
      return undefined;
    }
  }
  if (!IMAGE_TYPES.has(mediaType) || bytes.length < 10_000 || bytes.length > 4_500_000) return undefined;
  return { type: 'image', mediaType, data: bytes.toString('base64') };
}

const primary = (url: string) => {
  const host = new URL(url).hostname.replace(/^www\./, '');
  return (
    url.endsWith('.pdf') || PRIMARY_HOSTS.test(host) || LAB_SITES.some((s) => host === s || host.endsWith(`.${s}`))
  );
};

// ---------------------------------------------------------------------------------------------
// Logs

const STYLE = `Write in ASD-STE100 Simplified Technical English: short sentences, simple common words, active voice. Neutral and factual: no adjectives such as "shocking". Say what the source says; do not add facts.`;

const GROUP_SYSTEM = `You prepare log excerpts from an AI lab's misalignment report for a website.
The user gives the report as numbered items: headings [H], paragraphs [P1], [P2], ... and log blocks [B1], [B2], ... (each with the report's label, for example "CoT" or "Tool call").
Group the log blocks into excerpts. An excerpt is one step of the story, usually 1 to 4 consecutive blocks. Use every block once, in order: the first excerpt starts at B1, each next excerpt starts after the last block of the one before it, and the last excerpt ends at the last block.
For each excerpt write:
- "title": 3 to 8 words, sentence case, no period, about what the model does (for example "The model reads the Slack thread").
- "description": 1 or 2 short sentences that tell what the excerpt shows and why it matters, from the paragraphs near its blocks. Use "the model", not "we".
- "notes": optional. Short notes (at most 20 words each) to show before a block, by block id, only when the reader needs them to follow the steps (for example {"B4": "Later, the model reads the thread again."}).
${STYLE}
Reply with JSON only: {"excerpts": [{"from": "B1", "to": "B2", "title": "...", "description": "...", "notes": {}}]}`;

const EXTRACT_SYSTEM = `You find log excerpts in a source about an AI incident, for a website that shows what the model did.
A log excerpt is text that the AI model or its environment produced: chat messages, the model's replies, its chain of thought, commands or tool calls, tool output, messages that it sent, or posts that it wrote. Also the user or system messages around them. Not: text that people wrote about the model, quotes from staff, or the article's own words.
Rules:
- Only excerpts that show this incident's behavior, or the prompts and setup directly around it. Not: product demos, examples of normal or good behavior, or logs of other events.
- Copy each step's text exactly as the source shows it, letter for letter. Do not fix spelling, do not translate, do not summarize. You can leave out text inside a step: put "[...]" where you cut. Keep the source's own "[...]" and "[redacted]" marks.
- When the source quotes a model's words inside a sentence ("the chatbot replied, 'X'"), the step is only X.
- For text in an image (a screenshot of a chat or a terminal), read it carefully and set "ocr": true on that excerpt. Images that are not logs: ignore them.
- Roles: "system", "user", "assistant" (the model's reply or message), "reasoning" (its chain of thought), "tool_call" (a command or tool call by the model), "tool_result" (output of a tool or the environment). "label": the source's own label for the step, if it has one (for example "Tool result" or "bash").
- Group the steps into excerpts: one excerpt for each moment in the story. For each excerpt write "title" (3 to 8 words, sentence case, no period) and "description" (1 or 2 short sentences: what the excerpt shows and why it matters, from the source). "model": the model as the source names it, if it does.
- If the source has no log excerpts, return {"logs": []}. Most news stories have none, or only a quoted reply.
${STYLE}
Reply with JSON only: {"logs": [{"title": "...", "description": "...", "model": "...", "ocr": false, "steps": [{"role": "assistant", "label": "...", "text": "..."}]}]}`;

type Excerpt = { from: string; to: string; title: string; description: string; notes?: Record<string, string> };

function reportPrompt(report: Report) {
  let p = 0;
  let b = 0;
  const lines = [`Report: ${report.title}`, `Model: ${report.scope ?? 'not given'}`, ''];
  for (const item of report.items) {
    if (item.kind === 'heading') lines.push(`[H] ${item.text}`);
    else if (item.kind === 'paragraph') lines.push(`[P${++p}] ${item.text}`);
    else {
      const text = item.text.length > 1500 ? `${item.text.slice(0, 1500)} …` : item.text;
      lines.push(`[B${++b}] (${item.label})\n${text}`);
    }
  }
  return lines.join('\n');
}

/** Checks that the excerpts use each block once, in order. Returns the problem, or null. */
function checkExcerpts(excerpts: Excerpt[], blocks: number): string | null {
  let next = 1;
  for (const e of excerpts) {
    const from = Number(e.from?.slice(1));
    const to = Number(e.to?.slice(1));
    if (from !== next || !(to >= from)) return `excerpt "${e.title}" is ${e.from}-${e.to}; it must start at B${next}`;
    if (!e.title || !e.description) return `excerpt ${e.from}-${e.to} needs a title and a description`;
    next = to + 1;
  }
  return next === blocks + 1 ? null : `the excerpts end at B${next - 1}, not B${blocks}`;
}

async function reportLogs(key: string, model: string[], report: Report, src: OrgSource): Promise<IncidentLog[]> {
  const blocks = report.items.filter((i) => i.kind === 'block');
  const prompt = reportPrompt(report);
  const excerpts = await cached(`${key}.groups`, model + GROUP_SYSTEM + prompt, async () => {
    let problem: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const text = problem
        ? `${prompt}\n\nYour last reply was wrong: ${problem}. Reply again with all blocks.`
        : prompt;
      const reply = json<{ excerpts: Excerpt[] }>(await ask(model, GROUP_SYSTEM, [{ type: 'text', text }]));
      problem = checkExcerpts(reply.excerpts ?? [], blocks.length);
      if (!problem) return reply.excerpts;
    }
    throw new Error(`${key}: ${problem}`);
  });
  const reportModelName = reportModel(report.scope);
  return excerpts.map((e) => {
    const steps: IncidentLogStep[] = [];
    for (let n = Number(e.from.slice(1)); n <= Number(e.to.slice(1)); n++) {
      const note = e.notes?.[`B${n}`]?.trim();
      if (note) steps.push({ role: 'note', text: note });
      const b = blocks[n - 1];
      steps.push({ role: b.role, label: b.label, text: b.text });
    }
    return {
      title: e.title.trim(),
      description: e.description.trim(),
      source: src,
      ...(reportModelName && { model: reportModelName }),
      steps: steps as IncidentLog['steps'],
    };
  });
}

type Draft = Omit<IncidentLog, 'source'>;

function incidentFacts(org: OrgFile, i: Incident) {
  return [
    `Incident: ${i.title}`,
    `Organization: ${org.name}`,
    `Models: ${i.models.join(', ') || 'not named'}`,
    `Summary: ${String(i.summary)}`,
  ].join('\n');
}

/** Excerpts from one source that is not a misalignment report with blocks. Steps that are not in
 * the source text (and not read from an image) are dropped, and so are excerpts with none left. */
async function extractLogs(
  key: string,
  model: string[],
  org: OrgFile,
  i: Incident,
  src: OrgSource,
  text: string,
  images: string[],
  already: IncidentLog[],
  pdf = false,
): Promise<IncidentLog[]> {
  const parts: Part[] = [];
  for (const [n, url] of images.slice(0, 8).entries()) {
    const part = await image(url);
    if (part) parts.push({ type: 'text', text: `Image ${n + 1}:` }, part);
  }
  const before = already.length
    ? `\nExcerpts that we already have from other sources (do not repeat them):\n${already.map((l) => `- ${l.title}: ${l.steps[0].text.slice(0, 120)}`).join('\n')}\n`
    : '';
  const chunks: string[] = [];
  for (let at = 0; at < text.length; at += CHUNK - 5000) chunks.push(text.slice(at, at + CHUNK));
  const out: IncidentLog[] = [];
  for (const [n, chunk] of chunks.entries()) {
    const head = `${incidentFacts(org, i)}\n${before}\nSource: ${src.title ?? ''} (${src.url})${chunks.length > 1 ? `, part ${n + 1} of ${chunks.length}` : ''}\n\n`;
    const prompt = `${head}${chunk}`;
    const drafts = await cached(
      `${key}.${sha(src.url)}.${n}`,
      model + EXTRACT_SYSTEM + prompt + images.join(),
      async () =>
        json<{ logs: Draft[] }>(
          await ask(model, EXTRACT_SYSTEM, [{ type: 'text', text: prompt }, ...(n === 0 ? parts : [])]),
        ).logs ?? [],
    );
    for (const d of drafts) {
      const steps = (d.steps ?? []).filter((s) => {
        if (!s?.text?.trim() || !s.role) return false;
        if (d.ocr || s.role === 'note') return true;
        const missing = missingParts(s.text, text);
        if (missing.length) console.log(`    drop step (not in source): ${missing[0].slice(0, 100)}`);
        return missing.length === 0;
      });
      // A quoted word or two is not a log.
      if (steps.reduce((n, s) => n + s.text.trim().length, 0) < 30) continue;
      out.push({
        title: d.title.trim(),
        description: d.description.trim(),
        source: src,
        ...(d.model && { model: d.model }),
        ...(d.ocr && { ocr: true }),
        steps: steps.map((s) => ({
          role: s.role,
          ...(s.label && { label: s.label }),
          text: (pdf && !s.role.startsWith('tool_') ? unwrapPdf(s.text) : s.text).trim(),
        })) as IncidentLog['steps'],
      });
    }
  }
  return out;
}

/** All sources of an incident, with no repeats: primary sources first. */
function incidentSources(i: Incident): OrgSource[] {
  const seen = new Map<string, OrgSource>();
  // A timeline event's source can be its URL alone.
  for (const x of [...i.sources, ...i.timeline.flatMap((e) => e.sources ?? [])]) {
    const s: OrgSource = typeof x === 'string' ? { url: x } : x;
    if (!seen.has(s.url)) seen.set(s.url, s);
  }
  const all = [...seen.values()];
  return [...all.filter((s) => primary(s.url)), ...all.filter((s) => !primary(s.url))];
}

async function incidentLogs(org: OrgFile, i: Incident): Promise<IncidentLog[]> {
  const model = writer(org.slug, i.models);
  const key = `${org.slug}/${i.slug}`;
  const logs: IncidentLog[] = [];
  for (const src of incidentSources(i)) {
    // News stories only when the primary sources have no excerpts, and then only one story.
    if (!primary(src.url) && logs.length) break;
    if (/\/misalignment-reports\/?$/.test(src.url)) continue;
    const got = await source(src.url);
    if (got.kind === 'error') {
      console.log(`  ${src.url}: ${got.error}`);
      continue;
    }
    let found: IncidentLog[];
    if (got.kind === 'html' && isOpenAIReport(src.url)) {
      const report = parseReport(got.html);
      if (report.unread.length)
        throw new Error(
          `${src.url}: log blocks in a format that parseReport does not read (headings: ${[...new Set(report.unread)].join(', ')}). Add the format to parseReport.`,
        );
      if (report.items.some((x) => x.kind === 'block'))
        found = await reportLogs(`${key}.${sha(src.url)}`, model, report, src);
      else {
        const page = pageText(got.html, src.url);
        found = await extractLogs(key, model, org, i, src, page.text, page.images, logs);
      }
    } else if (got.kind === 'html') {
      const page = pageText(got.html, src.url);
      found = await extractLogs(key, model, org, i, src, page.text, page.images, logs);
    } else found = await extractLogs(key, model, org, i, src, got.text, [], logs, true);
    console.log(`  ${src.url}: ${found.length} excerpts, ${found.reduce((n, l) => n + l.steps.length, 0)} steps`);
    logs.push(...found);
  }
  return logs;
}

// ---------------------------------------------------------------------------------------------
// Descriptions

const DESCRIBE_SYSTEM = `You write the short description of an AI safety incident for its page on a website. The page also shows the title, date, categories, a short timeline and the sources.
Write 2 or 3 short sentences, at most 60 words, in one paragraph: what happened, who or what it affected, and the main result (a fix, a fine, a lawsuit, a statement), if there is one. Leave out details that a reader does not need. Do not repeat the title word for word. Do not list dates that the timeline shows, except the main one.
Link sources inline in Markdown, on the words that the source supports: "[OpenAI said](https://...) that ...". Use only URLs from the incident. At most one link in a sentence; one or two links in total.
Claims stay claims: "reportedly", "alleged", "according to", "said". Facts that the company confirmed or a court found can be plain. No opinions.
${STYLE}
Reply with JSON only: {"description": "..."}`;

const LINK = /\]\((https?:[^)\s]+)\)/g;

function checkDescription(text: string, urls: Set<string>): string | null {
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words > 75) return `it has ${words} words; write at most 60`;
  if (/\n\s*\n/.test(text)) return 'write one paragraph';
  const bad = [...text.matchAll(LINK)].map((m) => m[1]).filter((u) => !urls.has(u));
  return bad.length ? `these URLs are not from the incident: ${bad.join(', ')}` : null;
}

async function describe(org: OrgFile, i: Incident): Promise<string> {
  const model = writer(org.slug, i.models);
  const urls = new Set(incidentSources(i).map((s) => s.url));
  const { logs, ...fields } = i;
  const prompt = JSON.stringify({ organization: org.name, ...fields, hasLogExcerpts: Boolean(logs?.length) }, null, 1);
  return cached(`${org.slug}/${i.slug}.describe`, model + DESCRIBE_SYSTEM + prompt, async () => {
    let problem: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const text = problem ? `${prompt}\n\nYour last reply was wrong: ${problem}.` : prompt;
      const reply = json<{ description: string }>(await ask(model, DESCRIBE_SYSTEM, [{ type: 'text', text }], 4000));
      problem = checkDescription(reply.description?.trim() ?? '', urls);
      if (!problem) return reply.description.trim();
    }
    throw new Error(`${org.slug}/${i.slug}: ${problem}`);
  });
}

// ---------------------------------------------------------------------------------------------

async function pool<T>(items: T[], size: number, run: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) await run(items[next++]);
    }),
  );
}

async function main() {
  const [orgSlug, incidentSlug] = target === 'all' ? [undefined, undefined] : target.split('/');
  const slugs = orgSlug ? [orgSlug] : orgFiles().map((f) => f.replace(/\.json$/, ''));
  const failures: string[] = [];
  for (const slug of slugs) {
    const org = readOrg(slug);
    const picked = org.incidents.filter((i) =>
      incidentSlug ? i.slug === incidentSlug : command === 'describe' || i.primaryCategory.startsWith('model_'),
    );
    if (incidentSlug && !picked.length) throw new Error(`no incident ${target}`);
    if (!picked.length) continue;
    console.log(`${slug}: ${picked.length} incidents`);
    await pool(picked, 4, async (i) => {
      try {
        if (command === 'logs') {
          console.log(` ${slug}/${i.slug}`);
          const logs = await incidentLogs(org, i);
          if (logs.length) i.logs = logs;
          else delete i.logs;
          console.log(` ${slug}/${i.slug}: ${logs.length} excerpts`);
        } else {
          i.description = await describe(org, i);
          console.log(` ${slug}/${i.slug}: ${String(i.description)}`);
        }
      } catch (e) {
        failures.push(`${slug}/${i.slug}: ${e instanceof Error ? e.message : String(e)}`);
        console.log(` FAILED ${slug}/${i.slug}: ${e instanceof Error ? e.message : String(e)}`);
      }
    });
    if (WRITE) {
      const file = join(ORGS, `${slug}.json`);
      const field = command === 'logs' ? 'logs' : 'description';
      let text = readFileSync(file, 'utf8');
      for (const i of picked) text = setIncidentField(text, i.slug, field, i[field]);
      if (JSON.stringify(JSON.parse(text)) !== JSON.stringify(org)) throw new Error(`${file}: edit check failed`);
      writeFileSync(file, text);
    }
  }
  console.log('usage:', JSON.stringify(usage));
  if (failures.length) {
    console.log(`${failures.length} failed:\n${failures.join('\n')}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
