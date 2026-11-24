import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRun = vi.hoisted(() => vi.fn());
const getShownAttempt = vi.hoisted(() => vi.fn());
const attemptLog = vi.hoisted(() => vi.fn());
const r2Get = vi.hoisted(() => vi.fn());

vi.mock('@/lib/server/runs', () => ({ getRun, getShownAttempt }));
vi.mock('@/lib/server/attempt-log', () => ({ attemptLog }));
vi.mock('@/lib/server/r2', () => ({ r2Get }));
vi.mock('@/lib/server/limits', () => ({ allow: async () => true, tooMany: () => new Response(null, { status: 429 }) }));
vi.mock('@/lib/server/eval-clearance', () => ({ hasEvalClearance: async () => true, clearanceRequired: vi.fn() }));
vi.mock('@/lib/eval-attestation', () => ({ readAttestation: () => ({ ok: true }), attestationRequired: vi.fn() }));

import { GET as attemptGet } from '@/app/runs/[id]/attempts/[n]/log/route';
import { GET as redactedLog } from '@/app/runs/[id]/log/redacted/route';
import { GET as fullLog } from '@/app/runs/[id]/log/route';

const RUN_ID = '0199a3b2-1c2d-7e3f-8a9b-0c1d2e3f4a5b';
const ready = { key: 'runs/r/redacted/abc.eval', bytes: 10, omit: ['bad'], ready: true, rule: 'open' };

function found({ staff = false, redacted = ready as typeof ready | null } = {}) {
  return {
    run: { id: RUN_ID },
    eval: { slug: 'xstest' },
    logKey: 'runs/r/log.eval',
    logRule: 'open',
    redacted,
    access: { staff, canRead: () => true, allows: () => true },
  };
}

const attemptCall = (n = 4) =>
  attemptGet(new Request('http://x/'), { params: Promise.resolve({ id: RUN_ID, n: String(n) }) });
const runCall = (get: typeof fullLog) => get(new Request('http://x/'), { params: Promise.resolve({ id: RUN_ID }) });

beforeEach(() => {
  vi.clearAllMocks();
  attemptLog.mockResolvedValue(new Uint8Array([1, 2, 3]));
  r2Get.mockResolvedValue(new Response('zip', { headers: { 'content-length': '3' } }));
});

describe('the log of one attempt', () => {
  it('comes from the redacted copy for the public', async () => {
    getRun.mockResolvedValue(found());
    getShownAttempt.mockResolvedValue({ id: 'ok', ordinal: 4 });
    const res = await attemptCall();
    expect(res.status).toBe(200);
    expect(attemptLog.mock.lastCall?.[0]).toBe(ready.key);
    expect(res.headers.get('content-disposition')).toContain('-4.eval');
  });

  it('comes from the full log for staff, also for a withheld reply', async () => {
    getRun.mockResolvedValue(found({ staff: true }));
    getShownAttempt.mockResolvedValue({ id: 'bad', ordinal: 4, withheld: true });
    expect((await attemptCall()).status).toBe(200);
    expect(attemptLog.mock.lastCall?.[0]).toBe('runs/r/log.eval');
  });

  it.each([
    ['a withheld reply', { id: 'x', ordinal: 4, withheld: true }, ready, 403],
    ['an attempt that the copy leaves out', { id: 'bad', ordinal: 4 }, ready, 403],
    ['a copy that is not ready', { id: 'ok', ordinal: 4 }, { ...ready, ready: false }, 409],
    ['no copy', { id: 'ok', ordinal: 4 }, null, 409],
    ['a hidden attempt', { id: 'ok', ordinal: 4, hidden: true }, ready, 403],
  ])('is refused for %s', async (_, attempt, redacted, status) => {
    getRun.mockResolvedValue(found({ redacted }));
    getShownAttempt.mockResolvedValue(attempt);
    expect((await attemptCall()).status).toBe(status);
    expect(attemptLog).not.toHaveBeenCalled();
  });
});

describe('the run logs', () => {
  it('give the full log to staff only', async () => {
    getRun.mockResolvedValue(found());
    expect((await runCall(fullLog)).status).toBe(403);
    getRun.mockResolvedValue(found({ staff: true }));
    expect((await runCall(fullLog)).status).toBe(200);
    expect(r2Get).toHaveBeenCalledWith('runs/r/log.eval');
  });

  it('give the redacted copy to all, when it is ready', async () => {
    getRun.mockResolvedValue(found());
    const res = await runCall(redactedLog);
    expect(res.status).toBe(200);
    expect(r2Get).toHaveBeenCalledWith(ready.key);
    expect(res.headers.get('content-disposition')).toContain('-redacted.eval');
    getRun.mockResolvedValue(found({ redacted: { ...ready, ready: false } }));
    expect((await runCall(redactedLog)).status).toBe(409);
  });
});
