import { afterEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  evalRun: { findMany: vi.fn() },
  evalVersion: { findMany: vi.fn() },
}));
vi.mock('@/lib/db', () => ({ prisma: db }));
vi.mock('@/lib/server/price-baselines.json', () => ({
  default: {
    seeded: {
      '1.0': [
        {
          model: 'qwen/qwen3.6-27b',
          slots: {},
          reasoning: 'off',
          attemptCount: 4,
          costUsd: 0.04,
          fullSamples: 1000,
        },
      ],
    },
  },
}));

import {
  median,
  pastRunFromRow,
  quoteFrom,
  quoteRun,
  quoteRuns,
  quoteWithBaselines,
  runSamples,
  sampleCost,
  type PastRun,
  type Prices,
  type PricingConfig,
} from './pricing';

const config: PricingConfig = {
  defaultSampleUsd: 0.05,
  thinkingFactor: 5,
  thinkingMinTokens: 1000,
  maxTokens: { none: 8192, thinking: 32768 },
};

const prices: Prices = new Map([
  ['qwen/qwen3.6-27b', { input: 1e-6, output: 2e-6 }],
  ['big/model', { input: 10e-6, output: 20e-6 }],
  ['openai/gpt-4o', { input: 2.5e-6, output: 10e-6 }],
  ['openai/gpt-4o-mini', { input: 0.15e-6, output: 0.6e-6 }],
]);

const run = (over: Partial<PastRun> = {}): PastRun => ({
  model: 'qwen/qwen3.6-27b',
  slots: { judge: 'openai/gpt-4o' },
  reasoning: 'off',
  attemptCount: 2,
  costUsd: 0.03,
  byModel: {
    'openrouter/qwen/qwen3.6-27b': { tokens: { input: 1000, output: 2000 }, costUsd: 0.01 },
    'openrouter/openai/gpt-4o': { tokens: { input: 4000, output: 1000 }, costUsd: 0.02 },
  },
  ...over,
});

const want = { model: 'qwen/qwen3.6-27b', slots: { judge: 'openai/gpt-4o' } };

describe('median', () => {
  it('takes the middle value, or the mean of the two middle values', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe('sampleCost', () => {
  it('uses the recorded costs when the models are the same', () => {
    expect(sampleCost(run(), want, prices)).toEqual({ usd: 0.015, repriced: false });
  });

  it('prices the target tokens at the new model list price', () => {
    const cost = sampleCost(run(), { ...want, model: 'big/model' }, prices)!;
    // big/model: 1000 * 10e-6 + 2000 * 20e-6 = 0.05, plus the judge 0.02, over 2 samples.
    expect(cost.usd).toBeCloseTo(0.035, 9);
    expect(cost.repriced).toBe(true);
  });

  it('prices a changed slot at its new model list price', () => {
    const cost = sampleCost(run(), { ...want, slots: { judge: 'openai/gpt-4o-mini' } }, prices)!;
    // gpt-4o-mini: 4000 * 0.15e-6 + 1000 * 0.6e-6 = 0.0012, plus the target 0.01.
    expect(cost.usd).toBeCloseTo(0.0056, 9);
  });

  it('splits a model that two slots used between their new models', () => {
    const shared = run({
      slots: { judge: 'openai/gpt-4o', helper: 'openai/gpt-4o' },
      byModel: { 'openrouter/openai/gpt-4o': { tokens: { input: 4000, output: 1000 }, costUsd: 0.02 } },
    });
    const cost = sampleCost(
      shared,
      { ...want, slots: { judge: 'openai/gpt-4o', helper: 'openai/gpt-4o-mini' } },
      prices,
    )!;
    expect(cost.usd).toBeCloseTo((0.02 / 2 + 0.0012 / 2) / 2, 9);
  });

  it('keeps the recorded cost when the new model has no list price', () => {
    expect(sampleCost(run(), { ...want, model: 'no/price' }, prices)).toEqual({ usd: 0.015, repriced: false });
  });

  it('scales the total by the target price when the run has no usage by model', () => {
    const cost = sampleCost(run({ byModel: undefined }), { ...want, model: 'big/model' }, prices)!;
    expect(cost.usd).toBeCloseTo((0.03 * 10) / 2, 9);
    expect(sampleCost(run({ byModel: undefined, costUsd: undefined }), want, prices)).toBeNull();
  });

  it('skips runs with no attempts', () => {
    expect(sampleCost(run({ attemptCount: 0 }), want, prices)).toBeNull();
  });
});

describe('quoteFrom', () => {
  const req = { ...want, reasoning: 'none' as const, samples: 100 };

  it('uses the default rate with no history', () => {
    const q = quoteFrom([], { ...req, samples: 3 }, prices, config);
    expect(q).toEqual({ samples: 3, estCostUsd: 0.15, maxTokens: 8192, basis: 'default' });
  });

  it('takes the median per-sample cost, times samples', () => {
    const history = [run(), run({ costUsd: 0.06, byModel: undefined }), run({ costUsd: 0.2, byModel: undefined })];
    const q = quoteFrom(history, req, prices, config);
    // Per sample: 0.015, 0.03, 0.1. Median 0.03, times 100 samples.
    expect(q.estCostUsd).toBeCloseTo(3, 9);
    expect(q.basis).toBe('history');
  });

  it('prefers runs with the same effort; an old run that says off is none', () => {
    const history = [run({ reasoning: 'high', costUsd: 2, byModel: undefined }), run()];
    expect(quoteFrom(history, req, prices, config).estCostUsd).toBeCloseTo(1.5, 9);
    const high = quoteFrom(history, { ...req, reasoning: 'high' }, prices, config);
    expect(high.estCostUsd).toBeCloseTo(100, 9);
    expect(high.maxTokens).toBe(32768);
  });

  it('uses runs at another thinking effort before runs with no thinking', () => {
    const history = [run({ reasoning: 'low', costUsd: 2, byModel: undefined }), run()];
    expect(quoteFrom(history, { ...req, reasoning: 'high' }, prices, config).estCostUsd).toBeCloseTo(100, 9);
  });

  it('uses all runs when none has the same effort', () => {
    expect(quoteFrom([run({ reasoning: 'on' })], req, prices, config).estCostUsd).toBeCloseTo(1.5, 9);
  });

  it('scales the target of runs with no thinking up for a thinking quote; judges stay the same', () => {
    // Target 0.01 x 5, plus the judge 0.02, over 2 samples, times 100 samples.
    expect(quoteFrom([run()], { ...req, reasoning: 'on' }, prices, config).estCostUsd).toBeCloseTo(3.5, 9);
  });

  it('adds at least the minimum thinking tokens per sample to a short target answer', () => {
    const short = run({
      byModel: { 'openrouter/qwen/qwen3.6-27b': { tokens: { input: 50, output: 25 }, costUsd: 0.0001 } },
    });
    // 0.0001 + 1000 tokens x 2 samples x 2e-6, over 2 samples, times 100 samples.
    expect(quoteFrom([short], { ...req, reasoning: 'on' }, prices, config).estCostUsd).toBeCloseTo(0.205, 9);
  });

  it('scales the full cost for thinking when the run has no usage by model', () => {
    const q = quoteFrom([run({ byModel: undefined })], { ...req, reasoning: 'on' }, prices, config);
    expect(q.estCostUsd).toBeCloseTo(7.5, 9);
  });

  it('says when it repriced', () => {
    expect(quoteFrom([run()], { ...req, model: 'big/model' }, prices, config).basis).toBe('repriced');
  });
});

describe('runSamples', () => {
  it('takes the limit, but not more than the eval has', () => {
    expect(runSamples(3, 450)).toBe(3);
    expect(runSamples(1000, 450)).toBe(450);
    expect(runSamples(undefined, 450)).toBe(450);
    expect(runSamples(5, undefined)).toBe(5);
    expect(runSamples(undefined, undefined)).toBeNull();
  });
});

describe('pastRunFromRow', () => {
  it('reads the target, slots and costs from a run row', () => {
    const past = pastRunFromRow({
      route: { kind: 'openrouter', model: 'qwen/qwen3.6-27b' },
      settings: { reasoning: 'off', models: { judge: { kind: 'openrouter', model: 'openai/gpt-4o' } } },
      provenance: { costUsd: 0.02 },
      attemptCount: 3,
    });
    expect(past).toEqual({
      model: 'qwen/qwen3.6-27b',
      slots: { judge: 'openai/gpt-4o' },
      reasoning: 'off',
      attemptCount: 3,
      costUsd: 0.02,
      byModel: undefined,
    });
  });

  it('keeps the sample count of a run with no limit', () => {
    const row = { route: { model: 'm' }, settings: {}, provenance: {}, attemptCount: 9, sampleCount: 9 };
    expect(pastRunFromRow(row).fullSamples).toBe(9);
    expect(pastRunFromRow({ ...row, settings: { limit: 9 } }).fullSamples).toBeUndefined();
  });

  it('counts each sample once in a run with many tries', () => {
    const row = { route: { model: 'm' }, settings: { epochs: 50 }, provenance: {}, attemptCount: 50, sampleCount: 50 };
    expect(pastRunFromRow(row).fullSamples).toBe(1);
  });
});

describe('quoteWithBaselines', () => {
  const req = { ...want, reasoning: 'none' as const, samples: 100 };
  const baseline = run({ costUsd: 0.2, byModel: undefined });

  it('prefers the site runs', () => {
    expect(quoteWithBaselines([run()], [baseline], req, prices, config)).toEqual(
      quoteFrom([run()], req, prices, config),
    );
  });

  it('uses the baselines when the site runs give no cost', () => {
    const q = quoteWithBaselines([run({ attemptCount: 0 })], [baseline], req, prices, config);
    expect(q.basis).toBe('baseline');
    expect(q.estCostUsd).toBeCloseTo(10, 9);
  });

  it('uses the default rate when neither gives a cost', () => {
    expect(quoteWithBaselines([], [], req, prices, config).basis).toBe('default');
  });
});

describe('quoteRun', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  const input = {
    evalId: 'e1',
    versionId: 'v1',
    model: 'qwen/qwen3.6-27b',
    slots: { judge: 'openai/gpt-4o' },
    reasoning: 'none' as const,
  };
  const row = (over: object = {}) => ({
    evalVersionId: 'v1',
    route: { kind: 'openrouter', model: 'qwen/qwen3.6-27b' },
    settings: { reasoning: 'off', limit: 3 },
    provenance: { costUsd: 0.03 },
    attemptCount: 3,
    sampleCount: 3,
    ...over,
  });

  it('counts samples from a full run, else the largest split', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    db.evalVersion.findMany.mockResolvedValue([
      { id: 'v1', dataset: { splits: [{ sampleCount: 817 }, { sampleCount: 817 }] }, eval: { slug: 'other' } },
    ]);
    db.evalRun.findMany.mockResolvedValue([row()]);
    expect((await quoteRun(input))!.samples).toBe(817);
    db.evalRun.findMany.mockResolvedValue([row(), row({ settings: { reasoning: 'off' }, sampleCount: 800 })]);
    expect((await quoteRun(input))!.samples).toBe(800);
    expect((await quoteRun({ ...input, limit: 3 }))!.samples).toBe(3);
  });

  it('returns null when the sample count is not known', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    db.evalVersion.findMany.mockResolvedValue([{ id: 'v1', dataset: null, eval: { slug: 'other' } }]);
    db.evalRun.findMany.mockResolvedValue([]);
    expect(await quoteRun(input)).toBeNull();
  });

  it('reads only the runs of this version', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    db.evalVersion.findMany.mockResolvedValue([{ id: 'v1', version: '1.0', dataset: null, eval: { slug: 'other' } }]);
    db.evalRun.findMany.mockResolvedValue([]);
    await quoteRun({ ...input, limit: 3 });
    expect(db.evalRun.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ evalVersionId: { in: ['v1'] } }) }),
    );
  });

  it('quotes many runs with one read, each from the runs of its own version', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    db.evalVersion.findMany.mockResolvedValue([
      { id: 'v1', version: '1.0', dataset: null, eval: { slug: 'a' } },
      { id: 'v2', version: '1.0', dataset: null, eval: { slug: 'b' } },
    ]);
    db.evalRun.findMany.mockResolvedValue([
      row({ settings: {}, sampleCount: 800 }),
      row({ evalVersionId: 'v2', settings: {}, sampleCount: 20, provenance: { costUsd: 3 } }),
    ]);
    const [a, b] = await quoteRuns([input, { ...input, evalId: 'e2', versionId: 'v2' }]);
    expect(a!.samples).toBe(800);
    expect(b!.samples).toBe(20);
    expect(b!.estCostUsd).toBeCloseTo(20, 9);
    expect(db.evalRun.findMany).toHaveBeenCalledTimes(1);
  });

  it('uses the baseline runs of the eval version when the site has no runs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    db.evalVersion.findMany.mockResolvedValue([{ id: 'v1', version: '1.0', dataset: null, eval: { slug: 'seeded' } }]);
    db.evalRun.findMany.mockResolvedValue([]);
    const q = (await quoteRun({ ...input, limit: 100 }))!;
    expect(q.basis).toBe('baseline');
    expect(q.estCostUsd).toBeCloseTo(1, 9);
    db.evalVersion.findMany.mockResolvedValue([{ id: 'v1', version: '2.0', dataset: null, eval: { slug: 'seeded' } }]);
    expect((await quoteRun({ ...input, limit: 100 }))!.basis).toBe('default');
  });

  it('counts samples from a full baseline run before the splits', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    db.evalVersion.findMany.mockResolvedValue([
      { id: 'v1', version: '1.0', dataset: { splits: [{ sampleCount: 5000 }] }, eval: { slug: 'seeded' } },
    ]);
    db.evalRun.findMany.mockResolvedValue([row()]);
    expect((await quoteRun(input))!.samples).toBe(1000);
    db.evalRun.findMany.mockResolvedValue([row({ settings: { reasoning: 'off' }, sampleCount: 800 })]);
    expect((await quoteRun(input))!.samples).toBe(800);
  });
});
