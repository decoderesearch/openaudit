import { evalsTooOld, evalsTooOldFor } from '@/lib/server/eval-age';
import { describe, expect, it, vi } from 'vitest';

const ev = (released: string | null, status = 'active', rawReasoning = false) => ({ released, status, rawReasoning });

vi.mock('@/lib/server/runs', () => ({
  runnableEvals: vi.fn(async () => [
    ev('2025-03'),
    ev('2025-06-20'),
    ev('2026-08'),
    ev('2026-11-01', 'active', true),
    ev('2024-01', 'legacy'),
    ev(null),
  ]),
}));

const model = (date: string | null, source = 'api') => ({ source, facts: date ? { releaseDate: { value: date } } : {} });

describe('evalsTooOld', () => {
  it('is true only when more than half of the evals are older', () => {
    expect(evalsTooOld({ evals: 12, older: 7 })).toBe(true);
    expect(evalsTooOld({ evals: 12, older: 6 })).toBe(false);
    expect(evalsTooOld({ evals: 0, older: 0 })).toBe(false);
  });
});

describe('evalsTooOldFor', () => {
  it('counts the active evals of the model, at the precision of both dates', async () => {
    // An API model has 4 evals (no raw reasoning, no legacy); one has no date.
    expect(await evalsTooOldFor([model('2026-09-01')])).toEqual([true]);
    expect(await evalsTooOldFor([model('2026-08-30')])).toEqual([false]);
    // An open model also gets the raw reasoning eval: 2 of 5 are older.
    expect(await evalsTooOldFor([model('2026-08-30', 'open')])).toEqual([false]);
    expect(await evalsTooOldFor([model(null)])).toEqual([false]);
  });
});
