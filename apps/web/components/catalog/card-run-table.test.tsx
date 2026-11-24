import { CardRunTable } from '@/components/catalog/card-run-table';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { EvalPlace } from '@/lib/server/eval-ranks';
import type { LatestRun } from '@/lib/server/latest-runs';
import { runPath } from '@/lib/server/runs';
import type { Topic } from '@openaudit/spec';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ prisma: {} }));

const run = (n: number, evalId: string, topics: Topic[], released = { model: '2026-10', eval: '2027' }) =>
  ({
    run: { id: `00000000-0000-4000-8000-00000000000${n}`, evalId, status: 'succeeded', origin: 'openaudit' },
    eval: { slug: evalId, displayName: evalId.toUpperCase(), status: 'active', topics },
    result: { metric: 'Accuracy', value: 80, unit: 'percent', safetyDirection: 'higher_is_better' },
    released,
  }) as unknown as LatestRun;

const place = (r: LatestRun, rank: number): EvalPlace => ({ rank, of: 20, href: runPath(r.run), result: null });

const show = (runs: LatestRun[], places: Record<string, EvalPlace> = {}) =>
  render(
    <TooltipProvider>
      <CardRunTable runs={runs} places={places} />
    </TooltipProvider>,
  );

describe('CardRunTable', () => {
  it('warns when the model came out after the eval', () => {
    show([run(1, 'a', [], { model: '2026-10-02', eval: '2024-10' }), run(2, 'b', [])]);
    const [a, b] = screen.getAllByRole('row');
    expect(
      within(a!).getByRole('button', { name: /released \(Oct 2, 2026\) after the eval \(Oct 2024\)/ }),
    ).toBeTruthy();
    expect(within(b!).queryByRole('button', { name: /released/ })).toBeNull();
  });

  it('shows at most 1 topic, then the number of the others', () => {
    show([run(1, 'a', ['bias']), run(2, 'b', ['bias', 'honesty', 'jailbreaks', 'cyber'])]);
    const [a, b] = screen.getAllByRole('row');
    expect(within(a!).getByText('Bias')).toBeTruthy();
    expect(within(b!).getByText(/^Bias/).textContent).toBe('Bias +3');
  });

  it("shows only the model's place in place of the bar, when it is of the run", () => {
    const [a, b, c] = [run(1, 'a', []), run(2, 'b', []), run(3, 'c', [])];
    show([a, b, c], { a: place(a, 14), b: { ...place(b, 2), href: '/runs/other' } });
    const [ra, rb, rc] = screen.getAllByRole('row');
    expect(within(ra!).getByTitle('14th of 20 models')).toBeTruthy();
    expect(within(ra!).queryByRole('img')).toBeNull();
    expect(within(ra!).queryByText('80%')).toBeNull();
    expect(within(rb!).queryByTitle(/of 20 models/)).toBeNull();
    expect(within(rb!).getByRole('img')).toBeTruthy();
    expect(within(rc!).getByRole('img')).toBeTruthy();
  });

  it('puts the worst place among the models first, and the runs with no place last', () => {
    const [a, b, c, d] = [run(1, 'a', []), run(2, 'b', []), run(3, 'c', []), run(4, 'd', [])];
    show([a, b, c, d], { b: place(b, 2), c: place(c, 19), d: { ...place(d, 5), of: 5 } });
    expect(screen.getAllByRole('row').map((r) => within(r).getByRole('link', { name: /^[A-D]$/ }).textContent)).toEqual(
      ['D', 'C', 'B', 'A'],
    );
  });
});
