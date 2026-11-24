import { describe, expect, it, vi } from 'vitest';
import type { EvalListRow } from '@/components/catalog/eval-browser';

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
});
