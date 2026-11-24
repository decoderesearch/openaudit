import type { StartRunInput } from '@/app/runs/actions';
import { prisma } from '@/lib/db';
import { adminAlertEmail } from '@/lib/email/templates';
import { NEXT_PUBLIC_URL } from '@/lib/env';
import { newId } from '@/lib/ids';
import { MAX_BATCH, requestKey } from '@/lib/runs/batch';
import { effortOf } from '@/lib/runs/effort';
import { AUTO_APPROVE_MAX_USD, AUTO_APPROVE_PER_DAY, DECLINED } from '@/lib/runs/requests';
import { adminEmails } from '@/lib/server/admins';
import { estimateRuns } from '@/lib/server/estimates';
import { priceItems, repeatRuns, runRequest } from '@/lib/server/run-checks';
import { sendOnce } from '@/lib/server/run-emails';
import { runPath } from '@/lib/server/runs';
import type { Viewer } from '@/lib/server/viewer';
import { evalRunToRow } from '@/lib/spec/rows';
import type { EvalRun, RunSettings } from '@openaudit/spec';

// Run requests: a signed-in user asks for runs, at no charge. A cheap request (an eval with
// `autoApprove`, under the cost limit) goes to the queue at once. Others wait as `requested` until
// an admin approves them. Runners claim only `queued` runs, so a waiting request costs nothing.

/** The most requests that one user can have waiting. */
export const MAX_OPEN_REQUESTS = 60;

export const ADMIN_QUEUE_PATH = '/admin/runs';

const DAY_MS = 24 * 60 * 60 * 1000;

export type CreatedRun = { id: string; label: string; status: 'requested' | 'queued'; settings: RunSettings };

/** `repeats`: requests that we skipped, because the same run is there already. */
export type RequestResult =
  { ok: true; paths: string[]; created: CreatedRun[]; repeats: number } | { ok: false; error: string };

/**
 * Makes a run for each request: `queued` when we auto-approve it, else `requested`. Skips a request
 * that repeats an earlier run (see `repeatRuns`) and gives that run. Checks all requests before it
 * makes any run.
 */
export async function createRequests(
  inputs: StartRunInput[],
  viewer: Viewer,
  now = new Date(),
): Promise<RequestResult> {
  if (!inputs.length) return { ok: false, error: 'Pick at least one eval.' };
  if (inputs.length > MAX_BATCH) return { ok: false, error: `At most ${MAX_BATCH} requests at a time.` };
  if (new Set(inputs.map(requestKey)).size < inputs.length) return { ok: false, error: 'The same run is there twice.' };
  const checked = await Promise.all(inputs.map(runRequest));
  const bad = checked.findIndex((c) => !c.ok);
  if (bad >= 0) return { ok: false, error: `Request ${bad + 1}: ${(checked[bad] as { error: string }).error}` };
  const requests = checked.flatMap((c) => (c.ok ? [c.request] : []));
  const repeat = await repeatRuns(requests);
  if (repeat.every(Boolean))
    return {
      ok: false,
      error:
        inputs.length === 1
          ? 'This eval ran on this model at this thinking effort already, or it is in the queue.'
          : 'These evals ran on this model already, or they are in the queue.',
    };
  const fresh = requests.filter((_, i) => !repeat[i]);
  const freshInputs = inputs.filter((_, i) => !repeat[i]);

  const auto = new Set<number>();
  const cheap = fresh.flatMap((r, i) => (r.autoApprove ? [i] : []));
  if (cheap.length) {
    const priced = await priceItems(cheap.map((i) => freshInputs[i]));
    const since = new Date(now.getTime() - DAY_MS);
    let left =
      AUTO_APPROVE_PER_DAY -
      (await prisma.evalRun.count({
        where: { ownerUserId: viewer.id, approvedById: null, approvedAt: { gte: since } },
      }));
    cheap.forEach((i, k) => {
      const p = priced[k];
      if (left > 0 && p.ok && p.quote.estCostUsd <= AUTO_APPROVE_MAX_USD) {
        auto.add(i);
        left--;
      }
    });
  }

  const waiting = fresh.length - auto.size;
  const open = waiting ? await prisma.evalRun.count({ where: { ownerUserId: viewer.id, status: 'requested' } }) : 0;
  if (open + waiting > MAX_OPEN_REQUESTS)
    return {
      ok: false,
      error: `You can have ${MAX_OPEN_REQUESTS} requests waiting at most. You have ${open}. Wait for us to review them.`,
    };

  const at = now.toISOString();
  const runs: EvalRun[] = fresh.map((r, i) => ({
    id: newId(),
    evalId: r.evalId,
    evalVersionId: r.versionId,
    modelId: r.modelId,
    origin: 'run',
    status: auto.has(i) ? 'queued' : 'requested',
    route: r.route,
    settings: r.settings,
    visibility: 'public',
    createdAt: at,
  }));
  await prisma.evalRun.createMany({
    data: runs.map((run, i) => ({
      ...evalRunToRow(run),
      ownerUserId: viewer.id,
      ...(auto.has(i) && { approvedAt: now }),
    })),
  });
  let next = 0;
  const paths = repeat.map((r) => runPath(r ?? runs[next++]));
  const created = runs.map((run, i) => ({
    id: run.id,
    label: `${fresh[i].evalLabel} on ${fresh[i].modelLabel}`,
    status: run.status as CreatedRun['status'],
    settings: run.settings,
  }));
  return { ok: true, paths, created, repeats: inputs.length - fresh.length };
}

/** Moves a requested run to the queue. Null when the run is not `requested`. */
export async function approveRequest(
  runId: string,
  adminId: string,
  now = new Date(),
): Promise<{ settings: RunSettings } | null> {
  // A request of an eval that became legacy or saturated stays waiting: decline it.
  const { count } = await prisma.evalRun.updateMany({
    where: { id: runId, status: 'requested', eval: { is: { status: 'active' } } },
    data: { status: 'queued', approvedById: adminId, approvedAt: now },
  });
  if (!count) return null;
  const row = await prisma.evalRun.findUniqueOrThrow({ where: { id: runId }, select: { settings: true } });
  return { settings: row.settings as RunSettings };
}

/** Cancels a requested run. False when the run is not `requested`. A requested run has no shards. */
export async function declineRequest(runId: string, now = new Date()): Promise<boolean> {
  const { count } = await prisma.evalRun.updateMany({
    where: { id: runId, status: 'requested' },
    data: { status: 'cancelled', error: DECLINED, finishedAt: now },
  });
  return count > 0;
}

/** The request as the model page sends it, from the run's settings. */
export function requestInput(run: Pick<EvalRun, 'modelId' | 'evalId' | 'settings'>): StartRunInput {
  const s = run.settings;
  return {
    modelId: run.modelId,
    evalId: run.evalId,
    reasoning: effortOf(s) ?? 'none',
    ...(s.limit && { limit: s.limit }),
    models: Object.fromEntries(Object.entries(s.models ?? {}).flatMap(([id, r]) => (r ? [[id, r.model]] : []))),
  };
}

export type RequestEstimate = { costUsd: number | null; seconds: number | null; error: string | null };

/** Our cost and the time of each requested run, from past runs. */
export async function estimateRequests(
  runs: Pick<EvalRun, 'modelId' | 'evalId' | 'evalVersionId' | 'settings'>[],
): Promise<RequestEstimate[]> {
  const priced = await priceItems(runs.map(requestInput));
  const seconds = await estimateRuns(
    runs.map((r, i) => {
      const p = priced[i];
      return { ...r, samples: p.ok ? p.quote.samples : (r.settings.limit ?? null) };
    }),
  );
  return priced.map((p, i) =>
    p.ok
      ? { costUsd: p.quote.estCostUsd, seconds: seconds[i], error: null }
      : { costUsd: null, seconds: seconds[i], error: p.error },
  );
}

/** Tells the admins about new requests. One email for each batch, keyed by its first run. */
export async function alertRequest(viewer: Viewer, created: Pick<CreatedRun, 'id' | 'label'>[]): Promise<void> {
  if (!created.length) return;
  const runIds = created.map((c) => c.id);
  const labels = created.map((c) => c.label);
  const to = await adminEmails();
  if (!to.length) {
    console.error(`[email] ${runIds.length} run requests, but no admin address is set`);
    return;
  }
  const who = [viewer.name, viewer.username && `@${viewer.username}`, `<${viewer.email}>`].filter(Boolean).join(' ');
  const content = adminAlertEmail({
    subject: `${runIds.length} run ${runIds.length === 1 ? 'request' : 'requests'} from ${viewer.name}`,
    lines: [
      `${who} asked for ${runIds.length === 1 ? 'a run' : `${runIds.length} runs`}.`,
      ...(viewer.affiliation ? [`Affiliation: ${viewer.affiliation}`] : []),
      ...labels.slice(0, 20),
      ...(labels.length > 20 ? [`And ${labels.length - 20} more.`] : []),
      `Approve or decline: ${NEXT_PUBLIC_URL}${ADMIN_QUEUE_PATH}`,
    ],
  });
  await sendOnce(runIds[0], 'run_request_alert', to, content).catch((e) =>
    console.error(`[email] request alert for run ${runIds[0]} failed`, e),
  );
}
