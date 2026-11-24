import { describe, expect, it } from 'vitest';
import { sameDatabase } from './neon';
import {
  compareCard,
  comparePanels,
  compareRun,
  justRuns,
  runBlock,
  withoutRuns,
  type CardRow,
  type PanelRow,
  type RunRow,
} from './prod-sync';

const T = new Date('2026-10-03T12:00:00Z');
const run = (over: Partial<RunRow> = {}): RunRow => ({
  id: 'r1',
  status: 'succeeded',
  visibility: 'public',
  createdAt: T,
  updatedAt: T,
  finishedAt: T,
  sourceRunId: null,
  modelKey: 'openrouter|qwen/qwen3.6-27b',
  modelLabel: 'Qwen3.6 27B',
  versionKey: 'gpqa|2024',
  ownerEmail: null,
  approverEmail: null,
  documents: 0,
  unlabeled: 0,
  shards: 2,
  attempts: 100,
  results: 3,
  snippets: 1,
  ...over,
});

const prodKeys = (over: Partial<Parameters<typeof runBlock>[1]> = {}) => ({
  models: new Set(['openrouter|qwen/qwen3.6-27b']),
  versions: new Set(['gpqa|2024']),
  emails: new Set(['admin@example.com']),
  runs: new Set<string>(),
  ...over,
});

describe('runBlock', () => {
  it('passes a run whose keys production has', () => {
    expect(runBlock(run({ approverEmail: 'admin@example.com' }), prodKeys())).toBeUndefined();
  });

  it('blocks missing keys, users, samples and source runs', () => {
    expect(runBlock(run({ modelKey: 'x|y' }), prodKeys())).toMatch(/Model x\|y/);
    expect(runBlock(run({ versionKey: 'gpqa|2025' }), prodKeys())).toMatch(/Eval gpqa\|2025/);
    expect(runBlock(run({ ownerEmail: 'new@example.com' }), prodKeys())).toMatch(/new@example.com/);
    expect(runBlock(run({ unlabeled: 3 }), prodKeys())).toMatch(/3 replies graded unsafe have no hazard/);
    expect(runBlock(run({ sourceRunId: 'r0' }), prodKeys())).toMatch(/source run/);
    expect(runBlock(run({ sourceRunId: 'r0' }), prodKeys({ runs: new Set(['r0']) }))).toBeUndefined();
  });
});

describe('compareRun', () => {
  const later = new Date(T.getTime() + 1000);

  it('finds new, same and only-on-production runs', () => {
    expect(compareRun(run(), undefined).state).toBe('new');
    expect(compareRun(run(), run()).state).toBe('same');
    expect(compareRun(undefined, run()).state).toBe('prod-only');
  });

  it('syncs a run that changed on dev, not one that changed on production', () => {
    expect(compareRun(run({ updatedAt: later }), run()).state).toBe('changed');
    expect(compareRun(run({ attempts: 101 }), run()).state).toBe('changed');
    expect(compareRun(run(), run({ updatedAt: later })).state).toBe('prod-newer');
  });

  it('skips unfinished and blocked runs', () => {
    expect(compareRun(run({ status: 'running' }), undefined).state).toBe('unfinished');
    expect(compareRun(run(), undefined, 'Model x|y is not on production.').state).toBe('blocked');
  });

  it('shows the eval as slug@version', () => {
    expect(compareRun(run(), undefined).eval).toBe('gpqa@2024');
  });
});

describe('justRuns', () => {
  const plan = {
    runs: [compareRun(run(), undefined), compareRun(run({ id: 'r2', attempts: 99 }), run({ id: 'r2' }))],
    syncRuns: ['r1', 'r2'],
    syncCards: [{ missing: ['v1'] }],
    syncPanels: ['p1'],
  } as unknown as Parameters<typeof justRuns>[0];

  it('keeps only the chosen runs, with no cards or panels', () => {
    const p = justRuns(plan, ['r2']);
    expect(p.runs.map((r) => r.id)).toEqual(['r2']);
    expect(p.syncRuns).toEqual(['r2']);
    expect(p.syncCards).toEqual([]);
    expect(p.syncPanels).toEqual([]);
  });

  it('fails on a run that the plan does not sync', () => {
    expect(() => justRuns(plan, ['r3'])).toThrow(/r3/);
  });

  it('can leave out runs and keep the cards and panels', () => {
    const p = withoutRuns(plan, ['r1']);
    expect(p.runs.map((r) => r.id)).toEqual(['r2']);
    expect(p.syncRuns).toEqual(['r2']);
    expect(p.syncCards).toEqual(plan.syncCards);
    expect(p.syncPanels).toEqual(['p1']);
  });
});

describe('compareCard', () => {
  const card = (versions: [string, number, string[]][], over: Partial<CardRow> = {}): CardRow => ({
    id: 'c1',
    modelKey: 'openrouter|qwen/qwen3.6-27b',
    modelLabel: 'Qwen3.6 27B',
    builtAt: T,
    createdAt: T,
    busy: false,
    versions: versions.map(([id, number, runIds]) => ({ id, number, runIds })),
    ...over,
  });
  const all = () => true;

  it('finds new, newer and same cards', () => {
    expect(compareCard(card([['v1', 1, ['r1']]]), undefined, all).state).toBe('new');
    expect(compareCard(card([['v1', 1, ['r1']]]), card([]), all).state).toBe('new');
    const two = card([
      ['v1', 1, ['r1']],
      ['v2', 2, ['r1']],
    ]);
    expect(compareCard(two, card([['v1', 1, ['r1']]]), all)).toMatchObject({ state: 'newer', dev: [1, 2], prod: [1] });
    expect(compareCard(two, two, all).state).toBe('same');
  });

  it('syncs over versions that production built only with higher numbers', () => {
    expect(compareCard(card([['v1', 1, []]]), card([['p2', 2, []]]), all).state).toBe('prod-built');
    expect(compareCard(card([['v2', 2, []]]), card([['p2', 2, []]]), all).state).toBe('prod-built');
    expect(compareCard(card([['v3', 3, []]]), card([['p2', 2, []]]), all)).toMatchObject({
      state: 'newer',
      dev: [3],
      prod: [2],
    });
    const synced = card([
      ['p2', 2, []],
      ['v3', 3, []],
    ]);
    expect(compareCard(card([['v3', 3, []]]), synced, all).state).toBe('prod-built');
  });

  it('waits for a build on production, and needs the runs on production', () => {
    expect(compareCard(card([['v1', 1, []]]), card([], { busy: true }), all).state).toBe('busy');
    const d = compareCard(card([['v1', 1, ['r9']]]), undefined, (id) => id !== 'r9');
    expect(d).toMatchObject({ state: 'blocked', reason: 'v1 uses a run that does not sync.' });
  });
});

describe('comparePanels', () => {
  const panel = (id: string, number: number, versionIds = ['v1']): PanelRow => ({
    id,
    number,
    modelKey: 'openrouter|qwen/qwen3.6-27b',
    modelLabel: 'Qwen3.6 27B',
    versionIds,
  });
  const all = () => true;

  it('finds new, newer, same and only-on-production panels', () => {
    expect(comparePanels([panel('p1', 1)], [], all).state).toBe('new');
    expect(comparePanels([panel('p1', 1), panel('p2', 2)], [panel('p1', 1)], all)).toMatchObject({
      state: 'newer',
      dev: [1, 2],
      prod: [1],
    });
    expect(comparePanels([panel('p1', 1)], [panel('p1', 1)], all).state).toBe('same');
    expect(comparePanels([], [panel('p1', 1)], all).state).toBe('prod-only');
  });

  it('syncs over panels that production made only with higher numbers', () => {
    expect(comparePanels([panel('p1', 1)], [panel('q2', 2)], all).state).toBe('prod-built');
    expect(comparePanels([panel('p3', 3)], [panel('q2', 2)], all)).toMatchObject({
      state: 'newer',
      dev: [3],
      prod: [2],
    });
  });

  it('needs the card versions and the model on production', () => {
    const d = comparePanels([panel('p1', 3, ['v1', 'v9'])], [], (id) => id !== 'v9');
    expect(d).toMatchObject({ state: 'blocked', reason: 'Panel 3 uses a card version that does not sync.' });
    expect(comparePanels([panel('p1', 1)], [], all, 'Model x is not on production.')).toMatchObject({
      state: 'blocked',
      reason: 'Model x is not on production.',
    });
  });
});

describe('sameDatabase', () => {
  it('treats the pooled and the direct host as the same endpoint', () => {
    const a = 'postgresql://u:p@ep-odd-paper-123.c-14.us-east-1.aws.neon.tech/neondb?sslmode=require';
    const b = 'postgresql://u:q@ep-odd-paper-123-pooler.c-14.us-east-1.aws.neon.tech/neondb';
    expect(sameDatabase(a, b)).toBe(true);
    expect(sameDatabase(a, a.replace('neondb', 'other'))).toBe(false);
  });
});
