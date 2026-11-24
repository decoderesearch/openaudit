import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  evalRun: { count: vi.fn(), createMany: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
}));
const runRequest = vi.hoisted(() => vi.fn());
const repeatRuns = vi.hoisted(() => vi.fn());
const priceItems = vi.hoisted(() => vi.fn());
const sendOnce = vi.hoisted(() => vi.fn());
const adminEmails = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({ prisma: db }));
vi.mock('@/lib/server/run-checks', () => ({ runRequest, repeatRuns, priceItems }));
vi.mock('@/lib/server/run-emails', () => ({ sendOnce }));
vi.mock('@/lib/server/admins', () => ({ adminEmails }));
vi.mock('@/lib/server/estimates', () => ({ estimateRuns: async (items: unknown[]) => items.map(() => 600) }));
vi.mock('@/lib/server/runs', () => ({ runPath: (r: { id: string }) => `/runs/${r.id}` }));

import { AUTO_APPROVE_MAX_USD, AUTO_APPROVE_PER_DAY, DECLINED } from '@/lib/runs/requests';
import type { Viewer } from '@/lib/server/viewer';
import {
  MAX_OPEN_REQUESTS,
  alertRequest,
  approveRequest,
  createRequests,
  declineRequest,
  estimateRequests,
  requestInput,
} from './run-requests';

const MODEL_ID = '01a0ec2b-5491-76cb-8d9c-90a687bbce68';
const viewer = { id: 'user-1', name: 'Ada', username: 'ada', email: 'ada@example.com' } as Viewer;
const input = (evalId: string, limit?: number) => ({ modelId: MODEL_ID, evalId, reasoning: 'none' as const, limit });
const request = (evalId: string, autoApprove = false) => ({
  modelId: MODEL_ID,
  modelName: 'Qwen/Qwen3.6-27B',
  modelLabel: 'Qwen3.6 27B',
  evalId,
  evalLabel: evalId.toUpperCase(),
  versionId: `ver-${evalId}`,
  autoApprove,
  route: { kind: 'openrouter', model: 'qwen/qwen3.6-27b' },
  settings: { reasoning: 'none' },
  slots: {},
});

beforeEach(() => {
  vi.clearAllMocks();
  runRequest.mockImplementation(async (i: { evalId: string }) => ({ ok: true, request: request(i.evalId) }));
  repeatRuns.mockImplementation(async (rs: unknown[]) => rs.map(() => null));
  db.evalRun.count.mockResolvedValue(0);
});

describe('createRequests', () => {
  it('makes a requested run for each new request, owned by the viewer', async () => {
    const result = await createRequests([input('a'), input('b')], viewer);
    expect(result.ok).toBe(true);
    const rows = db.evalRun.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(2);
    expect(
      rows.map((r: { status: string; ownerUserId: string; origin: string }) => [r.status, r.ownerUserId, r.origin]),
    ).toEqual([
      ['requested', 'user-1', 'run'],
      ['requested', 'user-1', 'run'],
    ]);
    if (result.ok) {
      expect(result.paths).toEqual(rows.map((r: { id: string }) => `/runs/${r.id}`));
      expect(result.created.map((c) => c.label)).toEqual(['A on Qwen3.6 27B', 'B on Qwen3.6 27B']);
    }
  });

  it('skips a request that repeats an earlier run, and gives that run', async () => {
    repeatRuns.mockResolvedValue([{ id: 'old-1', status: 'failed' }, null]);
    const result = await createRequests([input('a'), input('b')], viewer);
    const rows = db.evalRun.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(1);
    expect(result).toEqual({
      ok: true,
      paths: ['/runs/old-1', `/runs/${rows[0].id}`],
      created: [{ id: rows[0].id, label: 'B on Qwen3.6 27B', status: 'requested', settings: { reasoning: 'none' } }],
      repeats: 1,
    });
  });

  it('refuses when every request repeats an earlier run', async () => {
    repeatRuns.mockResolvedValue([{ id: 'old-1', status: 'succeeded' }]);
    const result = await createRequests([input('a')], viewer);
    expect(result.ok).toBe(false);
    expect(db.evalRun.createMany).not.toHaveBeenCalled();
  });

  it('queues a cheap request of an auto-approve eval at once', async () => {
    const now = new Date('2026-10-02T12:00:00Z');
    runRequest.mockImplementation(async (i: { evalId: string }) => ({
      ok: true,
      request: request(i.evalId, i.evalId !== 'c'),
    }));
    priceItems.mockResolvedValue([
      { ok: true, quote: { estCostUsd: 0.5 } },
      { ok: true, quote: { estCostUsd: AUTO_APPROVE_MAX_USD + 1 } },
    ]);
    const result = await createRequests([input('a'), input('b'), input('c')], viewer, now);
    expect(priceItems).toHaveBeenCalledWith([input('a'), input('b')]);
    const rows = db.evalRun.createMany.mock.calls[0][0].data;
    expect(rows.map((r: { status: string; approvedAt?: Date }) => [r.status, r.approvedAt])).toEqual([
      ['queued', now],
      ['requested', undefined],
      ['requested', undefined],
    ]);
    expect(result.ok && result.created.map((c) => c.status)).toEqual(['queued', 'requested', 'requested']);
  });

  it('stops auto-approval at the daily limit for each user', async () => {
    runRequest.mockImplementation(async (i: { evalId: string }) => ({ ok: true, request: request(i.evalId, true) }));
    priceItems.mockResolvedValue([
      { ok: true, quote: { estCostUsd: 0.5 } },
      { ok: true, quote: { estCostUsd: 0.5 } },
    ]);
    db.evalRun.count.mockResolvedValue(AUTO_APPROVE_PER_DAY - 1);
    const result = await createRequests([input('a'), input('b')], viewer);
    expect(result.ok && result.created.map((c) => c.status)).toEqual(['queued', 'requested']);
  });

  it('makes no run when one request is bad', async () => {
    runRequest.mockImplementation(async (i: { evalId: string }) =>
      i.evalId === 'b' ? { ok: false, error: 'This eval cannot run here.' } : { ok: true, request: request(i.evalId) },
    );
    expect(await createRequests([input('a'), input('b')], viewer)).toEqual({
      ok: false,
      error: 'Request 2: This eval cannot run here.',
    });
    expect(db.evalRun.createMany).not.toHaveBeenCalled();
  });

  it('refuses the same request twice and an empty list', async () => {
    expect((await createRequests([input('a'), input('a')], viewer)).ok).toBe(false);
    expect((await createRequests([], viewer)).ok).toBe(false);
    expect(db.evalRun.createMany).not.toHaveBeenCalled();
  });

  it('caps the requests that one user has waiting', async () => {
    db.evalRun.count.mockResolvedValue(MAX_OPEN_REQUESTS - 1);
    const result = await createRequests([input('a'), input('b')], viewer);
    expect(result.ok).toBe(false);
    expect(db.evalRun.count).toHaveBeenCalledWith({ where: { ownerUserId: 'user-1', status: 'requested' } });
    expect(db.evalRun.createMany).not.toHaveBeenCalled();
  });
});

describe('approveRequest and declineRequest', () => {
  const now = new Date('2026-10-02T12:00:00Z');

  it('approves only a requested run of an active eval, and records the admin', async () => {
    db.evalRun.updateMany.mockResolvedValue({ count: 1 });
    db.evalRun.findUniqueOrThrow.mockResolvedValue({ settings: { reasoning: 'none', limit: 5 } });
    expect(await approveRequest('run-1', 'admin-1', now)).toEqual({ settings: { reasoning: 'none', limit: 5 } });
    expect(db.evalRun.updateMany).toHaveBeenCalledWith({
      where: { id: 'run-1', status: 'requested', eval: { is: { status: 'active' } } },
      data: { status: 'queued', approvedById: 'admin-1', approvedAt: now },
    });
    db.evalRun.updateMany.mockResolvedValue({ count: 0 });
    expect(await approveRequest('run-1', 'admin-1', now)).toBeNull();
  });

  it('declines only a requested run', async () => {
    db.evalRun.updateMany.mockResolvedValue({ count: 1 });
    expect(await declineRequest('run-1', now)).toBe(true);
    expect(db.evalRun.updateMany).toHaveBeenCalledWith({
      where: { id: 'run-1', status: 'requested' },
      data: { status: 'cancelled', error: DECLINED, finishedAt: now },
    });
    db.evalRun.updateMany.mockResolvedValue({ count: 0 });
    expect(await declineRequest('run-1', now)).toBe(false);
  });
});

describe('requestInput and estimateRequests', () => {
  const run = {
    modelId: MODEL_ID,
    evalId: 'a',
    evalVersionId: 'ver-a',
    settings: {
      reasoning: 'high' as const,
      limit: 20,
      models: { judge: { kind: 'openrouter' as const, model: 'openai/gpt-4o' } },
    },
  };

  it('reads the request back from the run settings', () => {
    expect(requestInput(run)).toEqual({
      modelId: MODEL_ID,
      evalId: 'a',
      reasoning: 'high',
      limit: 20,
      models: { judge: 'openai/gpt-4o' },
    });
  });

  it('gives our cost and time, or why there is no price', async () => {
    priceItems.mockResolvedValue([
      { ok: true, quote: { samples: 20, estCostUsd: 1.25 } },
      { ok: false, error: 'This eval cannot run here.' },
    ]);
    expect(await estimateRequests([run, run])).toEqual([
      { costUsd: 1.25, seconds: 600, error: null },
      { costUsd: null, seconds: 600, error: 'This eval cannot run here.' },
    ]);
  });
});

describe('alertRequest', () => {
  it('sends one email to the admins for a batch, keyed by its first run', async () => {
    adminEmails.mockResolvedValue(['admin@example.com']);
    sendOnce.mockResolvedValue('sent');
    await alertRequest(viewer, [
      { id: 'run-1', label: 'A on Qwen3.6 27B' },
      { id: 'run-2', label: 'B on Qwen3.6 27B' },
    ]);
    expect(sendOnce).toHaveBeenCalledTimes(1);
    const [runId, type, to, content] = sendOnce.mock.calls[0];
    expect([runId, type, to]).toEqual(['run-1', 'run_request_alert', ['admin@example.com']]);
    expect(content.subject).toContain('2 run requests from Ada');
    expect(content.text).toContain('Ada @ada <ada@example.com> asked for 2 runs.');
  });

  it('sends nothing for no runs', async () => {
    await alertRequest(viewer, []);
    expect(adminEmails).not.toHaveBeenCalled();
  });
});
