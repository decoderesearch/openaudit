// Directions of reported results: which way is better for safety, and which way shows more skill.
// One line per (eval name, metric) key in data/extracted/result-directions.jsonl; the importer copies
// them onto each result. The prompt is data/extracted/result-direction-prompt.txt.
//
//   node spec/scripts/result-directions.mjs                  counts keys and results with no direction
//   node spec/scripts/result-directions.mjs todo [DIR]       writes those keys to DIR/in/batch-NN.jsonl
//   node spec/scripts/result-directions.mjs check IN OUT     checks one batch that an agent wrote
//   node spec/scripts/result-directions.mjs merge OUT...     adds checked batches to the file
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FILE = join(ROOT, 'data/extracted/result-directions.jsonl');
const CARDS = join(ROOT, 'data/extracted/system-cards');
const BATCH = 220;

// The importer's name match: case, spaces and punctuation do not count.
const norm = (s) =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
const keyOf = (r) => `${norm(r.rawEvalName)}|${norm(r.metric)}`;
const readLines = (f) =>
  readFileSync(f, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
const known = () => new Map((existsSync(FILE) ? readLines(FILE) : []).map((d) => [d.key, d]));

const KINDS = new Set([
  'harmful_request',
  'over_refusal',
  'misalignment',
  'honesty',
  'bias',
  'toxicity',
  'wellbeing',
  'safeguard',
  'dangerous_capability',
  'general_capability',
  'other',
]);
const SKILL = new Set(['dangerous_capability', 'general_capability']);
const DIRECTIONS = new Set(['higher_is_better', 'lower_is_better', 'nearer_zero_is_better', 'neither', 'unknown']);
// Kinds with no safety direction: skill, and refusals of safe requests.
const NO_SAFETY = new Set([...SKILL, 'over_refusal']);
const FIELDS = ['key', 'eval', 'metric', 'kind', 'safety', 'capability', 'why', 'bySetting'];

/** Each key in the card files, with its spellings, counts and sample rows. */
function cardKeys() {
  const evalByName = new Map();
  for (const f of readdirSync(join(ROOT, 'data/seed/evals'))) {
    const e = JSON.parse(readFileSync(join(ROOT, 'data/seed/evals', f), 'utf8')).eval;
    for (const n of [e.slug, e.displayName, ...e.aliases]) evalByName.set(norm(n), e.slug);
  }
  const keys = new Map();
  const count = (m, s) => m.set(s, (m.get(s) ?? 0) + 1);
  for (const f of readdirSync(CARDS).filter((f) => f.endsWith('.json'))) {
    const x = JSON.parse(readFileSync(join(CARDS, f), 'utf8'));
    for (const r of x.evalResults ?? []) {
      const k = keyOf(r);
      if (!keys.has(k))
        keys.set(k, {
          evals: new Map(),
          metrics: new Map(),
          others: new Map(),
          docs: new Set(),
          rows: [],
        });
      const e = keys.get(k);
      count(e.evals, r.rawEvalName);
      count(e.metrics, r.metric);
      if (r.settings?.other) count(e.others, r.settings.other);
      e.docs.add(x.document);
      e.rows.push({
        doc: x.document,
        model: r.model ?? r.rawModelName,
        value: r.value,
        unit: r.unit,
        settings: r.settings,
        quote: r.source?.quote,
      });
    }
  }
  const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  return [...keys.entries()]
    .map(([key, e]) => {
      // Up to 4 sample rows, from different documents, with quotes first.
      const samples = [];
      const docs = new Set();
      for (const r of [...e.rows].sort((a, b) => Number(!!b.quote) - Number(!!a.quote))) {
        if (docs.has(r.doc)) continue;
        docs.add(r.doc);
        samples.push({ ...r, quote: r.quote?.slice(0, 220) });
        if (samples.length === 4) break;
      }
      return {
        key,
        eval: top(e.evals)[0],
        metric: top(e.metrics)[0],
        spellings: {
          eval: top(e.evals).slice(1, 4),
          metric: top(e.metrics).slice(1, 4),
        },
        registry: evalByName.get(key.split('|')[0]),
        rows: e.rows.length,
        documents: e.docs.size,
        settingsOther: top(e.others).slice(0, 8),
        samples,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

/** Errors in one agent-written batch. */
function check(input, lines) {
  const errors = [];
  const byKey = new Map(input.map((x) => [x.key, x]));
  const seen = new Set();
  lines.forEach((x, i) => {
    const at = `line ${i + 1} (${x.key})`;
    for (const k of Object.keys(x)) if (!FIELDS.includes(k)) errors.push(`${at}: unknown field ${k}`);
    if (!KINDS.has(x.kind)) errors.push(`${at}: bad kind ${x.kind}`);
    for (const f of ['safety', 'capability']) if (!DIRECTIONS.has(x[f])) errors.push(`${at}: bad ${f} ${x[f]}`);
    if (NO_SAFETY.has(x.kind) && x.safety !== 'neither') errors.push(`${at}: safety must be neither for ${x.kind}`);
    if (typeof x.why !== 'string' || !x.why.trim()) errors.push(`${at}: no why`);
    else if (x.why.split(/\s+/).length > 20) errors.push(`${at}: why is longer than 15 words`);
    const src = byKey.get(x.key);
    if (!src) errors.push(`${at}: key is not in the input`);
    for (const [other, d] of Object.entries(x.bySetting ?? {})) {
      if (src && !src.settingsOther.includes(other))
        errors.push(`${at}: bySetting text not in settingsOther: ${other}`);
      for (const f of ['safety', 'capability'])
        if (!DIRECTIONS.has(d?.[f])) errors.push(`${at}: bySetting ${f} is bad`);
    }
    if (seen.has(x.key)) errors.push(`${at}: duplicate key`);
    seen.add(x.key);
  });
  const missing = input.filter((x) => !seen.has(x.key)).map((x) => x.key);
  if (missing.length) errors.push(`missing ${missing.length} keys: ${missing.slice(0, 10).join(', ')}`);
  return errors;
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'todo') {
  const dir = rest[0] ?? '/tmp/openaudit-directions';
  const have = known();
  const todo = cardKeys().filter((x) => !have.has(x.key));
  mkdirSync(join(dir, 'in'), { recursive: true });
  mkdirSync(join(dir, 'out'), { recursive: true });
  for (let i = 0; i * BATCH < todo.length; i++) {
    const part = todo.slice(i * BATCH, (i + 1) * BATCH);
    writeFileSync(
      join(dir, 'in', `batch-${String(i).padStart(2, '0')}.jsonl`),
      part.map((x) => JSON.stringify(x)).join('\n') + '\n',
    );
  }
  console.log(`${todo.length} keys need a direction; wrote ${Math.ceil(todo.length / BATCH)} batches to ${dir}/in`);
} else if (cmd === 'check') {
  const [inFile, outFile] = rest;
  let lines;
  try {
    lines = readLines(outFile);
  } catch (e) {
    console.log(`${outFile}: ${e.message}`);
    process.exit(1);
  }
  const errors = check(readLines(inFile), lines);
  for (const e of errors) console.log(e);
  console.log(errors.length ? `${errors.length} errors` : `OK: ${lines.length} keys`);
  process.exitCode = errors.length ? 1 : 0;
} else if (cmd === 'merge') {
  const all = known();
  let added = 0;
  for (const f of rest) {
    for (const d of readLines(f)) {
      const { key, eval: e, metric, kind, safety, capability, why, bySetting } = d;
      if (!all.has(key)) added++;
      all.set(key, {
        key,
        eval: e,
        metric,
        kind,
        safety,
        capability,
        why,
        ...(bySetting && { bySetting }),
      });
    }
  }
  const sorted = [...all.values()].sort((a, b) => a.key.localeCompare(b.key));
  writeFileSync(FILE, sorted.map((d) => JSON.stringify(d)).join('\n') + '\n');
  console.log(`${added} keys added; ${sorted.length} keys in ${FILE}`);
} else {
  const have = known();
  const keys = cardKeys();
  const todo = keys.filter((x) => !have.has(x.key));
  const unknown = [...have.values()].filter((d) => d.safety === 'unknown' || d.capability === 'unknown').length;
  console.log(
    `${keys.length} keys in the cards; ${todo.length} have no direction (${todo.reduce((s, x) => s + x.rows, 0)} results)`,
  );
  console.log(`${unknown} keys in the file have an "unknown" direction`);
  process.exitCode = todo.length ? 1 : 0;
}
