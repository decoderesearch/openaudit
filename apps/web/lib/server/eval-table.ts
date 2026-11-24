import { prisma } from '@/lib/db';
import type { Effort } from '@/lib/runs/effort';
import { rowStatus, type RowStatus } from '@/lib/runs/eval-table';
import { priceItems } from '@/lib/server/run-checks';
import { quoteMany, type ItemQuote } from '@/lib/server/run-quotes';
import { runPath, runnableEvals } from '@/lib/server/runs';
import type { EvalStatus, ModelSlot, Topic } from '@openaudit/spec';

export type EvalRow = RowStatus & {
  evalId: string;
  slug: string;
  displayName: string;
  /** One line on what the eval tests. */
  summary: string | null;
  version: string;
  /** `active`: recommended. */
  status: EvalStatus;
  topics: Topic[];
  slots: ModelSlot[];
  /** The scores need the model's raw chain of thought, which API models do not give. */
  rawReasoning: boolean;
  /** The samples a run does when the viewer gives no limit. Null: all. */
  defaultLimit: number | null;
  /** The page of the run that gives the state. */
  path: string | null;
  /** Price and time with default settings. Null: not priced (runs are off, or the eval is legacy
   * or saturated). */
  quote: ItemQuote | null;
};

/** Each eval the runner can run, with its state for this model at this effort. Recommended evals first. */
export async function evalRows(modelId: string, effort: Effort, priced: boolean): Promise<EvalRow[]> {
  const all = await runnableEvals();
  const active = all.filter((e) => e.status === 'active');
  const evals = [...active, ...all.filter((e) => e.status !== 'active')];
  const [runs, quotes] = await Promise.all([
    prisma.evalRun.findMany({
      where: { modelId, origin: 'run', visibility: 'public', evalId: { in: evals.map((e) => e.id) } },
      select: { id: true, evalId: true, evalVersionId: true, status: true, settings: true, createdAt: true },
    }),
    priced
      ? priceItems(active.map((e) => ({ modelId, evalId: e.id, reasoning: effort }))).then(quoteMany)
      : Promise.resolve(null),
  ]);
  const tableRuns = runs.map((r) => ({ ...r, settings: r.settings as Record<string, unknown> | null }));
  return evals.map((e, i) => {
    const status = rowStatus(tableRuns, e.id, e.versionId, effort, e.defaultLimit);
    return {
      evalId: e.id,
      slug: e.slug,
      displayName: e.displayName,
      summary: e.summary,
      version: e.version,
      status: e.status,
      topics: e.topics,
      slots: e.slots,
      rawReasoning: e.rawReasoning,
      defaultLimit: e.defaultLimit,
      ...status,
      path: status.runId && runPath({ id: status.runId }),
      quote: quotes?.[i] ?? null,
    };
  });
}
