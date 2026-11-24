import { prisma } from '@/lib/db';
import type { EvalCounts } from '@/lib/eval-counts';
import { isLimited } from '@/lib/latest-runs';

/** By eval id: the models with a finished public run of all samples, and the results reported
 * in documents. A run's metrics, judges and re-scores do not add to the counts. */
export async function evalCounts(): Promise<Map<string, EvalCounts>> {
  const [runs, reported] = await Promise.all([
    prisma.evalRun.findMany({
      where: { status: 'succeeded', visibility: 'public', model: { hidden: false } },
      select: { evalId: true, modelId: true, settings: true },
    }),
    prisma.evalResult.groupBy({ by: ['evalId'], where: { origin: 'reported' }, _count: { _all: true } }),
  ]);
  const models = new Map<string, Set<string>>();
  for (const r of runs) {
    if (isLimited({ settings: r.settings as Record<string, unknown> | null })) continue;
    models.set(r.evalId, (models.get(r.evalId) ?? new Set()).add(r.modelId));
  }
  const counts = new Map<string, EvalCounts>();
  for (const [id, set] of models) counts.set(id, { models: set.size, reported: 0 });
  for (const g of reported) {
    if (!g.evalId) continue;
    counts.set(g.evalId, { models: counts.get(g.evalId)?.models ?? 0, reported: g._count._all });
  }
  return counts;
}
