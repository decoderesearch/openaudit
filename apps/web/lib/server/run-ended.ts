import { prisma } from '@/lib/db';
import { emailTypeFor, sendRunEmail, type RunEmailResult } from '@/lib/server/run-emails';

export type RunEndedResult = {
  status: string;
  email: RunEmailResult | 'not_done';
};

/** What we do when a run ends: email the owner. Safe to call again: each email goes once. */
export async function runEnded(runId: string): Promise<RunEndedResult | null> {
  const run = await prisma.evalRun.findUnique({ where: { id: runId }, select: { status: true } });
  if (!run) return null;
  const type = emailTypeFor(run.status);
  if (!type) return { status: run.status, email: 'not_done' };
  return { status: run.status, email: await sendRunEmail(runId, type) };
}
