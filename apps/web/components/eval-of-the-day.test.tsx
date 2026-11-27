import type { EvalListRow } from '@/components/catalog/eval-browser';
import type { Score } from '@/components/catalog/score';
import { EvalOfTheDay } from '@/components/eval-of-the-day';
import type { DayRow } from '@/lib/server/eval-list-rows';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('nextjs-toploader/app', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const leader = { label: 'Model A', href: '/a/a', score: '0.9', bar: null };
const row = (r: Partial<EvalListRow>): EvalListRow => ({
  slug: 'mask',
  label: 'MASK',
  kind: 'model',
  creator: 'Center for AI Safety',
  date: '2025-03',
  summary: null,
  status: 'active',
  topics: [],
  count: 10,
  worst: [leader],
  best: [leader],
  ...r,
});

afterEach(cleanup);

describe('EvalOfTheDay', () => {
  it('shows "Needs Update" when most of a model eval\'s models are newer than it', () => {
    render(<EvalOfTheDay row={row({ newer: 6 })} />);
    expect(screen.getByText('Needs Update')).toBeTruthy();
  });

  it('shows no "Needs Update" for half or fewer, or for a method eval', () => {
    render(<EvalOfTheDay row={row({ newer: 5 })} />);
    expect(screen.queryByText('Needs Update')).toBeNull();
    cleanup();
    render(<EvalOfTheDay row={row({ kind: 'method', newer: 9 })} />);
    expect(screen.queryByText('Needs Update')).toBeNull();
  });

  it('shows a suite as a suite: its page, medals and no bars; an eval has bars', () => {
    const bar: Score = {
      metric: 'm',
      value: 0.5,
      unit: 'fraction',
      safetyDirection: 'higher_is_better',
      range: [0, 1],
    };
    const top = ['TopK', 'ReLU', 'Gated'].map((label) => ({ ...leader, label, href: `/m/${label}`, bar }));
    render(
      <EvalOfTheDay
        row={row({
          slug: 'bench',
          label: 'Bench',
          kind: 'method',
          top,
          best: top,
          href: '/evaluations/suites/bench',
          evals: 7,
        } as Partial<DayRow>)}
      />,
    );
    expect(screen.getByRole('link', { name: 'Bench' }).getAttribute('href')).toBe('/evaluations/suites/bench');
    expect(screen.getByText('Evaluation Suite')).toBeTruthy();
    expect(screen.getByText('Open Suite')).toBeTruthy();
    expect(screen.getAllByLabelText(/^Rank [123]$/)).toHaveLength(3);
    expect(screen.queryByRole('img', { name: /good for safety/ })).toBeNull();
    cleanup();
    render(<EvalOfTheDay row={row({ kind: 'method', top, best: top })} />);
    expect(screen.getAllByRole('img', { name: /good for safety/ })).toHaveLength(3);
  });
});
