import { prisma } from '@/lib/db';

// The hourly limit for /api/report, for all senders together, after the per-IP limit of 1 a
// minute. It counts the `Submission` rows of the last hour, so no IP is stored.

export const REPORTS_PER_HOUR = 1000;
const HOUR_MS = 60 * 60 * 1000;

/** Null when a submission can go now, else why not. */
export async function reportLimitError(): Promise<string | null> {
  const sent = await prisma.submission.count({ where: { createdAt: { gt: new Date(Date.now() - HOUR_MS) } } });
  return sent >= REPORTS_PER_HOUR ? 'We got many submissions in the last hour. Try again later.' : null;
}
