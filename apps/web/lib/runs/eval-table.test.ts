import { describe, expect, it } from 'vitest';
import { isMissing, rowStatus, type TableRun } from './eval-table';

const run = (id: string, over: Partial<TableRun> = {}): TableRun => ({
  id,
  evalId: 'e1',
  evalVersionId: 'v2',
  status: 'succeeded',
  settings: { reasoning: 'none' },
  createdAt: `2026-10-0${id.slice(-1)}T00:00:00Z`,
  ...over,
});

describe('rowStatus', () => {
  const status = (runs: TableRun[], effort = 'none') => rowStatus(runs, 'e1', 'v2', effort);

  it('is missing with no runs, or only runs of other evals and efforts', () => {
    expect(status([])).toEqual({ state: 'missing', runId: null, limit: null });
    expect(status([run('r1', { evalId: 'e2' }), run('r2', { settings: { reasoning: 'high' } })]).state).toBe('missing');
  });

  it('reads the legacy "off" as "none"', () => {
    expect(status([run('r1', { settings: { reasoning: 'off' } })]).state).toBe('done');
  });

  it('is done with a full run of the newest version, even while another runs', () => {
    expect(status([run('r1'), run('r2', { status: 'running' })])).toEqual({ state: 'done', runId: 'r1', limit: null });
  });

  it('is running before partial and older', () => {
    const runs = [
      run('r1', { evalVersionId: 'v1' }),
      run('r2', { settings: { reasoning: 'none', limit: 5 } }),
      run('r3', { status: 'queued', settings: { reasoning: 'none', limit: 10 } }),
    ];
    expect(status(runs)).toEqual({ state: 'running', runId: 'r3', limit: 10 });
    expect(status(runs.slice(0, 2))).toEqual({ state: 'partial', runId: 'r2', limit: 5 });
    expect(status(runs.slice(0, 1))).toEqual({ state: 'older', runId: 'r1', limit: null });
  });

  it("is done with a run of the eval's default limit or more", () => {
    const limited = (id: string, limit: number) => run(id, { settings: { reasoning: 'none', limit } });
    expect(rowStatus([limited('r1', 2000)], 'e1', 'v2', 'none', 2000)).toEqual({
      state: 'done',
      runId: 'r1',
      limit: null,
    });
    expect(rowStatus([limited('r1', 3000)], 'e1', 'v2', 'none', 2000).state).toBe('done');
    expect(rowStatus([limited('r1', 500)], 'e1', 'v2', 'none', 2000).state).toBe('partial');
    expect(status([limited('r1', 2000)]).state).toBe('partial');
  });

  it('is requested after running, and before partial', () => {
    const runs = [run('r1', { settings: { reasoning: 'none', limit: 5 } }), run('r2', { status: 'requested' })];
    expect(status(runs)).toEqual({ state: 'requested', runId: 'r2', limit: null });
    expect(status([...runs, run('r3', { status: 'queued' })]).state).toBe('running');
  });

  it('ignores failed runs', () => {
    expect(status([run('r1', { status: 'failed' })]).state).toBe('missing');
  });

  it('matches the effort', () => {
    expect(status([run('r1', { settings: { reasoning: 'high' } })], 'high').state).toBe('done');
  });
});

describe('isMissing', () => {
  it('is true for rows that still need a full run', () => {
    expect(
      ['done', 'running', 'requested', 'partial', 'older', 'missing'].filter((s) => isMissing(s as never)),
    ).toEqual(['partial', 'older', 'missing']);
  });
});
