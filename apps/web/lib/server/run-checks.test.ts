import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  evalRun: { findMany: vi.fn() },
  model: { findUnique: vi.fn() },
}));
const runnableEvals = vi.hoisted(() => vi.fn());
const routeFor = vi.hoisted(() => vi.fn());
const effortsFor = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({ prisma: db }));
vi.mock('@/lib/runs/model-routes', () => ({ routeFor, effortsFor }));
vi.mock('@/lib/server/runs', () => ({ runnableEvals }));

import { DATED_EVAL, DEFAULT_EFFORT_ONLY, runRequest } from './run-checks';

const MODEL_ID = '01a0ec2b-5491-76cb-8d9c-90a687bbce68';
const EVAL = {
  id: 'eval-1',
  displayName: 'XSTest',
  status: 'active',
  versionId: 'ver-1',
  slots: [{ id: 'judge', role: 'judge', default: 'openai/gpt-4o' }],
};
const input = { modelId: MODEL_ID, evalId: 'eval-1', reasoning: 'none' as const, limit: 3 };

beforeEach(() => {
  vi.clearAllMocks();
  db.model.findUnique.mockResolvedValue({
    name: 'Qwen/Qwen3.6-27B',
    displayName: 'Qwen3.6 27B',
    source: 'hf',
    organization: { slug: 'qwen' },
  });
  routeFor.mockResolvedValue({ kind: 'openrouter', model: 'qwen/qwen3.6-27b', providers: ['Alibaba'] });
  effortsFor.mockResolvedValue({ options: ['none', 'on'], default: 'none' });
  runnableEvals.mockResolvedValue([EVAL]);
  db.evalRun.findMany.mockResolvedValue([]);
});

describe('runRequest', () => {
  it('checks the input as startRun does', async () => {
    expect(await runRequest({ ...input, reasoning: 'maybe' as 'on' })).toMatchObject({ ok: false });
    expect(await runRequest({ ...input, reasoning: 'high' })).toMatchObject({ ok: false });
    expect(await runRequest({ ...input, reasoning: 'on' })).toEqual({ ok: false, error: DEFAULT_EFFORT_ONLY });
    expect(await runRequest({ ...input, limit: 0 })).toMatchObject({ ok: false });
    expect(await runRequest({ ...input, modelId: 'nope' })).toMatchObject({ ok: false });
    expect(await runRequest({ ...input, evalId: 'other' })).toEqual({ ok: false, error: 'This eval cannot run here.' });
    expect(await runRequest({ ...input, models: { grader: 'openai/gpt-4o' } })).toMatchObject({ ok: false });
    expect(await runRequest({ ...input, models: { judge: 'not/a-judge' } })).toMatchObject({ ok: false });
  });

  it.each(['legacy', 'saturated'])('refuses a %s eval, also for moderators', async (status) => {
    runnableEvals.mockResolvedValue([{ ...EVAL, status }]);
    expect(await runRequest(input)).toEqual({ ok: false, error: DATED_EVAL });
  });

  it('asks for a fresh route, and refuses a model with none', async () => {
    await runRequest(input);
    expect(routeFor).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Qwen/Qwen3.6-27B', source: 'hf', organization: 'qwen' }),
      30_000,
    );
    routeFor.mockResolvedValueOnce(null);
    expect(await runRequest(input)).toEqual({ ok: false, error: 'We have no route to run this model.' });
  });

  it('builds the route and settings, with slot defaults', async () => {
    const result = await runRequest(input);
    expect(result).toMatchObject({
      ok: true,
      request: {
        route: { kind: 'openrouter', model: 'qwen/qwen3.6-27b' },
        settings: {
          reasoning: 'none',
          limit: 3,
          models: { judge: { kind: 'openrouter', model: 'openai/gpt-4o', allowFallbacks: true } },
        },
        slots: { judge: 'openai/gpt-4o' },
      },
    });
    expect(result.ok && result.request.settings.maxTokens).toBeUndefined();
  });

  it('gives a thinking run the thinking token limit', async () => {
    effortsFor.mockResolvedValue({ options: ['none', 'on'], default: 'on' });
    const result = await runRequest({ ...input, reasoning: 'on' });
    expect(result.ok && result.request.settings.maxTokens).toBe(32768);
  });

  it("uses the eval's default limit when the input gives none", async () => {
    runnableEvals.mockResolvedValue([{ ...EVAL, defaultLimit: 2000 }]);
    const settings = async (limit?: number) => {
      const r = await runRequest({ ...input, limit });
      return r.ok ? r.request.settings.limit : r.error;
    };
    expect(await settings()).toBe(2000);
    expect(await settings(50)).toBe(50);
    runnableEvals.mockResolvedValue([EVAL]);
    expect(await settings()).toBeUndefined();
  });
});
