import { safeShare, type Score } from '@/components/catalog/score';
import { ACTIVE } from '@/components/runs/status-badge';
import { prisma } from '@/lib/db';
import { pickLatest, type PickableRun } from '@/lib/latest-runs';
import { ends, scoreText, type Leader, type Place } from '@/lib/leaders';
import { releasedAfter } from '@/lib/release-dates';
import { modelPath } from '@/lib/server/catalog';
import { listRuns, runPath, runTallies, type RunListItem, type RunTally } from '@/lib/server/runs';
import { ttlCache } from '@/lib/server/ttl-cache';

/** Each model's run on the eval of a version, by model name, as on the eval page: a board column opens it. */
export async function runLinks(evalVersionId: string): Promise<Map<string, string>> {
  const v = await prisma.evalVersion.findUnique({ where: { id: evalVersionId }, select: { evalId: true } });
  if (!v) return new Map();
  const runs = onePerModel(await listRuns({ evalId: v.evalId }, 500, true));
  return new Map(runs.map((r) => [r.model.name, runPath(r.run)]));
}

/** One run for each model: by the rule of the model cards (`pickLatest`, less the judge check,
 * newest by start time), else its newest run. A queued or running run that is newer shows too. */
export function onePerModel(runs: RunListItem[]) {
  const byModel = new Map<string, RunListItem[]>();
  for (const r of runs) byModel.set(r.run.modelId, [...(byModel.get(r.run.modelId) ?? []), r]);
  return [...byModel.values()].flatMap((group) => {
    const done = group.filter((r) => r.run.status === 'succeeded');
    const pick = done.length
      ? pickLatest(
          done.map((r) => ({
            item: r,
            id: r.run.id,
            evalId: r.run.evalId,
            version: r.version,
            settings: r.run.settings as PickableRun['settings'],
            finishedAt: r.run.createdAt,
            origin: r.run.origin,
            route: r.run.route as PickableRun['route'],
          })),
        )[0]!.item
      : group[0]!;
    const newer = group.filter((r) => ACTIVE.includes(r.run.status) && r.run.createdAt > pick.run.createdAt);
    return [...newer, pick];
  });
}

/** The share of the run's graded attempts that passed, without excluded samples. */
export function passRate(tally: RunTally | undefined) {
  const graded = tally ? tally.passed + tally.failed : 0;
  return graded && tally ? tally.passed / graded : undefined;
}

/** True when a sample with a known error leaves some run's counts: then runs rank by their adjusted pass rate. */
export const isAdjusted = (tallies: Iterable<RunTally>) => [...tallies].some((t) => t.excluded > 0);

/** The share of the run that is good for safety: from its headline result, else from its passed
 * attempts. `adjusted`: from its adjusted pass rate only. Undefined: not known, or the headline is
 * neither good nor bad for safety. */
function goodShare(r: RunListItem, tally: RunTally | undefined, adjusted: boolean) {
  if (r.result?.safetyDirection === 'neither') return undefined;
  const share = r.result && !adjusted ? safeShare(r.result) : undefined;
  return share ?? passRate(tally);
}

/** The safest model first. Runs with no known share go last, in their order. */
export function safestFirst(runs: RunListItem[], tallies: Map<string, RunTally>, adjusted: boolean) {
  const share = new Map(runs.map((r) => [r.run.id, goodShare(r, tallies.get(r.run.id), adjusted) ?? -Infinity]));
  return [...runs].sort((a, b) => {
    const [x, y] = [share.get(a.run.id)!, share.get(b.run.id)!];
    return x === y ? 0 : y - x;
  });
}

/** True when the run has a known share and did not fail or get cancelled. */
const rankable = (r: RunListItem, share: number | undefined): share is number =>
  share !== undefined && r.run.status !== 'failed' && r.run.status !== 'cancelled';

/** Each run's rank by `safestFirst`: 1 is the safest. Equal shares get the same rank. A run that
 * failed or was cancelled, or has no known share, has no rank. */
export function ranks(sorted: RunListItem[], tallies: Map<string, RunTally>, adjusted: boolean) {
  const out = new Map<string, number>();
  let last: number | undefined;
  let rank = 0;
  let n = 0;
  for (const r of sorted) {
    const share = goodShare(r, tallies.get(r.run.id), adjusted);
    if (!rankable(r, share)) continue;
    n++;
    if (share !== last) rank = n;
    last = share;
    out.set(r.run.id, rank);
  }
  return out;
}

/** The fewest ranked models for a rank to show: a rank among fewer tells little. */
export const RANK_MIN = 5;

/** A model's place on an eval: `rank` of `of` ranked models (1 is the safest; equal shares get the
 * same rank), and the run that it is from, with that run's headline result. */
export type EvalPlace = Place & { href: string; result: Score | null };

/** `models`: the models with a finished public run. `newer`: how many of them came out after the
 * eval. `worst` and `best`: the 3 at each end of the eval page's ranking, from `ends`. Both are empty
 * when all shares are the same. `places`: by model id, each finished run's `EvalPlace`; empty when
 * fewer than `RANK_MIN` rank or all ranks are the same. */
export type EvalStanding = {
  models: number;
  newer: number;
  worst: Leader[];
  best: Leader[];
  places: Record<string, EvalPlace>;
};

/** The run's model, with the score that ranks it (its headline result, else its pass rate) and the
 * release dates. */
function leader(r: RunListItem, share: number, adjusted: boolean): Leader {
  const bar: Score =
    r.result && !adjusted && safeShare(r.result) !== undefined
      ? r.result
      : { metric: 'Pass rate', value: share * 100, unit: 'percent', safetyDirection: 'higher_is_better' };
  return { label: r.model.displayName, href: modelPath(r.model), score: scoreText(bar), bar, released: r.released };
}

/** By eval id, for the evals with runs: its `EvalStanding`, by the ranks of the eval page. */
export const evalStandings = ttlCache(async (): Promise<Record<string, EvalStanding>> => {
  const byEval = new Map<string, RunListItem[]>();
  for (const r of await listRuns({}, 20_000)) byEval.set(r.run.evalId, [...(byEval.get(r.run.evalId) ?? []), r]);
  const picked = [...byEval].map(([id, runs]) => [id, onePerModel(runs)] as const);
  const tallies = await runTallies(picked.flatMap(([, runs]) => runs.map((r) => r.run.id)));
  const out: Record<string, EvalStanding> = {};
  for (const [id, runs] of picked) {
    const adjusted = isAdjusted(runs.flatMap((r) => tallies.get(r.run.id) ?? []));
    const share = (r: RunListItem) => goodShare(r, tallies.get(r.run.id), adjusted);
    const sorted = safestFirst(runs, tallies, adjusted);
    const shown = sorted.flatMap((r) => {
      const s = share(r);
      return rankable(r, s) ? [{ r, s }] : [];
    });
    const same = shown.length < 2 || shown[0].s === shown.at(-1)!.s;
    const { worst, best } = ends(same ? [] : shown.map(({ r, s }) => leader(r, s, adjusted)).toReversed());
    const done = sorted.filter((r) => r.run.status === 'succeeded');
    const rankOf = ranks(done, tallies, adjusted);
    const placed = done.filter((r) => rankOf.has(r.run.id));
    const placesShown = placed.length >= RANK_MIN && new Set(rankOf.values()).size > 1;
    const newer = new Set(
      done.filter((r) => releasedAfter(r.released.model, r.released.eval)).map((r) => r.run.modelId),
    );
    out[id] = {
      models: new Set(done.map((r) => r.run.modelId)).size,
      newer: newer.size,
      worst,
      best,
      places: placesShown
        ? Object.fromEntries(
            placed.map((r) => [
              r.run.modelId,
              { rank: rankOf.get(r.run.id)!, of: placed.length, href: runPath(r.run), result: r.result ?? null },
            ]),
          )
        : {},
    };
  }
  return out;
}, 300_000);
