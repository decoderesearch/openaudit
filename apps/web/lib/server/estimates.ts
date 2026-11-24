import { prisma } from '@/lib/db';
import { effortOf } from '@/lib/runs/effort';
import type { RunSettings } from '@openaudit/spec';

export { durationText } from '@/lib/runs/duration';

// Time estimates for runs, from past runs of the same eval. A run does its samples in waves:
// each wave is one model call on every parallel connection of every shard.

export const ESTIMATE = {
  /** Seconds a run needs before its first sample: claim, install, load the dataset. */
  startupSeconds: 20,
  /** Parallel model calls in each shard when the settings give none. */
  connections: 16,
  /** Shards that run at the same time. */
  shards: 4,
  /** Samples done before the rate so far is better than the estimate. */
  minDone: 5,
  /** Past runs to read. */
  history: 20,
} as const;

export type PastRun = { seconds: number; samples: number; parallel: number };

function median(xs: number[]): number | null {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Seconds for one wave: the median over past runs, or null with no history. */
export function waveSeconds(history: PastRun[]): number | null {
  return median(
    history
      .filter((r) => r.samples > 0 && r.parallel > 0 && r.seconds > 0)
      .map((r) => Math.max(1, r.seconds - ESTIMATE.startupSeconds) / Math.ceil(r.samples / r.parallel)),
  );
}

/** Parallel model calls for a run: connections in each shard, times the shards. */
export function parallelFor(settings: Pick<RunSettings, 'maxConnections'>, shards: number = ESTIMATE.shards) {
  return (settings.maxConnections || ESTIMATE.connections) * Math.max(1, shards);
}

/** Seconds from start to end for `samples`, with `parallel` calls at a time. */
export function runSeconds(samples: number, wave: number, parallel: number): number {
  return ESTIMATE.startupSeconds + Math.ceil(samples / parallel) * wave;
}

/**
 * Seconds left in a run. After a few samples, from the rate so far; before that, from the
 * estimate less the time used. Null when we have neither.
 */
export function secondsLeft(input: {
  elapsed: number;
  done: number;
  planned: number | null;
  estimate: number | null;
}): number | null {
  const { elapsed, done, planned, estimate } = input;
  if (planned && done >= Math.min(ESTIMATE.minDone, planned) && done > 0)
    return Math.max(0, (elapsed / done) * (planned - done));
  return estimate === null ? null : Math.max(0, estimate - elapsed);
}

type RunKey = { evalId: string; evalVersionId: string };

const FINISHED = {
  origin: 'run',
  status: 'succeeded',
  startedAt: { not: null },
  finishedAt: { not: null },
  attemptCount: { gt: 0 },
} as const;

const PAST_SELECT = {
  startedAt: true,
  finishedAt: true,
  attemptCount: true,
  settings: true,
  shards: {
    where: { status: 'succeeded', startedAt: { not: null }, finishedAt: { not: null } },
    select: { startedAt: true, finishedAt: true, attemptCount: true, connections: true },
  },
} as const;

type PastRow = {
  startedAt: Date | null;
  finishedAt: Date | null;
  attemptCount: number;
  settings: unknown;
  shards: { startedAt: Date | null; finishedAt: Date | null; attemptCount: number; connections: number }[];
};

const span = (r: { startedAt: Date | null; finishedAt: Date | null }) =>
  (r.finishedAt!.getTime() - r.startedAt!.getTime()) / 1000;

/** A past run as its shards, so the time its shards waited for room in the queue does not count.
 * A run with no shards counts as one. */
function pastOf(r: PastRow): PastRun[] {
  if (r.shards.length)
    return r.shards.map((s) => ({ seconds: span(s), samples: s.attemptCount, parallel: s.connections }));
  return [{ seconds: span(r), samples: r.attemptCount, parallel: parallelFor(r.settings as RunSettings, 1) }];
}

/** The median wave of each run, then the median over runs: a run with many shards counts once. */
const pastWave = (rows: PastRow[]) =>
  median(rows.map((r) => waveSeconds(pastOf(r))).filter((w): w is number => w !== null));

/** Past finished runs of the eval version, else of the eval. Re-scores do not count. */
async function pastRuns({ evalId, evalVersionId }: RunKey) {
  const read = (where: { evalVersionId: string } | { evalId: string }) =>
    prisma.evalRun.findMany({
      where: { ...where, ...FINISHED },
      orderBy: { finishedAt: 'desc' },
      take: ESTIMATE.history,
      select: PAST_SELECT,
    });
  const rows = await read({ evalVersionId });
  return rows.length ? rows : read({ evalId });
}

/** The samples a run plans: the limit, else the size of the last full run or of the dataset. */
async function plannedSamples(key: RunKey, settings: RunSettings): Promise<number | null> {
  const recent = await prisma.evalRun.findMany({
    where: { evalVersionId: key.evalVersionId, origin: 'run', status: 'succeeded', sampleCount: { gt: 0 } },
    orderBy: { finishedAt: 'desc' },
    take: ESTIMATE.history,
    select: { sampleCount: true, settings: true },
  });
  let total = recent.find((r) => !(r.settings as RunSettings).limit)?.sampleCount ?? null;
  if (total === null) {
    const version = await prisma.evalVersion.findUnique({
      where: { id: key.evalVersionId },
      select: { dataset: true },
    });
    const splits = (version?.dataset as { splits?: { sampleCount?: number }[] } | null)?.splits ?? [];
    total = splits.reduce((n, s) => n + (s.sampleCount ?? 0), 0) || null;
  }
  const samples = settings.limit && total ? Math.min(settings.limit, total) : (settings.limit ?? total);
  return samples ? samples * (settings.epochs ?? 1) : null;
}

/** Seconds a new run takes from start to end, or null with no history. Queue wait not counted. */
export async function estimateRun(
  key: RunKey & { settings: RunSettings; samples?: number | null },
): Promise<number | null> {
  const [history, samples] = await Promise.all([
    pastRuns(key),
    key.samples ? Promise.resolve(key.samples) : plannedSamples(key, key.settings),
  ]);
  const wave = pastWave(history);
  if (wave === null || !samples) return null;
  return runSeconds(samples, wave, parallelFor(key.settings));
}

/**
 * Seconds for many new runs of known size, with one read of the database. Past runs of the same
 * version at the same thinking effort count first, then all past runs of the version.
 */
export async function estimateRuns(
  items: (RunKey & { settings: RunSettings; samples: number | null })[],
): Promise<(number | null)[]> {
  if (!items.length) return [];
  const ids = [...new Set(items.map((i) => i.evalVersionId))];
  const rows = await prisma.evalRun.findMany({
    where: { evalVersionId: { in: ids }, ...FINISHED },
    orderBy: { finishedAt: 'desc' },
    take: ESTIMATE.history * 2 * ids.length,
    select: { evalVersionId: true, ...PAST_SELECT },
  });
  return items.map((item) => {
    if (!item.samples) return null;
    const mine = rows.filter((r) => r.evalVersionId === item.evalVersionId);
    const effort = effortOf(item.settings) ?? 'none';
    const same = mine.filter((r) => (effortOf(r.settings as RunSettings) ?? 'none') === effort);
    const wave = pastWave((same.length ? same : mine).slice(0, ESTIMATE.history));
    return wave === null ? null : runSeconds(item.samples, wave, parallelFor(item.settings));
  });
}

export type RunClock = RunKey & {
  status: string;
  settings: RunSettings;
  startedAt: Date | null;
  attemptCount: number;
  sampleCount: number | null;
};

/** Seconds left in a queued or running run, or null when we cannot tell. */
export async function runSecondsLeft(run: RunClock, now = new Date()): Promise<number | null> {
  const elapsed = run.startedAt ? Math.max(0, (now.getTime() - run.startedAt.getTime()) / 1000) : 0;
  const done = run.attemptCount;
  const fromRate = secondsLeft({ elapsed, done, planned: run.sampleCount, estimate: null });
  if (fromRate !== null) return fromRate;
  const estimate = await estimateRun({ ...run, samples: run.sampleCount });
  return secondsLeft({ elapsed, done, planned: run.sampleCount, estimate });
}
