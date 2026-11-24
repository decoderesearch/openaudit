// Lists new posts on the incident pages that labs publish, which data/seed/orgs/<org>.json does not
// cite yet. Read only. Exit code 1 when there are new posts, so a scheduled job can act on it.
// To add a post, follow ADD_INCIDENT.md.
//   node data/scripts/check-incident-sources.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

const SOURCES = [
  {
    org: 'openai',
    index: 'https://alignment.openai.com/misalignment-reports/',
    link: /href="(\/misalignment-reports\/[a-z0-9-]+\/?)"/g,
  },
];

// Posts that we read and decided not to add, with the reason. A post here does not show again.
const SKIP = {};

const norm = (url) => url.replace(/\/+$/, '');

async function title(url) {
  const html = await (await fetch(url)).text();
  return (
    html
      .match(/<title>([^<]*)<\/title>/)?.[1]
      .replace(/\s*·.*$/, '')
      .trim() ?? ''
  );
}

let found = 0;
for (const s of SOURCES) {
  const res = await fetch(s.index);
  if (!res.ok) throw new Error(`${s.index}: HTTP ${res.status}`);
  const html = await res.text();
  const seed = readFileSync(join(ROOT, 'data', 'seed', 'orgs', `${s.org}.json`), 'utf8');
  const posts = [...new Set([...html.matchAll(s.link)].map((m) => new URL(m[1], s.index).href))];
  const skipped = new Set(Object.keys(SKIP).map(norm));
  const fresh = posts.filter((p) => !seed.includes(norm(p)) && !skipped.has(norm(p)));
  console.log(`${s.org}: ${posts.length} posts on ${s.index}, ${fresh.length} new`);
  for (const p of fresh) console.log(`  ${p}  ${await title(p)}`);
  found += fresh.length;
}
process.exitCode = found ? 1 : 0;
