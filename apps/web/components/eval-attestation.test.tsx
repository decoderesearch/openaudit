import { ATTESTED_FLAG } from '@/lib/clearance-token';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AttestationForm, useAttestation } from './eval-attestation';

vi.mock('nextjs-toploader/app', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const accept = async (_url: string, init?: RequestInit) =>
  Response.json(init?.method === 'POST' ? { ok: true } : { siteKey: null });
const fetchMock = vi.fn(accept);

beforeEach(() => vi.stubGlobal('fetch', fetchMock));
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockClear();
  fetchMock.mockImplementation(accept);
});

const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST').length;

describe('AttestationForm', () => {
  it('asks the reader to agree before it sends the statement', async () => {
    const onDone = vi.fn();
    render(<AttestationForm onDone={onDone} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByText(/To view evaluation content, click the checkbox to agree to our/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /^I am not an AI agent\. I will not use/ })).toBeInTheDocument();
    expect(screen.queryByRole('radio')).toBeNull();
    const confirm = screen.getByRole('button', { name: 'Confirm and View Evals' });
    expect(confirm).toHaveClass('bg-emerald-700');

    fireEvent.click(confirm);
    const ask = 'Check the box to agree, then click Confirm and View Evals.';
    expect(await screen.findByText(ask)).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true');
    expect(posts()).toBe(0);

    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.queryByText(ask)).toBeNull();
    fireEvent.click(confirm);
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ client: 'human' }));
    expect(posts()).toBe(1);
    expect(screen.getByRole('button', { name: 'Confirming…' })).toBeDisabled();
  });

  it('shows the error and lets the reader try again when the server refuses', async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? Response.json({ error: 'The browser check failed.' }, { status: 403 })
        : Response.json({ siteKey: null }),
    );
    const onDone = vi.fn();
    render(<AttestationForm onDone={onDone} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and View Evals' }));
    expect(await screen.findByText('The browser check failed.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm and View Evals' })).toBeEnabled();
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('useAttestation', () => {
  function Probe() {
    return <p>{useAttestation()?.client ?? 'none'}</p>;
  }

  beforeEach(() => localStorage.clear());

  it('saves the statement from the unlock link flag, then deletes the flag', async () => {
    render(<Probe />);
    expect(screen.getByText('none')).toBeInTheDocument();
    document.cookie = `${ATTESTED_FLAG}=1; Path=/`;
    render(<Probe />);
    await waitFor(() => expect(screen.getAllByText('human')).toHaveLength(2));
    expect(document.cookie).not.toContain(ATTESTED_FLAG);
  });
});
