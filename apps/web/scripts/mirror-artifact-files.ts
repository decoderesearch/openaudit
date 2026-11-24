// Saves a copy of each method artifact file in R2, so a download still works when the source
// repo changes or goes away. Without --apply, it only prints what it would do.
//
//   node scripts/with-env.mjs tsx scripts/mirror-artifact-files.ts [--apply] [--from <dir>]
//
// Reads the `files` of the artifacts in data/extracted/methods/*.json. A file with no copy comes
// from <dir> (--from: our fitted probes, found by name) or from its `url`. Its sha256 and size
// must match. It goes to artifacts/<sha256>/<name>, and --apply writes that key into `mirror`.
// Then import the seed. A recorded copy that is not in R2 is an error.
import { r2Put, r2Size } from '@/lib/server/r2';
import type { MethodArtifactFile } from '@openaudit/spec';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const EXTRACTED = join(ROOT, 'data', 'extracted', 'methods');
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const FROM = args.includes('--from') ? args[args.indexOf('--from') + 1] : undefined;

type Extracted = { source: unknown; artifacts: { key: string; files?: MethodArtifactFile[] }[] };

const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const keyOf = (f: MethodArtifactFile) => `artifacts/${f.sha256}/${f.name}`;

/** The paths of the files under `dir`, by file name. */
function localFiles(dir: string) {
  const out = new Map<string, string[]>();
  for (const e of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (e.isFile()) out.set(e.name, [...(out.get(e.name) ?? []), join(e.parentPath, e.name)]);
  }
  return out;
}

/** The file's bytes, from --from or its `url`, or why we could not get them. */
async function bytesOf(f: MethodArtifactFile, local: Map<string, string[]>): Promise<Uint8Array | string> {
  for (const path of local.get(f.name) ?? []) {
    const b = readFileSync(path);
    if (sha256(b) === f.sha256) return b;
  }
  if (!f.url) return `not in ${FROM ?? '--from'} and no url`;
  const res = await fetch(f.url, { redirect: 'follow', signal: AbortSignal.timeout(300_000) });
  if (!res.ok) return `${res.status} from ${f.url}`;
  const b = new Uint8Array(await res.arrayBuffer());
  if (b.length !== f.bytes) return `${b.length} bytes from ${f.url}, not ${f.bytes}`;
  if (sha256(b) !== f.sha256) return `the sha256 of ${f.url} is not ${f.sha256}`;
  return b;
}

/** The JSON text in the layout of `old`: one artifact on each line, or indented. */
function layout(old: string, x: Extracted) {
  if (!old.includes('"artifacts":[\n')) return `${JSON.stringify(x, null, 2)}\n`;
  return `{"source":${JSON.stringify(x.source)},"artifacts":[\n${x.artifacts.map((a) => JSON.stringify(a)).join(',\n')}\n]}\n`;
}

async function main() {
  console.log(`${APPLY ? 'Saving' : 'Dry run'}: bucket ${process.env.R2_BUCKET || 'openaudit'}\n`);
  const local = FROM ? localFiles(FROM) : new Map<string, string[]>();
  const tally = { saved: 0, same: 0, failed: 0, bytes: 0 };
  const failed: string[] = [];
  for (const name of readdirSync(EXTRACTED)
    .filter((n) => n.endsWith('.json'))
    .sort()) {
    const path = join(EXTRACTED, name);
    const old = readFileSync(path, 'utf8');
    const x = JSON.parse(old) as Extracted;
    const files = x.artifacts.flatMap((a) => (a.files ?? []).map((f) => ({ a, f })));
    if (!files.length) continue;
    let changed = 0;
    const queue = [...files];
    await Promise.all(
      Array.from({ length: 8 }, async () => {
        for (let item = queue.shift(); item; item = queue.shift()) {
          const { a, f } = item;
          const key = keyOf(f);
          if ((await r2Size(key)) === f.bytes) {
            tally.same++;
            if (f.mirror !== key) {
              changed++;
              f.mirror = key;
            }
            continue;
          }
          if (f.mirror) {
            tally.failed++;
            failed.push(`${a.key}: ${f.mirror} is recorded, but R2 has no such file`);
            continue;
          }
          const b = await bytesOf(f, local);
          if (typeof b === 'string') {
            tally.failed++;
            failed.push(`${a.key}: ${b}`);
            continue;
          }
          tally.saved++;
          tally.bytes += b.length;
          console.log(`  new ${key} (${(b.length / 1e6).toFixed(2)} MB)`);
          if (!APPLY) continue;
          await r2Put(key, b, 'application/octet-stream');
          f.mirror = key;
          changed++;
        }
      }),
    );
    console.log(`${name}: ${files.length} files`);
    if (APPLY && changed) {
      writeFileSync(path, layout(old, x));
      console.log(`  wrote ${changed} mirror keys`);
    }
  }
  console.log(
    `\n${tally.saved} ${APPLY ? 'saved' : 'to save'} (${(tally.bytes / 1e6).toFixed(1)} MB), ` +
      `${tally.same} already in R2, ${tally.failed} failed.`,
  );
  for (const f of failed.sort()) console.log(`  failed ${f}`);
  if (failed.length) process.exitCode = 1;
  if (!APPLY) console.log('\nDry run. Add --apply to save.');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
