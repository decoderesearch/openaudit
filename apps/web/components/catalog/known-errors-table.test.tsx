import type { KnownErrorItem } from '@/lib/sample-issues';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KnownErrorsTable } from './known-errors-table';

const reviewIssuesAction = vi.hoisted(() => vi.fn(async () => ({ ok: true as const, changed: 1 })));
const refresh = vi.hoisted(() => vi.fn());
vi.mock('@/app/evaluations/[slug]/known-errors/actions', () => ({ reviewIssuesAction }));
vi.mock('nextjs-toploader/app', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const issue = (id: string, status: KnownErrorItem['status'], note: string | null = `Note ${id}`): KnownErrorItem => ({
  id,
  href: `/samples/${id}`,
  split: 'test',
  sourceId: `S${id}`,
  graded: 20,
  found: '20/20',
  kind: 'label_error',
  status,
  effect: 'exclude',
  note,
  source: 'llm_review',
});

const issues = [issue('1', 'confirmed'), issue('2', 'proposed'), issue('3', 'rejected')];

describe('KnownErrorsTable', () => {
  it('shows the public only confirmed issues, with notes when they can read the samples', () => {
    render(<KnownErrorsTable slug="e" issues={[issues[0]!]} admin={false} />);
    expect(screen.getByRole('link', { name: 'S1' })).toHaveAttribute('href', '/samples/1');
    expect(screen.getByText('Note 1')).toBeInTheDocument();
    expect(screen.getByText('Label error')).toBeInTheDocument();
    expect(screen.getByText('20/20')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
  });

  it('shows the hidden text in place of a note that the reader cannot read', () => {
    const { rerender } = render(<KnownErrorsTable slug="e" issues={[issue('1', 'confirmed', null)]} admin={false} />);
    expect(screen.getByText('Hidden by the dataset terms')).toBeInTheDocument();
    rerender(<KnownErrorsTable slug="e" issues={[issue('1', 'confirmed', null)]} hiddenText="Confirm" admin={false} />);
    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });

  it('starts admins on the proposed issues and confirms the selected ones', async () => {
    vi.stubGlobal('confirm', () => true);
    render(<KnownErrorsTable slug="e" issues={issues} admin />);
    expect(screen.getByText('Note 2')).toBeInTheDocument();
    expect(screen.queryByText('Note 1')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select S2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(reviewIssuesAction).toHaveBeenCalledWith('e', ['2'], 'confirmed'));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('lists issues of many evals, filters by eval, and reviews them without a slug', async () => {
    vi.stubGlobal('confirm', () => true);
    const a = { slug: 'a', name: 'Eval A', version: 'v1' };
    const b = { slug: 'b', name: 'Eval B', version: 'v1' };
    const mixed = [
      { ...issue('1', 'proposed'), eval: a },
      { ...issue('2', 'proposed'), eval: b },
    ];
    render(<KnownErrorsTable slug={null} issues={mixed} admin />);
    expect(screen.getByRole('link', { name: 'Eval A' })).toHaveAttribute('href', '/evaluations/a/known-errors');
    expect(screen.getByText('Note 2')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Eval' }), { target: { value: 'a v1' } });
    expect(screen.queryByText('Note 2')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(reviewIssuesAction).toHaveBeenCalledWith(null, ['1'], 'confirmed'));
  });
});
