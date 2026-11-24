import { prisma } from '@/lib/db';
import type { IssueStatus, KnownErrorItem } from '@/lib/sample-issues';
import { samplePath } from '@/lib/server/runs';

const sampleSelect = { id: true, split: true, sourceId: true, graded: true } as const;

type IssueRow = {
  id: string;
  kind: string;
  status: string;
  effect: string;
  note: string;
  source: string;
  evidence: unknown;
  evalSample: { id: string; split: string; sourceId: string; graded: number };
};

function toItem(r: IssueRow): KnownErrorItem {
  const ev = r.evidence as { failed?: number; graded?: number };
  return {
    id: r.id,
    href: samplePath(r.evalSample),
    split: r.evalSample.split,
    sourceId: r.evalSample.sourceId,
    graded: r.evalSample.graded,
    found: typeof ev.failed === 'number' && typeof ev.graded === 'number' ? `${ev.failed}/${ev.graded}` : null,
    kind: r.kind,
    status: r.status as IssueStatus,
    effect: r.effect,
    note: r.note,
    source: r.source,
  };
}

const bySample = (a: KnownErrorItem, b: KnownErrorItem) =>
  a.split.localeCompare(b.split) || a.sourceId.localeCompare(b.sourceId, 'en', { numeric: true });

/** The issues of the version's samples, by split and source id. `all`: also proposed and
 * rejected ones (staff); else only confirmed ones. */
export async function versionIssues(versionId: string, all = false): Promise<KnownErrorItem[]> {
  const rows = await prisma.evalSampleIssue.findMany({
    where: { evalSample: { evalVersionId: versionId }, ...(!all && { status: 'confirmed' }) },
    include: { evalSample: { select: sampleSelect } },
  });
  return rows.map(toItem).sort(bySample);
}

/** The issues with a note only where `canRead` lets the reader read their samples. */
export const withReadableNotes = (issues: KnownErrorItem[], canRead: (i: KnownErrorItem) => boolean) =>
  issues.map((i) => (canRead(i) ? i : { ...i, note: null }));

/** The issues of all evals and versions, with their eval, by eval and sample. `all`: also proposed
 * and rejected ones (staff); else only confirmed ones. */
export async function allIssues(all = false): Promise<KnownErrorItem[]> {
  const rows = await prisma.evalSampleIssue.findMany({
    where: all ? {} : { status: 'confirmed' },
    include: {
      evalSample: {
        select: {
          ...sampleSelect,
          evalVersion: { select: { version: true, eval: { select: { slug: true, displayName: true } } } },
        },
      },
    },
  });
  return rows
    .map((r) => {
      const v = r.evalSample.evalVersion;
      return { ...toItem(r), eval: { slug: v.eval.slug, name: v.eval.displayName, version: v.version } };
    })
    .sort(
      (a, b) =>
        a.eval.name.localeCompare(b.eval.name) || a.eval.version.localeCompare(b.eval.version) || bySample(a, b),
    );
}

/** The number of the version's issues with each status. */
export async function issueCounts(versionId: string): Promise<Record<IssueStatus, number>> {
  const rows = await prisma.evalSampleIssue.groupBy({
    by: ['status'],
    where: { evalSample: { evalVersionId: versionId } },
    _count: true,
  });
  const counts = { proposed: 0, confirmed: 0, rejected: 0 };
  for (const r of rows) counts[r.status as IssueStatus] = r._count;
  return counts;
}

/** Sets the status of the issues (of one version) and the samples' failed counts again. Returns
 * the number of issues that changed. */
export async function reviewIssues(versionId: string, ids: string[], status: IssueStatus, reviewer: string) {
  const { count } = await prisma.evalSampleIssue.updateMany({
    where: { id: { in: ids }, status: { not: status }, evalSample: { evalVersionId: versionId } },
    data: { status, reviewedBy: reviewer, reviewedAt: new Date() },
  });
  if (count) await prisma.$queryRaw`SELECT refresh_sample_stats(${versionId}::uuid)`;
  return count;
}

/** Like reviewIssues, for issues of any versions. Returns the number that changed and the slugs
 * of their evals. */
export async function reviewIssuesAnyVersion(ids: string[], status: IssueStatus, reviewer: string) {
  const rows = await prisma.evalSampleIssue.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      evalSample: { select: { evalVersionId: true, evalVersion: { select: { eval: { select: { slug: true } } } } } },
    },
  });
  const byVersion = new Map<string, { slug: string; ids: string[] }>();
  for (const r of rows) {
    const v = r.evalSample.evalVersionId;
    const group = byVersion.get(v) ?? { slug: r.evalSample.evalVersion.eval.slug, ids: [] };
    group.ids.push(r.id);
    byVersion.set(v, group);
  }
  let changed = 0;
  for (const [versionId, g] of byVersion) changed += await reviewIssues(versionId, g.ids, status, reviewer);
  return { changed, slugs: [...new Set([...byVersion.values()].map((g) => g.slug))] };
}
