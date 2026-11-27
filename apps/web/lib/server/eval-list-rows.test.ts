import type { EvalListRow } from '@/components/catalog/eval-browser';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ prisma: {} }));

import { evalOfTheDay } from './eval-list-rows';

const row = (slug: string, kind: 'model' | 'method' = 'model'): EvalListRow =>
  ({ slug, label: slug, kind, count: 1, best: [{}] }) as unknown as EvalListRow;
const models = ['agentharm', 'wmdp', 'strongreject', 'mask'].map((s) => row(s));
const methods = [row('sae-probe', 'method')];
const on = (iso: string) => evalOfTheDay(models, methods, new Date(iso))?.slug;

describe('evalOfTheDay', () => {
  it('shows AgentHarm on 2026-11-25 (UTC), then each eval in turn', () => {
    expect(on('2026-11-25T00:00:00Z')).toBe('agentharm');
    expect(on('2026-11-25T23:59:59Z')).toBe('agentharm');
    const turn = Array.from({ length: 5 }, (_, d) => on(`2026-11-${26 + d}T12:00:00Z`));
    expect(new Set(turn).size).toBe(5);
    expect(turn[4]).toBe('agentharm');
    expect(on('2026-11-24T12:00:00Z')).toBe(turn[3]);
  });

  it('skips evals with no results', () => {
    const none = { ...row('agentharm'), count: 0 };
    expect(evalOfTheDay([none, row('wmdp')], [], new Date('2026-11-25T12:00:00Z'))?.slug).toBe('wmdp');
    expect(evalOfTheDay([none], [])).toBeNull();
  });

  it("shows a suite of 2 or more evals as one row, not its evals; a suite's only eval is a plain row", () => {
    const suite = {
      slug: 'bench',
      label: 'Bench',
      summary: 'All of Bench.',
      creator: 'Lab',
      date: '2025-01',
      order: [],
    };
    const lone = { ...suite, slug: 'solo', label: 'Solo' };
    const v = (name: string) => ({ label: name, href: `/m/${name}`, score: '', bar: null });
    const member = (slug: string, top: string[]) =>
      ({
        ...row(slug, 'method'),
        suite,
        topics: ['interpretability'],
        top: top.map(v),
        best: top.map(v),
      }) as EvalListRow;
    const rows = [
      member('bench-a', ['x', 'y', 'z']),
      member('bench-b', ['y', 'x', 'w']),
      member('bench-c', ['y', 'z', 'x']),
      { ...row('solo-a', 'method'), suite: lone },
    ];
    const seen = Array.from({ length: 4 }, (_, d) => evalOfTheDay([], rows, new Date(Date.UTC(2026, 10, 25 + d))));
    expect(new Set(seen.map((r) => r?.slug))).toEqual(new Set(['bench', 'solo-a']));
    const bench = seen.find((r) => r?.slug === 'bench')!;
    expect(bench).toMatchObject({
      label: 'Bench',
      href: '/evaluations/suites/bench',
      evals: 3,
      summary: 'All of Bench.',
    });
    // y: 2 + 3 + 3 = 8; x: 3 + 2 + 1 = 6; z: 1 + 2 = 3.
    expect(bench.top!.map((l) => l.label)).toEqual(['y', 'x', 'z']);
  });
});
