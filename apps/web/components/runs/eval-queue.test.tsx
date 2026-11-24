import { TooltipProvider } from '@/components/ui/tooltip';
import type { EvalRow } from '@/lib/server/eval-table';
import type { ItemQuote } from '@/lib/server/run-quotes';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MissingEvalRows, NewEvalButton, type QueueContext } from './eval-queue';

const { enqueueRuns, quoteItems, refresh, announce } = vi.hoisted(() => ({
  enqueueRuns: vi.fn(),
  quoteItems: vi.fn(),
  refresh: vi.fn(),
  announce: vi.fn(),
}));
vi.mock('@/app/runs/actions', () => ({ enqueueRuns, quoteItems }));
vi.mock('nextjs-toploader/app', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/components/my-evals/my-evals', () => ({ useMyEvals: () => ({ announce }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/lib/auth-client', () => ({ authClient: { signIn: { magicLink: vi.fn() } } }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const QUOTE: ItemQuote = {
  ok: true,
  samples: 300,
  basis: 'estimate' as never,
  seconds: 840,
  busyPath: null,
  busyRequested: false,
  repeatPath: null,
  autoApprove: false,
};

const row = (over: Partial<EvalRow> = {}): EvalRow => ({
  evalId: 'e1',
  slug: 'bbq',
  displayName: 'BBQ',
  summary: null,
  version: '2022-05',
  status: 'active',
  topics: [],
  slots: [{ id: 'judge', default: 'openai/gpt-5-mini' } as EvalRow['slots'][number]],
  rawReasoning: false,
  defaultLimit: null,
  state: 'missing',
  runId: null,
  limit: null,
  path: null,
  quote: QUOTE,
  ...over,
});

const ctx = (over: Partial<QueueContext> = {}): QueueContext => ({
  modelId: 'm1',
  model: { displayName: 'Luna', name: 'openai/luna' },
  effort: 'medium',
  mode: 'run',
  signInPath: null,
  ...over,
});

const table = (children: React.ReactNode) =>
  render(
    <TooltipProvider>
      <table>
        <tbody>{children}</tbody>
      </table>
    </TooltipProvider>,
  );

beforeEach(() => {
  enqueueRuns.mockResolvedValue({ ok: true, queued: 1, waiting: 0, repeats: 0 });
  quoteItems.mockImplementation(async (inputs: unknown[]) => inputs.map(() => QUOTE));
});
afterEach(() => vi.clearAllMocks());

describe('MissingEvalRows', () => {
  it('shows the state and estimate, and queues the run with default settings', async () => {
    table(<MissingEvalRows rows={[row()]} ctx={ctx()} />);
    const tr = screen.getByRole('row');
    expect(within(tr).getByText('Not run')).toBeTruthy();
    expect(within(tr).queryByText(/thinking medium/)).toBeNull();
    expect(within(tr).getByText('~14 min')).toBeTruthy();
    await act(async () => fireEvent.click(within(tr).getByRole('button', { name: /Queue Run/ })));
    expect(enqueueRuns).toHaveBeenCalledWith([{ modelId: 'm1', evalId: 'e1', reasoning: 'medium' }]);
    expect(announce).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the eval's first topic and the number of the others, but not its summary (that is in the name's hover)", () => {
    table(<MissingEvalRows rows={[row({ topics: ['bias', 'honesty'], summary: 'Tests social bias.' })]} ctx={ctx()} />);
    const tr = screen.getByRole('row');
    expect(within(tr).getByText(/^Bias/).textContent).toBe('Bias +1');
    expect(within(tr).queryByText('Tests social bias.')).toBeNull();
  });

  it('shows only the state of a running eval, or with no queue context', () => {
    table(
      <>
        <MissingEvalRows rows={[row({ state: 'running', path: '/runs/r1' })]} ctx={ctx()} />
        <MissingEvalRows rows={[row({ evalId: 'e2' })]} ctx={null} />
      </>,
    );
    expect(screen.getByText('Running')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View' }).getAttribute('href')).toBe('/runs/r1');
    expect(screen.queryByRole('button', { name: /Queue Run/ })).toBeNull();
  });
});

describe('NewEvalButton', () => {
  const evals = [row(), row({ evalId: 'e2', displayName: 'MASK', version: '2025-03-05', slots: [] })];

  it('queues the eval with the chosen settings', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <NewEvalButton
        ctx={ctx()}
        efforts={['medium']}
        evals={evals}
        judges={['google/gemini-3.8-flash']}
        route="OpenRouter"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /New Evaluation/ }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Samples'), { target: { value: '50' } });
    fireEvent.change(within(dialog).getByLabelText('Judge'), { target: { value: 'google/gemini-3.8-flash' } });
    await act(async () => vi.advanceTimersByTime(400));
    expect(within(dialog).getByText(/First 50 samples · Estimated time ~14 min/)).toBeTruthy();
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: /Queue Run/ })));
    expect(enqueueRuns).toHaveBeenCalledWith([
      { modelId: 'm1', evalId: 'e1', reasoning: 'medium', limit: 50, models: { judge: 'google/gemini-3.8-flash' } },
    ]);
    expect(screen.queryByRole('dialog')).toBeNull();
    vi.useRealTimers();
  });

  it('asks guests to sign up in a dialog, with the sign-up form', () => {
    render(
      <NewEvalButton
        ctx={ctx({ mode: 'request', signInPath: '/signin' })}
        efforts={['medium']}
        evals={evals}
        judges={[]}
        route="OpenRouter"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /New Evaluation/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Sign Up to Queue an Evaluation')).toBeTruthy();
    expect(within(dialog).getByLabelText('Email')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: /Send sign-in link/ })).toBeTruthy();
  });
});
