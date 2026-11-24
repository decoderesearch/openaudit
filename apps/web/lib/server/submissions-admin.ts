import { prisma } from '@/lib/db';
import { SUBMISSION_STATUSES, type SubmissionStatus } from '@/lib/report';

// The admin list of submissions from the navbar's Submit form, and its status changes.

const LIST_LIMIT = 300;

/** The newest submissions, with one status or all. */
export async function adminSubmissions(status: SubmissionStatus | null) {
  const where = status ? { status } : {};
  const [rows, counts] = await Promise.all([
    prisma.submission.findMany({ where, orderBy: { createdAt: 'desc' }, take: LIST_LIMIT }),
    prisma.submission.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  const byStatus = Object.fromEntries(SUBMISSION_STATUSES.map((s) => [s.id, 0])) as Record<SubmissionStatus, number>;
  for (const c of counts) byStatus[c.status as SubmissionStatus] = c._count._all;
  return {
    byStatus,
    rows: rows.map((r) => ({ ...r, fields: (r.fields ?? {}) as Record<string, string> })),
  };
}

/** Sets the status and the admin note. False when there is no such submission. */
export async function setSubmissionState(id: string, status: SubmissionStatus, note: string): Promise<boolean> {
  const { count } = await prisma.submission.updateMany({
    where: { id },
    data: { status, note: note.trim() || null },
  });
  return count === 1;
}
