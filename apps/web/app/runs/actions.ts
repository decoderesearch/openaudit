'use server';

import { progressText, runSettingsText } from '@/components/runs/parts';
import { prisma } from '@/lib/db';
import { RUNS_ENABLED } from '@/lib/env';
import { newId, parseId } from '@/lib/ids';
import { tierRoutes } from '@/lib/model-ladders';
import { MAX_BATCH } from '@/lib/runs/batch';
import type { Effort } from '@/lib/runs/effort';
import { canRun, slotAllows, slotRoute } from '@/lib/runs/routes';
import { termsText } from '@/lib/runs/terms';
import { allow, callerIp, limitRead, TOO_MANY } from '@/lib/server/limits';
import { busyRuns, DATED_EVAL, priceItems, repeatRuns, runRequest } from '@/lib/server/run-checks';
import { sendRunEmail } from '@/lib/server/run-emails';
import { runMode } from '@/lib/server/run-mode';
import { containersFor, enqueueRun } from '@/lib/server/run-queue';
import { quoteMany, type ItemQuote } from '@/lib/server/run-quotes';
import { ADMIN_QUEUE_PATH, alertRequest, approveRequest, createRequests } from '@/lib/server/run-requests';
import {
  attemptsForRun,
  getRun,
  metricPicks,
  ownRuns,
  runNotScored,
  runPath,
  type AttemptFilter,
  type ShownAttempt,
} from '@/lib/server/runs';
import { sha256Hex } from '@/lib/server/terms';
import { canSpend, getViewer } from '@/lib/server/viewer';
import { evalRunFromRow, evalRunToRow, evalVersionFromRow } from '@/lib/spec/rows';
import type { EvalRun, ModelSlot, RunSettings, RunStatus, ServingRoute } from '@openaudit/spec';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';

export type StartRunInput = {
  modelId: string;
  evalId: string;
  reasoning: Effort;
  limit?: number;
  /** Slot id to an OpenRouter model id. Left out: the slot's default. */
  models?: Record<string, string>;
};
export type RescoreInput = { runId: string; models: Record<string, string> };
export type StartRunResult = { ok: true; path: string } | { ok: false; error: string };

const ACTIVE = ['queued', 'running', 'importing'];

/** Each slot's route: the chosen model, else `base`, else the slot's tier model for the target,
 *  else the slot's default. */
function slotRoutes(
  slots: ModelSlot[],
  chosen: Record<string, string>,
  target: string,
  base: Record<string, ServingRoute | undefined> = {},
): Record<string, ServingRoute> | string {
  for (const [id, model] of Object.entries(chosen)) {
    const slot = slots.find((s) => s.id === id);
    if (!slot) return `This eval has no model slot "${id}".`;
    if (!slotAllows(slot, model)) return `We cannot use ${model} for a slot.`;
  }
  let tiered: Record<string, ServingRoute>;
  try {
    tiered = tierRoutes(
      slots.filter((s) => !chosen[s.id] && !base[s.id]),
      target,
    );
  } catch (e) {
    return (e as Error).message;
  }
  return Object.fromEntries(
    slots.map((s) => [
      s.id,
      chosen[s.id] ? slotRoute(chosen[s.id]) : (base[s.id] ?? tiered[s.id] ?? slotRoute(s.default)),
    ]),
  );
}

const modelIds = (m: RunSettings['models']) =>
  JSON.stringify(
    Object.entries(m ?? {})
      .map(([k, v]) => [k, v?.model])
      .sort(),
  );
const sameModels = (a: RunSettings['models'], b: RunSettings['models']) => modelIds(a) === modelIds(b);

const NOT_ALLOWED = 'Only admins can start runs.';
const RAN_BEFORE = 'This eval ran on this model at this thinking effort already.';

/** Cost, time and busy state of each run request, for the eval table and the New Evaluation dialog. */
export async function quoteItems(inputs: StartRunInput[]): Promise<ItemQuote[]> {
  if (!RUNS_ENABLED || !runMode(await getViewer()))
    return inputs.map(() => ({ ok: false, error: 'Runs are off on this site.' }));
  if (inputs.length > MAX_BATCH) return inputs.map(() => ({ ok: false, error: `At most ${MAX_BATCH} runs.` }));
  if (!(await allow('general', 'quote', await callerIp()))) return inputs.map(() => ({ ok: false, error: TOO_MANY }));
  return quoteMany(await priceItems(inputs));
}

/** Queues a run for the local runner. The flag is checked here too: the button is not the gate. */
export async function startRun(input: StartRunInput): Promise<StartRunResult> {
  if (!RUNS_ENABLED) return { ok: false, error: 'Runs are off on this site.' };
  const viewer = await getViewer();
  if (!canSpend(viewer)) return { ok: false, error: NOT_ALLOWED };
  const checked = await runRequest(input);
  if (!checked.ok) return checked;
  const { modelId, evalId, versionId, modelName, route, settings } = checked.request;
  // A second click on the same run opens the one in progress. A user's request of it starts now.
  const [busy] = await busyRuns([checked.request]);
  if (busy?.status === 'requested' && viewer && (await approveRequest(busy.id, viewer.id))) {
    after(() => Promise.all([enqueueRun(busy.id, containersFor(settings.limit)), sendRunEmail(busy.id, 'run_queued')]));
    revalidatePath(`/${modelName}`);
  }
  if (busy) return { ok: true, path: runPath(busy) };
  const [ran] = await repeatRuns([checked.request], { succeededOnly: true });
  if (ran) return { ok: false, error: RAN_BEFORE };

  const run: EvalRun = {
    id: newId(),
    evalId,
    evalVersionId: versionId,
    modelId,
    origin: 'run',
    status: 'queued',
    route,
    settings,
    visibility: 'public',
    createdAt: new Date().toISOString(),
  };
  await prisma.evalRun.create({ data: { ...evalRunToRow(run), ownerUserId: viewer?.id ?? null } });
  after(() => Promise.all([enqueueRun(run.id, containersFor(settings.limit)), sendRunEmail(run.id, 'run_queued')]));
  revalidatePath(`/${modelName}`);
  revalidatePath('/runs/mine');
  return { ok: true, path: runPath(run) };
}

type QueueRunsResult = { ok: true; paths: string[] } | { ok: false; error: string };

/** Queues each run, for moderators. Stops at the first error. */
async function queueRuns(inputs: StartRunInput[]): Promise<QueueRunsResult> {
  if (inputs.length > MAX_BATCH) return { ok: false, error: `At most ${MAX_BATCH} runs at a time.` };
  const paths: string[] = [];
  for (const input of inputs) {
    const result = await startRun(input);
    if (!result.ok) return { ok: false, error: `Run ${paths.length + 1}: ${result.error}` };
    paths.push(result.path);
  }
  return { ok: true, paths };
}

export type EnqueueResult =
  { ok: true; queued: number; waiting: number; repeats: number } | { ok: false; error: string };

/** The model page's "Queue Run". A moderator's runs start now. A user's runs are requests. */
export async function enqueueRuns(inputs: StartRunInput[]): Promise<EnqueueResult> {
  if (runMode(await getViewer()) === 'run') {
    const result = await queueRuns(inputs);
    return result.ok ? { ok: true, queued: result.paths.length, waiting: 0, repeats: 0 } : result;
  }
  return requestRuns(inputs);
}

/** Asks for runs at no charge. A cheap run goes to the queue now; the others wait for an admin. */
export async function requestRuns(inputs: StartRunInput[]): Promise<EnqueueResult> {
  if (!RUNS_ENABLED) return { ok: false, error: 'Runs are off on this site.' };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: 'Sign in to queue runs.' };
  if (runMode(viewer) !== 'request') return { ok: false, error: 'This account cannot request runs.' };
  if (!(await allow('strict', 'request', viewer.id))) return { ok: false, error: TOO_MANY };
  const result = await createRequests(inputs, viewer);
  if (!result.ok) return result;
  const queued = result.created.filter((c) => c.status === 'queued');
  const waiting = result.created.filter((c) => c.status === 'requested');
  after(() =>
    Promise.all([
      alertRequest(viewer, waiting),
      ...queued.map((c) => enqueueRun(c.id, containersFor(c.settings.limit))),
    ]),
  );
  const names = await prisma.model.findMany({
    where: { id: { in: [...new Set(inputs.map((i) => i.modelId))] } },
    select: { name: true },
  });
  for (const m of names) revalidatePath(`/${m.name}`);
  revalidatePath('/runs/mine');
  revalidatePath(ADMIN_QUEUE_PATH);
  return { ok: true, queued: queued.length, waiting: waiting.length, repeats: result.repeats };
}

export type MyEval = {
  id: string;
  path: string;
  title: string;
  settings: string;
  status: RunStatus;
  /** "12 of 250", while the run runs. */
  progress: string | null;
  error: string | null;
  createdAt: string;
};

/** The viewer's newest runs, for the My Evals sidebar. Null: no viewer. */
export async function myEvals(): Promise<MyEval[] | null> {
  const viewer = await getViewer();
  if (!viewer) return null;
  return (await ownRuns(viewer.id, 30)).map(({ run, eval: e, model }) => ({
    id: run.id,
    path: runPath(run),
    title: `${e.displayName} on ${model.displayName}`,
    settings: runSettingsText(run),
    status: run.status,
    progress: run.status === 'running' || run.status === 'importing' ? progressText(run) : null,
    error: run.status === 'failed' || run.status === 'cancelled' ? (run.error ?? null) : null,
    createdAt: run.createdAt,
  }));
}

/** Queues a re-score: the same outputs, scored again with other judges. */
export async function startRescore(input: RescoreInput): Promise<StartRunResult> {
  if (!RUNS_ENABLED) return { ok: false, error: 'Runs are off on this site.' };
  const viewer = await getViewer();
  if (!canSpend(viewer)) return { ok: false, error: NOT_ALLOWED };
  const row = await prisma.evalRun.findUnique({
    where: { id: input.runId },
    include: { evalVersion: true, eval: { select: { status: true } } },
  });
  if (!row || row.visibility === 'private') return { ok: false, error: 'No such run.' };
  if (row.eval.status !== 'active') return { ok: false, error: DATED_EVAL };
  const source = evalRunFromRow(row);
  const runner = evalVersionFromRow(row.evalVersion).runner;
  if (source.status !== 'succeeded' || !source.log)
    return { ok: false, error: 'Only a finished run can be re-scored.' };
  if (!canRun(runner)) return { ok: false, error: 'This eval cannot run here.' };
  const scoring = (runner?.models ?? []).filter((s) => s.scoring);
  if (!scoring.length) return { ok: false, error: 'This eval has no judges that a re-score can change.' };
  const old = source.settings.models ?? {};
  const changed = slotRoutes(scoring, input.models, source.route.model, old);
  if (typeof changed === 'string') return { ok: false, error: changed };
  const settings: RunSettings = { ...source.settings, models: { ...old, ...changed } };
  if (sameModels(settings.models, old)) return { ok: false, error: 'Pick a judge that is not the one this run used.' };

  const busy = (
    await prisma.evalRun.findMany({
      where: { sourceRunId: source.id, status: { in: [...ACTIVE, 'succeeded'] } },
      select: { id: true, settings: true },
    })
  ).find((r) => sameModels((r.settings as RunSettings).models, settings.models));
  if (busy) return { ok: true, path: runPath(busy) };

  const run: EvalRun = {
    id: newId(),
    evalId: source.evalId,
    evalVersionId: source.evalVersionId,
    modelId: source.modelId,
    origin: 'rescore',
    sourceRunId: source.id,
    status: 'queued',
    route: source.route,
    settings,
    visibility: source.visibility,
    createdAt: new Date().toISOString(),
  };
  await prisma.evalRun.create({ data: { ...evalRunToRow(run), ownerUserId: viewer?.id ?? null } });
  // A re-score runs in one piece.
  after(() => enqueueRun(run.id, 1));
  revalidatePath(runPath(source));
  revalidatePath('/runs/mine');
  return { ok: true, path: runPath(run) };
}

export type AcceptTermsResult = { ok: true } | { ok: false; error: string };

/** Records that the viewer accepted an eval version's sample terms, as they read them. */
export async function acceptTerms(input: { versionId: string; termsSha256: string }): Promise<AcceptTermsResult> {
  const viewer = await getViewer();
  if (!viewer || viewer.banned) return { ok: false, error: 'Sign in to accept the terms.' };
  const row = await prisma.evalVersion.findUnique({ where: { id: input.versionId } });
  const terms = row && evalVersionFromRow(row).sampleTerms;
  if (!terms) return { ok: false, error: 'This eval has no terms to accept.' };
  const termsSha256 = await sha256Hex(termsText(terms));
  if (termsSha256 !== input.termsSha256) return { ok: false, error: 'The terms changed. Read them again.' };
  await prisma.termsAcceptance.upsert({
    where: { userId_evalVersionId: { userId: viewer.id, evalVersionId: input.versionId } },
    create: { userId: viewer.id, evalVersionId: input.versionId, termsSha256 },
    update: { termsSha256, acceptedAt: new Date() },
  });
  revalidatePath('/runs', 'layout');
  return { ok: true };
}

const FILTERS: AttemptFilter[] = ['all', 'passed', 'failed', 'blocked', 'error'];

/** A page of a run's attempts for the samples table, with their number and counts, as the reader
 * can see them. `q`: only the attempts it finds. Null: no such run. */
async function attemptPage(id: string, show: string, metric: string | undefined, page: number, q?: string) {
  const uuid = parseId(id);
  const found = uuid && (await getRun(uuid));
  if (!found || !Number.isInteger(page) || page < 1 || page > 1e4) return null;
  const filter = FILTERS.find((f) => f === show) ?? 'all';
  const pick = metric
    ? (await metricPicks(found.run.id, found.version.metrics, found.version.scores)).find(
        (p) => p.pick.metric === metric,
      )?.pick
    : undefined;
  const readable = { version: found.version, access: found.access, run: found.run };
  return attemptsForRun(found.run.id, filter, page, readable, pick, q?.trim().slice(0, 200) || undefined);
}

/** A page of a run's attempts for the samples table. Empty: no such run. */
export async function moreAttempts(
  id: string,
  show: string,
  metric: string | undefined,
  page: number,
  q?: string,
): Promise<ShownAttempt[]> {
  await limitRead('attempts');
  return (await attemptPage(id, show, metric, page, q))?.attempts ?? [];
}

/** Why the results leave out each of these attempts of the run (`runNotScored`), by attempt id. */
export async function notScoredOf(id: string, attempts: string[]): Promise<Record<string, string>> {
  await limitRead('not-scored');
  const uuid = parseId(id);
  const found = uuid && (await getRun(uuid));
  if (!found || !Array.isArray(attempts)) return {};
  return runNotScored(found.run.id, attempts, { version: found.version, access: found.access, run: found.run });
}

/** The first page of the attempts that `q` finds, with their number and counts. Null: no such run. */
export async function findAttempts(id: string, show: string, metric: string | undefined, q: string) {
  await limitRead('attempts');
  return attemptPage(id, show, metric, 1, q);
}
