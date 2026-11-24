import { prisma } from '@/lib/db';
import { effortOf, type Effort } from '@/lib/runs/effort';
import { QUOTE_MAX_AGE, openRouterModels } from '@/lib/runs/openrouter';
import BASELINES from '@/lib/server/price-baselines.json';
import type { RunProvenance, RunSettings, ServingRoute, TokenUsage } from '@openaudit/spec';

// The cost of a run: what past runs of the eval cost per sample (the median), times the samples.
// `maxTokens` caps each model call, so one sample cannot cost much more than the past ones did.

export type PriceBasis = 'history' | 'repriced' | 'baseline' | 'default';

export type Quote = {
  samples: number;
  estCostUsd: number;
  maxTokens: number;
  /**
   * `history`: past costs. `repriced`: past tokens at list prices for other models.
   * `baseline`: our test runs (`price-baselines.json`). `default`: no past runs.
   */
  basis: PriceBasis;
};

/** Dollars per token, by OpenRouter model id. */
export type Prices = Map<string, { input: number; output: number }>;

/** A past succeeded run, as pricing reads it. */
export type PastRun = {
  model: string;
  /** Slot id to the model the slot used. */
  slots: Record<string, string>;
  reasoning?: string;
  attemptCount: number;
  costUsd?: number;
  byModel?: RunProvenance['byModel'];
  /** The samples of the eval: set when the run had no limit. */
  fullSamples?: number;
};

export type PriceRequest = {
  model: string;
  slots: Record<string, string>;
  reasoning: Effort;
  samples: number;
};

export type PricingConfig = {
  /** Dollars per sample when the eval has no past runs. */
  defaultSampleUsd: number;
  /** For a thinking quote from runs with no thinking: the target's cost times this. */
  thinkingFactor: number;
  /** And at least this many more target output tokens per sample. */
  thinkingMinTokens: number;
  /** The cap on each model call, with no thinking and with thinking. */
  maxTokens: { none: number; thinking: number };
};

export function pricingConfig(): PricingConfig {
  return {
    defaultSampleUsd: 0.05,
    thinkingFactor: 5,
    thinkingMinTokens: 1000,
    maxTokens: { none: 8192, thinking: 32768 },
  };
}

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const listCost = (tokens: TokenUsage | undefined, price: { input: number; output: number }) =>
  (tokens?.input ?? 0) * price.input + (tokens?.output ?? 0) * price.output;

/**
 * One past run's cost per sample, with its models changed to the request's models. Tokens of a
 * changed model are priced at the new model's list price. With `thinking`, the target's share
 * grows (judges stay the same); a run with no usage by model grows in full. Null: no cost.
 */
export function sampleCost(
  run: PastRun,
  want: Pick<PriceRequest, 'model' | 'slots'>,
  prices: Prices,
  thinking?: Pick<PricingConfig, 'thinkingFactor' | 'thinkingMinTokens'>,
): { usd: number; repriced: boolean } | null {
  if (run.attemptCount <= 0) return null;
  const entries = Object.entries(run.byModel ?? {});
  if (!entries.length) {
    if (!run.costUsd) return null;
    const from = prices.get(run.model);
    const to = prices.get(want.model);
    const base = from ? from.input + from.output : 0;
    const scale = run.model !== want.model && to && base > 0 ? (to.input + to.output) / base : 1;
    const grow = thinking?.thinkingFactor ?? 1;
    return { usd: (run.costUsd * scale * grow) / run.attemptCount, repriced: scale !== 1 };
  }
  let usd = 0;
  let repriced = false;
  for (const [name, use] of entries) {
    if (!use) continue;
    const model = name.replace(/^openrouter\//, '');
    // The models that take this model's place: the target, the slots that used it, or itself.
    const next = [
      ...(model === run.model ? [want.model] : []),
      ...Object.keys(run.slots)
        .filter((id) => run.slots[id] === model)
        .map((id) => want.slots[id] ?? model),
    ];
    if (!next.length) next.push(model);
    for (const [i, m] of next.entries()) {
      const price = prices.get(m);
      let cost: number;
      if (m !== model && price) {
        cost = listCost(use.tokens, price);
        repriced = true;
      } else if (use.costUsd !== undefined) cost = use.costUsd;
      else cost = price ? listCost(use.tokens, price) : 0;
      let share = cost / next.length;
      if (thinking && model === run.model && i === 0) {
        const floor = thinking.thinkingMinTokens * run.attemptCount * (price?.output ?? 0);
        share = Math.max(share * thinking.thinkingFactor, share + floor);
      }
      usd += share;
    }
  }
  return usd > 0 ? { usd: usd / run.attemptCount, repriced } : null;
}

/**
 * The quote from past runs. Runs with the same effort count first, then other runs with thinking
 * (for a thinking request), then all runs.
 */
export function quoteFrom(
  history: PastRun[],
  req: PriceRequest,
  prices: Prices,
  config: PricingConfig = pricingConfig(),
): Quote {
  const costsOf = (runs: PastRun[], thinking?: PricingConfig) =>
    runs.map((r) => sampleCost(r, req, prices, thinking)).filter((c): c is NonNullable<typeof c> => c !== null);
  const thinks = req.reasoning !== 'none';
  const effort = (r: PastRun) => effortOf(r) ?? 'none';
  let costs = costsOf(history.filter((r) => effort(r) === req.reasoning));
  if (!costs.length && thinks) costs = costsOf(history.filter((r) => effort(r) !== 'none'));
  if (!costs.length) costs = costsOf(history, thinks ? config : undefined);
  const perSample = costs.length ? median(costs.map((c) => c.usd)) : config.defaultSampleUsd;
  const estCostUsd = perSample * req.samples;
  return {
    samples: req.samples,
    estCostUsd: Math.round(estCostUsd * 1e6) / 1e6,
    maxTokens: thinks ? config.maxTokens.thinking : config.maxTokens.none,
    basis: !costs.length ? 'default' : costs.some((c) => c.repriced) ? 'repriced' : 'history',
  };
}

/** The quote from this site's runs. If they give no cost, the quote from the baseline runs. */
export function quoteWithBaselines(
  history: PastRun[],
  baselines: PastRun[],
  req: PriceRequest,
  prices: Prices,
  config: PricingConfig = pricingConfig(),
): Quote {
  const own = quoteFrom(history, req, prices, config);
  if (own.basis !== 'default') return own;
  const seeded = quoteFrom(baselines, req, prices, config);
  return seeded.basis === 'default' ? own : { ...seeded, basis: 'baseline' };
}

/** The baseline runs of an eval version, from `pnpm prices:baselines`. */
const baselineRuns = (slug: string | undefined, version: string | undefined): PastRun[] =>
  (slug && version && (BASELINES as Record<string, Record<string, PastRun[]> | undefined>)[slug]?.[version]) || [];

/** The samples a run does: the limit, but not more than the eval has. Null: not known. */
export function runSamples(limit: number | undefined, full: number | undefined): number | null {
  if (limit && full) return Math.min(limit, full);
  return limit || full || null;
}

type RunRow = {
  route: unknown;
  settings: unknown;
  provenance: unknown;
  attemptCount: number;
  sampleCount?: number | null;
};

export function pastRunFromRow(row: RunRow): PastRun {
  const settings = row.settings as RunSettings;
  const provenance = row.provenance as RunProvenance;
  return {
    model: (row.route as ServingRoute).model,
    slots: Object.fromEntries(Object.entries(settings.models ?? {}).flatMap(([id, r]) => (r ? [[id, r.model]] : []))),
    reasoning: settings.reasoning,
    attemptCount: row.attemptCount,
    costUsd: provenance.costUsd,
    byModel: provenance.byModel,
    ...(!settings.limit && row.sampleCount ? { fullSamples: row.sampleCount / (settings.epochs || 1) } : {}),
  };
}

/** OpenRouter list prices. Empty when OpenRouter does not answer: quotes then use past costs. */
export async function openRouterPrices(maxAgeMs = QUOTE_MAX_AGE): Promise<Prices> {
  const models = await openRouterModels(maxAgeMs);
  return new Map((models ?? []).flatMap((m) => (m.price ? [[m.id, m.price] as const] : [])));
}

export type QuoteInput = {
  evalId: string;
  versionId: string;
  /** The target's model id on its route. */
  model: string;
  /** Slot id to the OpenRouter model the slot uses. */
  slots: Record<string, string>;
  reasoning: Effort;
  limit?: number;
  /** Tries of each sample. */
  epochs?: number;
};

/** The quote for a run. Null: we do not know how many samples the eval has. */
export async function quoteRun(input: QuoteInput): Promise<Quote | null> {
  return (await quoteRuns([input]))[0];
}

/** Past runs a quote reads, for each eval version. */
const HISTORY = 50;

/** The quotes for many runs, with one read of the database. */
export async function quoteRuns(inputs: QuoteInput[]): Promise<(Quote | null)[]> {
  if (!inputs.length) return [];
  const ids = [...new Set(inputs.map((i) => i.versionId))];
  const [rows, versions, prices] = await Promise.all([
    prisma.evalRun.findMany({
      where: { evalVersionId: { in: ids }, origin: 'run', status: 'succeeded', attemptCount: { gt: 0 } },
      orderBy: { createdAt: 'desc' },
      take: HISTORY * ids.length,
      select: {
        evalVersionId: true,
        route: true,
        settings: true,
        provenance: true,
        attemptCount: true,
        sampleCount: true,
      },
    }),
    prisma.evalVersion.findMany({
      where: { id: { in: ids } },
      select: { id: true, version: true, dataset: true, eval: { select: { slug: true } } },
    }),
    openRouterPrices(),
  ]);
  return inputs.map((input) => {
    const version = versions.find((v) => v.id === input.versionId);
    const history = rows
      .filter((r) => r.evalVersionId === input.versionId)
      .slice(0, HISTORY)
      .map(pastRunFromRow);
    const baselines = baselineRuns(version?.eval.slug, version?.version);
    // A full run knows the sample count: this site's, else a baseline. Else the largest split.
    const splits = (version?.dataset as { splits?: { sampleCount?: number }[] } | null)?.splits ?? [];
    const full =
      [...history, ...baselines].find((r) => r.fullSamples)?.fullSamples ??
      (Math.max(0, ...splits.map((s) => s.sampleCount ?? 0)) || undefined);
    const samples = runSamples(input.limit, full);
    return samples
      ? quoteWithBaselines(history, baselines, { ...input, samples: samples * (input.epochs || 1) }, prices)
      : null;
  });
}
