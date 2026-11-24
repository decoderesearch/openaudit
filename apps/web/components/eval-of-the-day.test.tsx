import type { EvalListRow } from '@/components/catalog/eval-browser';
import { EvalOfTheDay } from '@/components/eval-of-the-day';
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
});
