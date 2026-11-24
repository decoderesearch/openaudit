// Loads the verdicts of a sample review as proposed known errors (EVAL_KNOWN_ERRORS.md). The file
// is a JSON array of { slug?, split?, sourceId, verdict, reason }. Only the verdicts that are
// dataset errors load; a sample that has an issue already keeps it. With --replace, a new review
// replaces a proposed issue of an LLM review, and deletes it when the verdict is not a dataset
// error. Staff reviews do not change. A dry run by default.
//   node scripts/with-env.mjs pnpm exec tsx scripts/load-sample-issues.ts <file> [--slug x] [--replace] [--apply]
import { PrismaClient } from '#prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--slug');
const slugArg = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : undefined;
const apply = args.includes('--apply');
const replace = args.includes('--replace');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

/** The review verdicts that are errors in the dataset, and their issue kind. */
const KINDS: Record<string, string> = {
  label_error: 'label_error',
  missing_context: 'missing_context',
  prompt_conflict: 'prompt_conflict',
  grader_error: 'grader_error',
};

type Verdict = { slug?: string; split?: string; sourceId: string; verdict: string; reason: string };

async function main() {
  if (!file) throw new Error('Give the verdicts file.');
  const all = JSON.parse(readFileSync(file, 'utf8')) as Verdict[];
  const verdicts = replace ? all : all.filter((v) => KINDS[v.verdict]);
  const slugs = [...new Set(verdicts.map((v) => v.slug ?? slugArg))];
  if (slugs.some((s) => !s)) throw new Error('Give --slug, or a slug in each verdict.');
  const rows = [];
  const updates: { id: string; kind: string; note: string; evidence: object }[] = [];
  const deletes: string[] = [];
  const missing: string[] = [];
  for (const slug of slugs as string[]) {
    const version = await prisma.evalVersion.findFirst({
      where: { eval: { slug } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, version: true },
    });
    if (!version) throw new Error(`No eval ${slug}.`);
    const mine = verdicts.filter((v) => (v.slug ?? slugArg) === slug);
    const samples = await prisma.evalSample.findMany({
      where: { evalVersionId: version.id, sourceId: { in: mine.map((v) => v.sourceId) } },
      select: {
        id: true,
        split: true,
        sourceId: true,
        graded: true,
        failed: true,
        issue: { select: { id: true, kind: true, status: true, source: true } },
      },
    });
    for (const v of mine) {
      const found = samples.filter((s) => s.sourceId === v.sourceId && (!v.split || s.split === v.split));
      if (found.length !== 1) {
        missing.push(`${slug}/${v.sourceId} (${found.length} samples)`);
        continue;
      }
      const s = found[0]!;
      const kind = KINDS[v.verdict];
      const evidence = { verdict: v.verdict, failed: s.failed, graded: s.graded, review: basename(file) };
      if (s.issue) {
        if (!replace || s.issue.status !== 'proposed' || s.issue.source !== 'llm_review') continue;
        if (kind) updates.push({ id: s.issue.id, kind, note: v.reason.trim(), evidence });
        else deletes.push(s.issue.id);
        console.log(`${kind ? 'Replace' : 'Delete'} ${slug}/${v.sourceId}: ${s.issue.kind} -> ${v.verdict}`);
        continue;
      }
      if (kind) rows.push({ evalSampleId: s.id, kind, note: v.reason.trim(), source: 'llm_review', evidence });
    }
    console.log(
      `${slug}@${version.version}: ${mine.filter((v) => KINDS[v.verdict]).length} dataset errors in the file.`,
    );
  }
  for (const m of missing) console.log(`Not found or not unique: ${m}`);
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
  const by = [...counts].map(([k, n]) => `${n} ${k}`);
  console.log(`New proposed issues: ${rows.length}${rows.length ? ` (${by.join(', ')})` : ''}.`);
  if (replace) console.log(`Replaced: ${updates.length}. Deleted: ${deletes.length}.`);
  if (!apply) return console.log('Dry run. Give --apply to write.');
  const { count } = await prisma.evalSampleIssue.createMany({ data: rows, skipDuplicates: true });
  for (const u of updates)
    await prisma.evalSampleIssue.update({
      where: { id: u.id, status: 'proposed' },
      data: { kind: u.kind, note: u.note, evidence: u.evidence },
    });
  if (deletes.length) await prisma.evalSampleIssue.deleteMany({ where: { id: { in: deletes }, status: 'proposed' } });
  console.log(`Wrote ${count}. Replaced ${updates.length}. Deleted ${deletes.length}.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
