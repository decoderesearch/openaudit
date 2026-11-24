import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ evalRun: { findUnique: vi.fn() } }));
const sendRunEmail = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({ prisma: db }));
vi.mock('@/lib/server/run-emails', async (importActual) => ({
  ...(await importActual<typeof import('./run-emails')>()),
  sendRunEmail,
}));

import { runEnded } from './run-ended';

beforeEach(() => {
  vi.clearAllMocks();
  sendRunEmail.mockResolvedValue('sent');
});

describe('runEnded', () => {
  it('emails the owner when the run is done', async () => {
    db.evalRun.findUnique.mockResolvedValue({ status: 'failed' });
    expect(await runEnded('run-1')).toEqual({ status: 'failed', email: 'sent' });
    expect(sendRunEmail).toHaveBeenCalledWith('run-1', 'run_failed');
  });

  it('does nothing for a run that is not done, or no run', async () => {
    db.evalRun.findUnique.mockResolvedValue({ status: 'running' });
    expect(await runEnded('run-1')).toEqual({ status: 'running', email: 'not_done' });
    db.evalRun.findUnique.mockResolvedValue(null);
    expect(await runEnded('run-1')).toBeNull();
    expect(sendRunEmail).not.toHaveBeenCalled();
  });
});
