// Copies the Wikimedia Commons photos of departures in data/seed/orgs to public/photos, at the
// widths that `Photo` shows. Our own copy does not fail when Commons has no cached thumbnail.
// Gets only the missing files. Run: pnpm photos:commons

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { commonsThumb, localPhoto } from '../lib/org-research';

const here = dirname(fileURLToPath(import.meta.url));
const ORGS = join(here, '../../../data/seed/orgs');
const PUBLIC = join(here, '../public');
export const PHOTO_WIDTHS = [120, 250];

/** The Commons URLs of all departure photos in the seed. */
export function seedPhotos(): string[] {
  const urls = new Set<string>();
  for (const f of readdirSync(ORGS).filter((f) => f.endsWith('.json'))) {
    const org = JSON.parse(readFileSync(join(ORGS, f), 'utf8')) as { departures?: { image?: { url?: string } }[] };
    for (const d of org.departures ?? []) if (d.image?.url) urls.add(d.image.url);
  }
  return [...urls];
}

/** The path in `public` of each photo copy that `Photo` can show. */
export const photoFiles = () =>
  seedPhotos().flatMap((url) => PHOTO_WIDTHS.map((w) => ({ url: commonsThumb(url, w), path: localPhoto(url, w) })));

async function main() {
  mkdirSync(join(PUBLIC, 'photos'), { recursive: true });
  for (const { url, path } of photoFiles()) {
    if (!path || existsSync(join(PUBLIC, path))) continue;
    const res = await fetch(url, {
      headers: { 'user-agent': 'OpenAudit/1.0 (https://openaudit.com; support@openaudit.com)' },
    });
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    writeFileSync(join(PUBLIC, path), Buffer.from(await res.arrayBuffer()));
    console.log(`added ${path}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
