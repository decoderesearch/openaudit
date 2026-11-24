import { BestWorst } from '@/components/catalog/leaders';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Leader } from '@/lib/leaders';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('nextjs-toploader/app', () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(cleanup);

const leader = (label: string, model: string | null): Leader => ({
  label,
  href: `/a/${label}`,
  score: '50%',
  bar: null,
  released: { model, eval: '2025-06' },
});

const best = [leader('New Best', '2026-01-02'), leader('Old Best', '2025-01-02')];
const worst = [leader('New Worst', '2026-01-02')];
const warning = /released \(.*\) after the eval/;

describe('BestWorst', () => {
  it('warns only on a best model released after the eval, with warnBest', () => {
    render(
      <TooltipProvider>
        <BestWorst best={best} worst={worst} compact warnBest />
      </TooltipProvider>,
    );
    const item = (name: string) => screen.getByRole('link', { name }).closest('li')!;
    expect(within(item('New Best')).getByRole('button', { name: warning })).toBeTruthy();
    expect(within(item('Old Best')).queryByRole('button', { name: warning })).toBeNull();
    expect(within(item('New Worst')).queryByRole('button', { name: warning })).toBeNull();
  });

  it('shows no warning without warnBest', () => {
    render(<BestWorst best={best} worst={worst} compact />);
    expect(screen.queryByRole('button', { name: warning })).toBeNull();
  });
});
