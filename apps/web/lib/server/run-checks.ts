import type { StartRunInput } from '@/app/runs/actions';
import { prisma } from '@/lib/db';
import { isUuid } from '@/lib/ids';
import { tierRoutes } from '@/lib/model-ladders';
import { checkAuditors } from '@/lib/runs/auditor';
import { effortOf, isEffort, runnableEfforts } from '@/lib/runs/effort';
import { effortsFor, routeFor } from '@/lib/runs/model-routes';
import { QUOTE_MAX_AGE } from '@/lib/runs/openrouter';
import { DECLINED, REPEAT_STATUSES } from '@/lib/runs/requests';
import { slotAllows, slotRoute } from '@/lib/runs/routes';
import { pricingConfig, quoteRuns, type Quote } from '@/lib/server/pricing';
import { runnableEvals } from '@/lib/server/runs';
import type { ModelSlot, RunSettings, ServingRoute } from '@openaudit/spec';
import { cache } from 'react';

// The checks of a run request, its quote, and the earlier runs that block it. `startRun`,
// requests, quotes and the queue script use them.

const MAX_LIMIT = 100_000;

/** A run request that passed the same checks as `startRun`. */
export type RunRequest = {
  modelId: string;
  modelName: string;
  modelLabel: string;
  evalId: string;
  evalLabel: string;
  versionId: string;
  /** The eval is cheap: a user's request of it can start without approval. */
  autoApprove: boolean;
  route: ServingRoute;
  settings: RunSettings;
  /** Slot id to the OpenRouter model the slot uses. */
  slots: Record<string, string>;
};

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Each slot's route: the chosen model, else the slot's tier model for the target (with its
 *  fallbacks), else the slot's default. An auditor that breaks the auditor rule gets another
 *  auditor (`checkAuditors`). A string is an error. */
function slotRoutes(
  slots: ModelSlot[],
  chosen: Record<string, string>,
  target: string,
): Record<string, ServingRoute> | string {
  for (const [id, model] of Object.entries(chosen)) {
    const slot = slots.find((s) => s.id === id);
    if (!slot) return `This eval has no model slot "${id}".`;
    if (!slotAllows(slot, model)) return `We cannot use ${model} for a slot.`;
  }
  let tiered: Record<string, ServingRoute>;
  try {
    tiered = tierRoutes(
      slots.filter((s) => !chosen[s.id]),
      target,
    );
  } catch (e) {
    return (e as Error).message;
  }
  const models = Object.fromEntries(slots.map((s) => [s.id, chosen[s.id] || tiered[s.id]?.model || s.default]));
  const checked = checkAuditors(slots, models, target, chosen);
  if (typeof checked === 'string') return checked;
  return Object.fromEntries(
    slots.map((s) => [
      s.id,
      !chosen[s.id] && tiered[s.id]?.model === checked[s.id] ? tiered[s.id] : slotRoute(checked[s.id]),
    ]),
  );
}

/** The model of a run request. Read once per request: a batch often has one model many times. */
const runModel = cache((id: string) =>
  prisma.model.findUnique({
    where: { id },
    select: { name: true, displayName: true, source: true, organization: { select: { slug: true } } },
  }),
);

/** Legacy and saturated evals keep their old runs, but no one can start new ones. */
export const DATED_EVAL = 'This eval is legacy or saturated. New runs are off.';
export const DEFAULT_EFFORT_ONLY = "For now, runs use only the model's default thinking effort.";

/** Checks a run request and builds its route and settings. `startRun` and requests use it. */
export async function runRequest(input: StartRunInput): Promise<Result<{ request: RunRequest }>> {
  const { modelId, evalId, reasoning, limit } = input;
  if (!isEffort(reasoning)) return { ok: false, error: 'Pick a thinking effort.' };
  if (limit !== undefined && !(Number.isInteger(limit) && limit >= 1 && limit <= MAX_LIMIT))
    return { ok: false, error: `The limit must be a whole number from 1 to ${MAX_LIMIT}.` };
  if (!isUuid(modelId)) return { ok: false, error: 'We have no route to run this model.' };

  const model = await runModel(modelId);
  const route = model && (await routeFor({ ...model, organization: model.organization.slug }, QUOTE_MAX_AGE));
  if (!route) return { ok: false, error: 'We have no route to run this model.' };
  const efforts = await effortsFor(route, QUOTE_MAX_AGE);
  if (!efforts.options.includes(reasoning))
    return { ok: false, error: `This model does not take thinking effort "${reasoning}".` };
  if (!runnableEfforts(efforts).includes(reasoning)) return { ok: false, error: DEFAULT_EFFORT_ONLY };
  const target = (await runnableEvals()).find((e) => e.id === evalId);
  if (!target) return { ok: false, error: 'This eval cannot run here.' };
  if (target.status !== 'active') return { ok: false, error: DATED_EVAL };
  const routes = slotRoutes(target.slots, input.models ?? {}, route.model);
  if (typeof routes === 'string') return { ok: false, error: routes };
  const slots = Object.fromEntries(Object.entries(routes).map(([id, r]) => [id, r.model]));

  const samples = limit ?? target.defaultLimit;
  // A task's own token limit (often its paper's) can end a thinking reply before its answer.
  const settings: RunSettings = {
    reasoning,
    ...(reasoning !== 'none' && { maxTokens: pricingConfig().maxTokens.thinking }),
    ...(samples && { limit: samples }),
    ...((target.defaultTrials ?? 1) > 1 && { epochs: target.defaultTrials }),
    ...(target.slots.length > 0 && { models: routes }),
  };
  return {
    ok: true,
    request: {
      modelId,
      modelName: model.name,
      modelLabel: model.displayName,
      evalId,
      evalLabel: target.displayName,
      versionId: target.versionId,
      autoApprove: target.autoApprove,
      route,
      settings,
      slots,
    },
  };
}

const NO_SAMPLE_COUNT = 'We do not know how many samples this eval has. Set the number of samples.';

export type PricedItem = Result<{ request: RunRequest; quote: Quote }>;

/** Each request and its quote, with one read of past runs for all of them. */
export async function priceItems(inputs: StartRunInput[]): Promise<PricedItem[]> {
  const checked = await Promise.all(inputs.map(runRequest));
  const ok = checked.flatMap((c) => (c.ok ? [c.request] : []));
  const quotes = await quoteRuns(
    ok.map((request) => ({
      evalId: request.evalId,
      versionId: request.versionId,
      model: request.route.model,
      slots: request.slots,
      reasoning: request.settings.reasoning!,
      limit: request.settings.limit,
      epochs: request.settings.epochs,
    })),
  );
  return checked.map((c) => {
    if (!c.ok) return c;
    const quote = quotes[ok.indexOf(c.request)];
    return quote ? { ok: true, request: c.request, quote } : { ok: false, error: NO_SAMPLE_COUNT };
  });
}

const BUSY = ['requested', 'queued', 'running', 'importing'];

const slotModelIds = (m: RunSettings['models']) =>
  JSON.stringify(
    Object.entries(m ?? {})
      .map(([k, v]) => [k, v?.model])
      .sort(),
  );

/** The run settings are the same request: effort, sample limit, tries and slot models. */
function sameRequest(a: RunSettings, b: RunSettings): boolean {
  return (
    effortOf(a) === effortOf(b) &&
    a.limit === b.limit &&
    (a.epochs ?? 1) === (b.epochs ?? 1) &&
    slotModelIds(a.models) === slotModelIds(b.models)
  );
}

/** For each request, a requested, queued or running run of the same request, or null. */
export async function busyRuns(
  requests: Pick<RunRequest, 'modelId' | 'versionId' | 'settings'>[],
): Promise<({ id: string; status: string } | null)[]> {
  if (!requests.length) return [];
  const rows = await prisma.evalRun.findMany({
    where: {
      modelId: { in: [...new Set(requests.map((r) => r.modelId))] },
      evalVersionId: { in: [...new Set(requests.map((r) => r.versionId))] },
      origin: 'run',
      status: { in: BUSY },
    },
    select: { id: true, status: true, modelId: true, evalVersionId: true, settings: true },
  });
  return requests.map(
    (q) =>
      rows.find(
        (r) =>
          r.modelId === q.modelId &&
          r.evalVersionId === q.versionId &&
          sameRequest(r.settings as RunSettings, q.settings),
      ) ?? null,
  );
}

/**
 * For each request, an earlier run that stops a user from asking again: a waiting, running or
 * finished run, or a declined request, of the same model, eval version and effort, with no sample
 * limit or the same limit, and as many tries or more. Judges do not matter. `succeededOnly`: only a
 * succeeded run counts (the rule for staff).
 */
export async function repeatRuns(
  requests: Pick<RunRequest, 'modelId' | 'versionId' | 'settings'>[],
  { succeededOnly = false } = {},
): Promise<({ id: string; status: string } | null)[]> {
  if (!requests.length) return [];
  const rows = await prisma.evalRun.findMany({
    where: {
      modelId: { in: [...new Set(requests.map((r) => r.modelId))] },
      evalVersionId: { in: [...new Set(requests.map((r) => r.versionId))] },
      origin: 'run',
      OR: succeededOnly
        ? [{ status: 'succeeded' }]
        : [{ status: { in: REPEAT_STATUSES } }, { status: 'cancelled', error: DECLINED }],
    },
    select: { id: true, status: true, modelId: true, evalVersionId: true, settings: true },
  });
  return requests.map((q) => {
    const row = rows.find((r) => {
      const s = r.settings as RunSettings;
      return (
        r.modelId === q.modelId &&
        r.evalVersionId === q.versionId &&
        effortOf(s) === effortOf(q.settings) &&
        (!s.limit || s.limit === q.settings.limit) &&
        (s.epochs ?? 1) >= (q.settings.epochs ?? 1)
      );
    });
    return row ? { id: row.id, status: row.status } : null;
  });
}
