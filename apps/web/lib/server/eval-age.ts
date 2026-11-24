import { modelReleased, releasedAfter } from '@/lib/release-dates';
import { runnableEvals } from '@/lib/server/runs';

/** An eval of a full audit: active, and its scores do not need a raw chain of thought, which API
 * models do not give. */
export const auditEval = (e: { status: string; rawReasoning: boolean }, source: string) =>
  e.status === 'active' && !(e.rawReasoning && source === 'api');

/** True when the model came out after most of the evals: their public data is likely in its
 * training data, so its results are not reliable and we take no sponsorship. */
export const evalsTooOld = (a: { evals: number; older: number }) => a.older * 2 > a.evals;

/** For each model, the evals of its full audit, and how many of them came out before the model. */
export async function evalAges(models: { source: string; facts: unknown }[]) {
  const evals = await runnableEvals();
  return models.map((m) => {
    const released = modelReleased(m.facts);
    const own = evals.filter((e) => auditEval(e, m.source));
    return { evals: own.length, older: own.filter((e) => releasedAfter(released, e.released)).length };
  });
}

/** For each model, `evalsTooOld` over the evals of its full audit. */
export async function evalsTooOldFor(models: { source: string; facts: unknown }[]): Promise<boolean[]> {
  return (await evalAges(models)).map(evalsTooOld);
}
