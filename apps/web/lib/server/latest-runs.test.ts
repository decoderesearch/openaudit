import { forEffort, hiddenVersions, isLimited, pickLatest, type PickableRun } from '@/lib/latest-runs';
import { describe, expect, it } from 'vitest';
import json from './latest-runs.cases.json';

const cases = json as { name: string; effort?: string; runs: (PickableRun & { slug: string })[]; picked: string[] }[];

describe('pickLatest', () => {
  it.each(cases)('$name', ({ runs, effort, picked }) => {
    expect(
      pickLatest(forEffort(runs, effort))
        .map((r) => r.id)
        .sort(),
    ).toEqual([...picked].sort());
  });

  it('never mixes versions: one run per eval', () => {
    const out = pickLatest(cases.flatMap((c) => c.runs.map((r) => ({ ...r, evalId: `${c.name}/${r.evalId}` }))));
    expect(new Set(out.map((r) => r.evalId)).size).toBe(out.length);
  });

  it('a limit must be a whole number', () => {
    expect(isLimited({ settings: { limit: 5 } })).toBe(true);
    expect(isLimited({ settings: { limit: null } })).toBe(false);
    expect(isLimited({ settings: {} })).toBe(false);
    expect(isLimited({ settings: null })).toBe(false);
  });
});

describe('hiddenVersions', () => {
  it('hides a version whose runs are all private, and keeps a version with no runs', () => {
    const run = (evalVersionId: string, visibility: string) => ({ evalVersionId, visibility });
    expect([
      ...hiddenVersions([run('old', 'private'), run('new', 'private'), run('new', 'unlisted'), run('pub', 'public')]),
    ]).toEqual(['old']);
    expect(hiddenVersions([]).size).toBe(0);
  });
});
