'use server';

import { prisma } from '@/lib/db';
import { sendRunEmail } from '@/lib/server/run-emails';
import { runEnded } from '@/lib/server/run-ended';
import { containersFor, enqueueRun } from '@/lib/server/run-queue';
import { ADMIN_QUEUE_PATH, approveRequest, declineRequest } from '@/lib/server/run-requests';
import { cancelRun, runPath } from '@/lib/server/runs';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';

export type CancelResult = { ok: true } | { ok: false; error: string };
export type ApproveResult = { ok: true; approved: number } | { ok: false; error: string };

const ADMINS_ONLY = 'Only admins can do this.';

async function refresh(runIds: string[]) {
  const models = await prisma.model.findMany({
    where: { runs: { some: { id: { in: runIds } } } },
    select: { name: true },
  });
  for (const m of models) revalidatePath(`/${m.name}`);
  for (const id of runIds) revalidatePath(runPath({ id }));
  revalidatePath(ADMIN_QUEUE_PATH);
  revalidatePath('/runs/mine');
}

/** Admins only: stops a queued or running run and tells its owner. */
export async function cancelRunAction(runId: string): Promise<CancelResult> {
  if (!isAdmin(await getViewer())) return { ok: false, error: 'Only admins can cancel runs.' };
  if (!(await cancelRun(runId))) return { ok: false, error: 'This run is not queued or running.' };
  after(() => runEnded(runId));
  await refresh([runId]);
  return { ok: true };
}

/** Admins only: moves requested runs to the queue and tells each owner. Skips runs that are no
 * longer requested. */
export async function approveRunsAction(runIds: string[]): Promise<ApproveResult> {
  const viewer = await getViewer();
  if (!viewer || !isAdmin(viewer)) return { ok: false, error: ADMINS_ONLY };
  const approved: string[] = [];
  for (const id of runIds.slice(0, 200)) {
    const run = await approveRequest(id, viewer.id);
    if (!run) continue;
    approved.push(id);
    after(() => Promise.all([enqueueRun(id, containersFor(run.settings.limit)), sendRunEmail(id, 'run_queued')]));
  }
  if (!approved.length) return { ok: false, error: 'These runs are not waiting for approval.' };
  await refresh(approved);
  return { ok: true, approved: approved.length };
}

/** Admins only: declines a requested run and tells its owner. */
export async function declineRunAction(runId: string): Promise<CancelResult> {
  if (!isAdmin(await getViewer())) return { ok: false, error: ADMINS_ONLY };
  if (!(await declineRequest(runId))) return { ok: false, error: 'This run is not waiting for approval.' };
  after(() => runEnded(runId));
  await refresh([runId]);
  return { ok: true };
}
