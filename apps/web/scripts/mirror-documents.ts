// Saves a copy of each document in R2, so page links still work when a publisher's link breaks.
// Without --apply, it only prints what it would do.
//
//   node scripts/with-env.mjs tsx scripts/mirror-documents.ts [--apply] [--only <keys>] [--local <dir>]
//
// The file comes from the first of: <dir>/<key>/doc.pdf (--local: the PDF an extraction read),
// the extraction's `fileUrl`, then the document's `url` (arXiv, GitHub and Hub links go to the PDF).
// PDFs and web pages are both saved. A site that blocks scripts (403) is listed and skipped.
// Each file also goes to data/cache/documents/<key>.<pdf|html>, for extraction and
// spec/scripts/locate-pages.mjs. The document row gets fileKey, fileType, fileUrl, sha256, fetchedAt.
import { PrismaClient } from '#prisma';
import { r2Delete, r2Put, r2Size } from '@/lib/server/r2';
import { PrismaPg } from '@prisma/adapter-pg';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const CACHE = join(ROOT, 'data', 'cache', 'documents');
const EXTRACTED = join(ROOT, 'data', 'extracted', 'system-cards');
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const arg = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const ONLY = arg('--only')?.split(',');
const LOCAL = arg('--local');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36';
const TYPES = { pdf: 'application/pdf', html: 'text/html; charset=utf-8' } as const;
type FileType = keyof typeof TYPES;

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

/** The file itself, for a link to a viewer page: arXiv abstracts, GitHub and Hub PDF blobs. */
function directUrl(url: string) {
  return url
    .replace(/^https?:\/\/arxiv\.org\/abs\//, 'https://arxiv.org/pdf/')
    .replace(/^(https:\/\/github\.com\/[^/]+\/[^/]+)\/blob\/(.+\.pdf)$/i, '$1/raw/$2')
    .replace(/^(https:\/\/huggingface\.co\/.+)\/blob\/(.+\.pdf)$/i, '$1/resolve/$2');
}

type Got = { bytes: Buffer; type: FileType; url: string };

async function download(url: string): Promise<Got | string> {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) return `${res.status} from ${url}`;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.subarray(0, 5).toString() === '%PDF-') return { bytes, type: 'pdf', url };
    if ((res.headers.get('content-type') ?? '').includes('text/html')) return { bytes, type: 'html', url };
    return `not a PDF or web page (${res.headers.get('content-type')}) at ${url}`;
  } catch (e) {
    return `${(e as Error).name} for ${url}`;
  }
}

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');

type Doc = { id: string; key: string; url: string; fileKey: string | null; sha256: string | null };

/** The file to save, where it came from, and a note when it is not what the link now serves. */
async function fileFor(doc: Doc): Promise<{ got: Got; fileUrl?: string; note?: string } | string> {
  const extraction = join(EXTRACTED, `${doc.key}.json`);
  const x = existsSync(extraction)
    ? (JSON.parse(readFileSync(extraction, 'utf8')) as { fileUrl?: string; pageCount?: number })
    : undefined;
  const urls = [...new Set([x?.fileUrl, directUrl(doc.url)].filter((u): u is string => !!u))];
  let remote: Got | string = 'no URL';
  for (const u of urls) {
    remote = await download(u);
    if (typeof remote !== 'string' && (remote.type === 'pdf' || u === urls.at(-1))) break;
  }
  // Only when the extraction read a PDF (it has a page count): a folder can hold other PDFs.
  const local = LOCAL && x?.pageCount && join(LOCAL, doc.key, 'doc.pdf');
  if (local && existsSync(local)) {
    const bytes = readFileSync(local);
    const same = typeof remote !== 'string' && remote.type === 'pdf' && sha256(remote.bytes) === sha256(bytes);
    const fileUrl = same ? (remote as Got).url : x?.fileUrl;
    return {
      got: { bytes, type: 'pdf', url: fileUrl ?? doc.url },
      ...(fileUrl && fileUrl !== doc.url && { fileUrl }),
      ...(!same && { note: 'saved the extracted PDF; no link we know serves the same file' }),
    };
  }
  if (typeof remote === 'string') return remote;
  const note =
    (x?.pageCount ?? 0) > 1 && remote.type === 'html' ? 'the extraction read a PDF; set fileUrl in it' : undefined;
  return { got: remote, ...(remote.url !== doc.url && { fileUrl: remote.url }), ...(note && { note }) };
}

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? 'postgres://unset').host;
  console.log(`${APPLY ? 'Saving' : 'Dry run'}: database ${host}, bucket ${process.env.R2_BUCKET}\n`);
  const docs: Doc[] = await prisma.document.findMany({
    where: ONLY ? { key: { in: ONLY } } : {},
    select: { id: true, key: true, url: true, fileKey: true, sha256: true },
    orderBy: { key: 'asc' },
  });
  mkdirSync(CACHE, { recursive: true });
  const tally = { saved: 0, same: 0, failed: 0, pdf: 0, html: 0 };
  const failed: string[] = [];
  const notes: string[] = [];
  const queue = [...docs];
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      for (let doc = queue.shift(); doc; doc = queue.shift()) {
        const r = await fileFor(doc);
        if (typeof r === 'string') {
          tally.failed++;
          failed.push(`${doc.key}: ${r}`);
          continue;
        }
        const { got, fileUrl, note } = r;
        if (note) notes.push(`${doc.key}: ${note}`);
        tally[got.type]++;
        const hash = sha256(got.bytes);
        const fileKey = `documents/${doc.key}.${got.type}`;
        if (APPLY) writeFileSync(join(CACHE, `${doc.key}.${got.type}`), got.bytes);
        if (doc.sha256 === hash && doc.fileKey === fileKey && (await r2Size(fileKey)) === got.bytes.length) {
          tally.same++;
          continue;
        }
        tally.saved++;
        console.log(`  ${doc.fileKey ? 'update' : 'new   '} ${fileKey} (${(got.bytes.length / 1e6).toFixed(1)} MB)`);
        if (!APPLY) continue;
        await r2Put(fileKey, got.bytes, TYPES[got.type]);
        await prisma.document.update({
          where: { id: doc.id },
          data: { fileKey, fileType: got.type, fileUrl: fileUrl ?? null, sha256: hash, fetchedAt: new Date() },
        });
        if (doc.fileKey && doc.fileKey !== fileKey) {
          await r2Delete(doc.fileKey);
          rmSync(join(CACHE, doc.fileKey.replace(/^documents\//, '')), { force: true });
        }
      }
    }),
  );
  console.log(
    `\n${docs.length} documents: ${tally.saved} ${APPLY ? 'saved' : 'to save'}, ${tally.same} unchanged, ` +
      `${tally.failed} failed. ${tally.pdf} PDFs, ${tally.html} web pages.`,
  );
  for (const n of notes.sort()) console.log(`  note ${n}`);
  for (const f of failed.sort()) console.log(`  failed ${f}`);
  if (!APPLY) console.log('\nDry run. Add --apply to save.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
