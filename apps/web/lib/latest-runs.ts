// The runs that represent a model: for each eval, the newest version that has a finished
// public run, and in it the newest run, with a full run (no sample limit) before a limited one,
// then a run with good judges first (`goodJudges`). With no such run, an original run comes before a
// re-score. Versions never mix, and thinking efforts never mix (`forEffort`). The runner
// (apps/runner/openaudit_runner/cards.py `pick_latest`) uses the same rule; both test it on
// `lib/server/latest-runs.cases.json`.

import { slotOk, type TierSlot } from '@/lib/model-ladders';

export type PickableRun = {
  id: string;
  evalId: string;
  version: string;
  releasedDate?: string | null;
  settings?: Record<string, unknown> | null;
  finishedAt?: string | Date | null;
  origin?: string | null;
  route?: { model?: string } | null;
  /** The eval version's model slots (`runner.models`). */
  slots?: (TierSlot & { scoring?: boolean })[] | null;
};

/** The run's effort, or "" when it set none. Old runs say `off`: that is `none`. */
export function effortKey(r: Pick<PickableRun, 'settings'>): string {
  const value = r.settings?.reasoning;
  return value === 'off' ? 'none' : typeof value === 'string' ? value : '';
}

/** The effort whose runs cover the most evals; on a tie, the one with the newest run. */
export function mainEffort(runs: PickableRun[]): string {
  const evals = new Map<string, Set<string>>();
  const newest = new Map<string, string>();
  for (const r of runs) {
    const k = effortKey(r);
    evals.set(k, (evals.get(k) ?? new Set()).add(r.evalId));
    if (!newest.has(k) || compare(time(r), newest.get(k)!) > 0) newest.set(k, time(r));
  }
  return [...evals.keys()].sort(
    (a, b) => evals.get(b)!.size - evals.get(a)!.size || compare(newest.get(b)!, newest.get(a)!) || compare(a, b),
  )[0];
}

/** The runs of one effort. Left out: the main effort (`mainEffort`). */
export function forEffort<T extends PickableRun>(runs: T[], effort?: string): T[] {
  if (!runs.length) return runs;
  const want = effort ?? mainEffort(runs);
  return runs.filter((r) => effortKey(r) === want);
}

/** The site's order of an eval's versions: release date, else the version name. */
export function versionKey(r: { version: string; releasedDate?: string | null }): [string, string] {
  return [r.releasedDate || r.version, r.version];
}

type Versioned = { version: string; releasedDate?: string | null };

/** A sort of versions, newest first by `versionKey`. On one release date, the later version name. */
export function newestVersionFirst(a: Versioned, b: Versioned): number {
  const [ka, kb] = [versionKey(a), versionKey(b)];
  return kb[0].localeCompare(ka[0]) || kb[1].localeCompare(ka[1]);
}

/** The versions that have runs, but no public or unlisted run. The site does not show them. */
export function hiddenVersions(runs: { evalVersionId: string; visibility: string }[]): Set<string> {
  const shown = new Set(runs.filter((r) => r.visibility !== 'private').map((r) => r.evalVersionId));
  return new Set(runs.map((r) => r.evalVersionId).filter((id) => !shown.has(id)));
}

export function isLimited(r: Pick<PickableRun, 'settings'>): boolean {
  return Number.isInteger(r.settings?.limit);
}

/** Each slot model of the run (judges and others) is good enough for the target by the tier
 *  rules (`slotOk`). */
export function goodJudges(r: Pick<PickableRun, 'settings' | 'slots' | 'route'>): boolean {
  const models = (r.settings?.models ?? {}) as Record<string, { model?: string } | undefined>;
  const target = r.route?.model ?? '';
  return (r.slots ?? []).every((s) => slotOk(s, models[s.id]?.model || s.default, target));
}

function rank(r: PickableRun): number[] {
  const judges = goodJudges(r);
  return [Number(!isLimited(r)), Number(judges), Number(judges || r.origin !== 'rescore')];
}

/** Code-point order, the same as Python's string order. */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareKeys(a: [string, string], b: [string, string]): number {
  return compare(a[0], b[0]) || compare(a[1], b[1]);
}

function time(r: PickableRun): string {
  const t = r.finishedAt;
  return t ? (t instanceof Date ? t : new Date(t)).toISOString() : '';
}

/** One run per eval (see the top of this file). The input must hold only finished public runs. */
export function pickLatest<T extends PickableRun>(runs: T[]): T[] {
  const byEval = new Map<string, T[]>();
  for (const r of runs) byEval.set(r.evalId, [...(byEval.get(r.evalId) ?? []), r]);
  const out: T[] = [];
  for (const group of byEval.values()) {
    const top = group.map(versionKey).reduce((a, b) => (compareKeys(a, b) >= 0 ? a : b));
    const best = group
      .filter((r) => compareKeys(versionKey(r), top) === 0)
      .sort((a, b) => {
        const [ra, rb] = [rank(a), rank(b)];
        return rb[0] - ra[0] || rb[1] - ra[1] || rb[2] - ra[2] || compare(time(b), time(a)) || compare(b.id, a.id);
      })[0];
    out.push(best);
  }
  return out;
}
