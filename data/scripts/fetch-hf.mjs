// Reads Hub metadata for every HF repo in data/seed/system_cards.json (models and checkpoints)
// and writes data/seed/hf_snapshot.json: parent tags, license, parameters, context, architecture
// and creation date. `--created`: add only the creation date to the repos already in the file.
// Read only. Uses the token in HF_TOKEN or ~/.cache/huggingface/token for gated repos.
//   node data/scripts/fetch-hf.mjs [--only <repo>] [--created]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUT = join(ROOT, 'data', 'seed', 'hf_snapshot.json');
const seed = JSON.parse(readFileSync(join(ROOT, 'data', 'seed', 'system_cards.json'), 'utf8'));
const tokenFile = join(homedir(), '.cache', 'huggingface', 'token');
const token = process.env.HF_TOKEN ?? (existsSync(tokenFile) ? readFileSync(tokenFile, 'utf8').trim() : undefined);
const headers = token ? { Authorization: `Bearer ${token}` } : {};

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : undefined;
const createdOnly = process.argv.includes('--created');
const repos = [
  ...new Set(seed.models.filter((m) => m.source === 'hf').flatMap((m) => [m.id, ...m.checkpoints])),
].filter((r) => !only || r === only);

async function get(url) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers, redirect: 'follow' });
    if (res.status === 429 && attempt < 5) {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
      continue;
    }
    return res;
  }
}

/** The first number found under any of `keys`, in the config or its text config. */
function pick(config, keys) {
  for (const c of [config, config?.text_config, config?.llm_config, config?.language_config]) {
    for (const k of keys) if (typeof c?.[k] === 'number') return c[k];
  }
  return undefined;
}

async function read(repo) {
  const res = await get(`https://huggingface.co/api/models/${repo}`);
  if (!res.ok) return { status: res.status };
  const info = await res.json();
  const parents = (info.tags ?? [])
    .map((t) => /^base_model:(quantized|adapter|finetune|merge):(.+)$/.exec(t))
    .filter(Boolean)
    .map(([, relation, parent]) => ({ relation, parent }));
  const out = {
    status: 200,
    ...(info.id !== repo && { movedTo: info.id }),
    sha: info.sha,
    ...(info.createdAt && { createdAt: info.createdAt }),
    parents,
    ...(info.cardData?.license && { license: String(info.cardData.license) }),
    ...(info.safetensors?.total && { totalParams: info.safetensors.total }),
    ...(info.gated && { gated: String(info.gated) }),
  };
  const cfgRes = await get(`https://huggingface.co/${repo}/resolve/main/config.json`);
  if (cfgRes.ok) {
    const config = await cfgRes.json().catch(() => undefined);
    const arch = config?.architectures?.[0] ?? info.config?.architectures?.[0];
    const experts = pick(config, ['num_experts', 'n_routed_experts', 'num_local_experts', 'moe_num_experts']);
    const perToken = pick(config, ['num_experts_per_tok', 'moe_topk', 'num_experts_per_token']);
    const context = pick(config, ['max_position_embeddings', 'max_sequence_length', 'seq_length', 'n_positions']);
    if (arch) out.architecture = experts ? `${arch}, ${experts} experts${perToken ? `, ${perToken} per token` : ''}` : arch;
    if (context) out.contextWindow = context;
  } else {
    out.configStatus = cfgRes.status;
  }
  return out;
}

const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')).repos : {};
const results = { ...previous };
let done = 0;
const queue = [...repos];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const repo = queue.shift();
      try {
        if (createdOnly) {
          if (previous[repo]?.status !== 200) continue;
          const res = await get(`https://huggingface.co/api/models/${repo}`);
          const createdAt = res.ok ? (await res.json()).createdAt : undefined;
          if (createdAt) results[repo] = { ...previous[repo], createdAt };
        } else {
          results[repo] = await read(repo);
        }
      } catch (e) {
        results[repo] = { status: 0, error: String(e) };
      }
      if (++done % 50 === 0) console.log(`${done}/${repos.length}`);
    }
  }),
);
const sorted = Object.fromEntries(Object.entries(results).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(OUT, `${JSON.stringify({ fetchedAt: new Date().toISOString(), repos: sorted }, null, 1)}\n`);
const bad = Object.entries(sorted).filter(([, v]) => v.status !== 200);
console.log(`Wrote ${OUT}: ${Object.keys(sorted).length} repos, ${bad.length} not found or refused`);
for (const [repo, v] of bad) console.log(`  ${v.status} ${repo}`);
