import type { RunRef } from '@/components/evidence-hover';
import { NewEvalProvider, NotRunEvals, useNewEval } from '@/components/runs/new-eval-context';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TopicRuns, TopicSnippets, type SnippetView } from './openaudit-card-client';
vi.mock('next/navigation', () => ({ usePathname: () => '/qwen/qwen3' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const snippet = (id: string, category: string, topics: string[], severity: SnippetView['severity'] = 'low') =>
  ({
    id,
    href: `/runs/r/attempts/${id}`,
    evalName: 'E',
    ordinal: 1,
    sample: { id: '39-1' },
    category,
    topics,
    severity,
    reason: `${id} reason`,
  }) satisfies SnippetView;

describe('topic pills', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const openCard = (name: string) => {
    fireEvent.click(screen.getByRole('button', { name }));
    return document.querySelector<HTMLElement>('[data-slot=popover-content]')!;
  };

  it('counts all but low chats, lists all on a click, most severe first, and a click on the pill closes and opens them', () => {
    render(
      <TopicSnippets
        snippets={[
          snippet('a', 'honesty', ['honesty'], 'low'),
          { ...snippet('b', 'honesty', ['honesty'], 'high'), title: 'False denial' },
        ]}
      />,
    );
    const card = openCard('1 Flagged Chat High/Mid Severity');
    expect(within(card).getByRole('heading', { name: 'False denial' }).nextSibling!.textContent).toMatch(/^b reason/);
    expect([...card.querySelectorAll('li p')].map((p) => p.textContent)).toEqual(['b reason', 'a reason']);
    const links = within(card).getAllByRole('link', { name: 'E · sample 39-1' });
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/runs/r/attempts/b?snippet=b',
      '/runs/r/attempts/a?snippet=a',
    ]);
    const pill = screen.getByRole('button', { name: '1 Flagged Chat High/Mid Severity' });
    fireEvent.click(pill);
    expect(document.querySelector('[data-slot=popover-content]')).toBeNull();
    fireEvent.click(pill);
    expect(document.querySelector('[data-slot=popover-content]')).toBeTruthy();
  });

  it('counts the low chats of a pill with only low chats, in grey', () => {
    render(<TopicSnippets snippets={[snippet('a', 'honesty', ['honesty'], 'low')]} />);
    expect(screen.getByRole('button', { name: '1 Flagged Chat Low Severity' }).className).toContain('bg-slate-100');
    const card = openCard('1 Flagged Chat Low Severity');
    expect([...card.querySelectorAll('li p')].map((p) => p.textContent)).toEqual(['a reason']);
  });

  it('shows the evals and their results in a table on a click', () => {
    const runs: RunRef[] = [
      {
        href: '/runs/x',
        evalName: 'MASK',
        date: '2026-10-01',
        samples: 1000,
        result: { metric: 'honesty', value: 0.9, unit: 'fraction' },
        place: { rank: 14, of: 20 },
      },
      { href: '/runs/y', evalName: 'Petri', date: '2026-10-01', samples: 1, limited: true, result: null },
      {
        href: '/runs/z',
        evalName: 'BrokenMath',
        date: '2026-10-01',
        result: { metric: 'sycophancy_rate', value: 0.1, unit: 'fraction', safetyDirection: 'lower_is_better' },
      },
    ];
    render(<TopicRuns topic="honesty" runs={runs} />);
    const card = openCard('3 Evaluation Runs');
    expect(within(card).queryByText(/^We have not run/)).toBeNull();
    const rows = within(card).getAllByRole('row');
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('MASK1,000 Chats Tested14th of 20honesty0.9'),
      expect.stringMatching(/^Petri.*limited1 Chat Tested.*No result$/),
      expect.stringContaining('BrokenMath'),
    ]);
    expect(within(rows[0]!).queryByRole('img')).toBeNull();
    expect(within(rows[2]!).getByRole('img', { name: '90% good for safety' })).toBeTruthy();
    expect(within(card).getByRole('link', { name: 'MASK' }).getAttribute('href')).toBe('/runs/x');
  });

  it('lists the system card results under Unverified Runs, but does not count them, and a click on the pill closes and opens them', () => {
    render(
      <TopicRuns
        topic="honesty"
        runs={[]}
        results={[
          { name: 'MASK', details: 'effort high', result: { metric: 'honest', value: 0.98, unit: 'fraction' } },
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: '0 Evaluation Runs' }).className).toContain('bg-amber-50');
    const card = openCard('0 Evaluation Runs');
    expect(within(card).getByText('Unverified Runs')).toBeTruthy();
    expect(within(card).getByText(/developer or their auditors ran/)).toBeTruthy();
    expect(within(card).getByRole('row').textContent).toMatch(/^MASK.*effort high/);
    const pill = screen.getByRole('button', { name: '0 Evaluation Runs' });
    fireEvent.click(pill);
    expect(document.querySelector('[data-slot=popover-content]')).toBeNull();
    fireEvent.click(pill);
    expect(document.querySelector('[data-slot=popover-content]')).toBeTruthy();
  });

  it('with no runs, shows an amber pill that lists the evals not run yet, with no new eval button', () => {
    const open = vi.fn();
    function Opener() {
      const setOpen = useNewEval()?.setOpen;
      useEffect(() => setOpen?.(open), [setOpen]);
      return null;
    }
    render(
      <NewEvalProvider>
        <NotRunEvals
          evals={[
            { evalId: 'e1', slug: 'mask', displayName: 'MASK', topics: ['honesty'], state: 'missing' },
            { evalId: 'e2', slug: 'petri', displayName: 'Petri', topics: ['honesty'], state: 'running' },
            { evalId: 'e3', slug: 'wmdp', displayName: 'WMDP', topics: ['cyber'], state: 'missing' },
          ]}
        />
        <Opener />
        <TopicRuns topic="honesty" runs={[]} />
      </NewEvalProvider>,
    );
    expect(screen.getByRole('button', { name: '0 Evaluation Runs' }).className).toContain('bg-amber-50');
    const card = openCard('0 Evaluation Runs');
    expect(within(card).getByText('Not Run Yet')).toBeTruthy();
    expect(within(card).queryByText('WMDP')).toBeNull();
    expect(within(card).getByText('Running')).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: 'Queue Run' }));
    expect(open).toHaveBeenCalledWith('e1');
    expect(within(card).queryByText(/We don't have an evaluation available/)).toBeNull();
    expect(within(card).queryByRole('button', { name: /Suggest New Eval/ })).toBeNull();
  });

  it('says when no eval covers the topic', () => {
    render(<TopicRuns topic="welfare" runs={[]} noEvals />);
    const card = openCard('0 Evaluation Runs');
    expect(within(card).getByText("We don't have an evaluation available for Welfare.")).toBeTruthy();
  });
});
