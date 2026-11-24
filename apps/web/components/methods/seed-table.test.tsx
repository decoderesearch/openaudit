import type { SeedRow } from '@/lib/methods';
import type { MetricDef } from '@openaudit/spec';
import { describe, expect, it } from 'vitest';
import { byHeadline } from './seed-table';

const metric = (key: string, more: Partial<MetricDef> = {}) =>
  ({ key, direction: 'higher_is_better', ...more }) as MetricDef;

const row = (id: string, ranks: Record<string, number | null>, baseline = false) =>
  ({
    variant: { id, baseline },
    cells: new Map(Object.entries(ranks).map(([k, rank]) => [k, { mean: 0, stderr: null, n: 1, rank }])),
  }) as unknown as SeedRow;

const ids = (rows: SeedRow[]) => rows.map((r) => r.variant.id);

describe('byHeadline', () => {
  it('sorts by rank on the headline metric, with unranked rows and baselines last', () => {
    const rows = [
      row('base', { a: null, h: null }, true),
      row('c', { a: 1, h: 3 }),
      row('x', { a: 2 }),
      row('b', { a: 3, h: 1 }),
      row('d', { a: 4, h: 2 }),
    ];
    const out = byHeadline(rows, [metric('a'), metric('h', { headline: true })]);
    expect(out.key).toBe('h');
    expect(ids(out.rows)).toEqual(['b', 'd', 'c', 'base', 'x']);
  });

  it('uses the first ranked metric when no metric is the headline', () => {
    const rows = [row('a', { l0: null, f1: 2 }), row('b', { l0: null, f1: 1 })];
    const out = byHeadline(rows, [metric('l0', { direction: 'neither' }), metric('f1')]);
    expect(out.key).toBe('f1');
    expect(ids(out.rows)).toEqual(['b', 'a']);
  });
});
