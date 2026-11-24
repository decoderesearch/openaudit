// Reads each seed eval's dataset terms on showing samples, into data/extracted/dataset-terms.json.
//   node spec/scripts/dataset-terms.mjs [<slug>...]
// Sources: the Hugging Face gate prompt and README, or the GitHub README; also the repos that
// suites and runner tasks load. check-eval-seed fails
// when a source has terms like these and the eval version has no `sampleTerms` rule for them.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const EVALS = join(ROOT, 'data', 'seed', 'evals');
const OUT = join(ROOT, 'data', 'extracted', 'dataset-terms.json');

// Datasets inside a suite, by the sample metadata value the Inspect task sets.
const SUBSETS = {
  abstentionbench: [{ key: 'dataset_name', value: 'GPQA', hfRepo: 'Idavidrein/gpqa' }],
};

// Other repos that the eval's runner task loads, when not the seed's dataset.
const LOADS = {
  xstest: ['walledai/XSTest'],
};

const VERB = '(?:reveal|post|share|publish|upload|re-?distribute|repost|disclose|display|put)';
const OBJECT = '(?:online|internet|web|plain ?text|public|examples?|samples?|questions?|answers?|data(?:set)?)';
const RESTRICT = [
  new RegExp(`\\b(?:do not|don't|must not|should not|may not|never|refrain from|not to)\\b[^.\\n]{0,80}\\b${VERB}\\b[^.\\n]{0,160}\\b${OBJECT}\\b`, 'i'),
  /\bplain ?text\b[^.\n]{0,120}\bonline\b/i,
  /\b(?:not|never) be (?:posted|shared|published|redistributed|made public)\b/i,
];
const CANARY = /\bcanary\b/i;

const argv = process.argv.slice(2);
const only = new Set(argv);

async function text(url) {
  const res = await fetch(url, { redirect: 'follow' });
  return res.ok ? res.text() : null;
}

function sentences(md) {
  return md
    .replace(/<[^>]+>/g, ' ')
    .split(/\n\s*\n|(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

const quotesIn = (md) => (md ? sentences(md).filter((s) => RESTRICT.some((r) => r.test(s))) : []);

async function hfTerms(repo, revision = 'main') {
  const info = await fetch(`https://huggingface.co/api/datasets/${repo}`).then((r) => (r.ok ? r.json() : null));
  const readmeUrl = `https://huggingface.co/datasets/${repo}/blob/${revision}/README.md`;
  const readme = await text(`https://huggingface.co/datasets/${repo}/raw/${revision}/README.md`);
  const prompt = info?.cardData?.extra_gated_prompt ?? null;
  return {
    source: `https://huggingface.co/datasets/${repo}`,
    readme: readme ? readmeUrl : null,
    gated: info?.gated || false,
    ...(prompt && { gatePrompt: prompt.trim() }),
    quotes: [...new Set([...quotesIn(prompt), ...quotesIn(readme)])],
    canary: CANARY.test(readme ?? ''),
  };
}

async function githubTerms(url) {
  const m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/#?]+)/);
  if (!m) return null;
  const [owner, repo] = [m[1], m[2].replace(/\.git$/, '')];
  for (const name of ['README.md', 'readme.md', 'README.rst', 'README']) {
    const readme = await text(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${name}`);
    if (readme)
      return {
        source: `https://github.com/${owner}/${repo}`,
        readme: `https://github.com/${owner}/${repo}/blob/HEAD/${name}`,
        gated: false,
        quotes: quotesIn(readme),
        canary: CANARY.test(readme),
      };
  }
  return { source: `https://github.com/${owner}/${repo}`, readme: null, gated: false, quotes: [], canary: false };
}

async function termsFor(dataset) {
  if (dataset?.hfRepo) return hfTerms(dataset.hfRepo, dataset.revision);
  if (dataset?.url) return githubTerms(dataset.url);
  return null;
}

const old = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')).entries : [];
const entries = old.filter((e) => only.size && !only.has(e.slug));
for (const file of readdirSync(EVALS).filter((f) => f.endsWith('.json')).sort()) {
  const seed = JSON.parse(readFileSync(join(EVALS, file), 'utf8'));
  const slug = seed.eval.slug;
  if (only.size && !only.has(slug)) continue;
  for (const v of seed.versions) {
    const found = await termsFor(v.dataset);
    if (!found) continue;
    const subsets = [];
    for (const s of SUBSETS[slug] ?? []) {
      const t = await hfTerms(s.hfRepo);
      subsets.push({ key: s.key, value: s.value, ...t });
    }
    const loads = [];
    for (const repo of v.runner ? (LOADS[slug] ?? []) : []) loads.push(await hfTerms(repo));
    entries.push({
      slug,
      version: v.version,
      ...found,
      ...(subsets.length && { subsets }),
      ...(loads.length && { loads }),
    });
    const flags = [found.gated && 'gated', found.quotes.length && `${found.quotes.length} quotes`, found.canary && 'canary']
      .concat(subsets.filter((s) => s.gated || s.quotes.length).map((s) => `subset ${s.value}`))
      .concat(loads.filter((s) => s.gated || s.quotes.length).map((s) => `loads ${s.source}`))
      .filter(Boolean);
    console.log(`${slug} ${v.version}: ${flags.join(', ') || '-'}`);
  }
}
entries.sort((a, b) => a.slug.localeCompare(b.slug) || a.version.localeCompare(b.version));
writeFileSync(OUT, `${JSON.stringify({ fetchedAt: new Date().toISOString(), entries }, null, 2)}\n`);
console.log(`Wrote ${entries.length} entries to ${OUT}`);
