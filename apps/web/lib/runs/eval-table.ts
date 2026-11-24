import { effortKey } from '@/lib/latest-runs';

// The state of one eval for one model at one thinking effort, for the model page's eval table.

export type RowState = 'done' | 'running' | 'requested' | 'partial' | 'older' | 'missing';

export type TableRun = {
  id: string;
  evalId: string;
  evalVersionId: string;
  status: string;
  settings: Record<string, unknown> | null;
  createdAt: Date | string;
};

export type RowStatus = {
  state: RowState;
  /** The run that gives the state. */
  runId: string | null;
  /** The run's sample limit (`partial`, `running`, `requested`). */
  limit: number | null;
};

const ACTIVE = ['queued', 'running', 'importing'];

const time = (r: TableRun) => new Date(r.createdAt).getTime();

/**
 * `done`: a full run of the newest version finished (no limit, or the eval's default limit or more).
 * `running`: a run of it is queued or running. `requested`: a run of it waits for approval.
 * `partial`: only runs with a smaller limit finished. `older`: only an older version finished.
 * Runs of other efforts do not count.
 */
export function rowStatus(
  runs: TableRun[],
  evalId: string,
  versionId: string,
  effort: string,
  defaultLimit: number | null = null,
): RowStatus {
  const mine = runs.filter((r) => r.evalId === evalId && effortKey(r) === effort).sort((a, b) => time(b) - time(a));
  const limit = (r: TableRun) => (Number.isInteger(r.settings?.limit) ? (r.settings!.limit as number) : null);
  const current = mine.filter((r) => r.evalVersionId === versionId);
  const done = current.filter((r) => r.status === 'succeeded');
  const full = done.find((r) => {
    const n = limit(r);
    return n === null || (defaultLimit !== null && n >= defaultLimit);
  });
  if (full) return { state: 'done', runId: full.id, limit: null };
  const active = current.find((r) => ACTIVE.includes(r.status));
  if (active) return { state: 'running', runId: active.id, limit: limit(active) };
  const requested = current.find((r) => r.status === 'requested');
  if (requested) return { state: 'requested', runId: requested.id, limit: limit(requested) };
  if (done[0]) return { state: 'partial', runId: done[0].id, limit: limit(done[0]) };
  const older = mine.find((r) => r.status === 'succeeded');
  if (older) return { state: 'older', runId: older.id, limit: limit(older) };
  return { state: 'missing', runId: null, limit: null };
}

/** Rows that "Add all missing" adds: not done, running or requested. */
export const isMissing = (state: RowState) => state !== 'done' && state !== 'running' && state !== 'requested';
