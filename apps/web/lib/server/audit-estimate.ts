import { prisma } from '@/lib/db';
import { releasedAfter } from '@/lib/release-dates';
import { effortsFor, routeFor, type RouteModel } from '@/lib/runs/model-routes';
import { auditEval } from '@/lib/server/eval-age';
import { evalRows } from '@/lib/server/eval-table';
import { priceItems } from '@/lib/server/run-checks';
import { median } from '@/lib/server/pricing';
import { runnableEvals } from '@/lib/server/runs';
import { ttlCache, ttlCacheBy } from '@/lib/server/ttl-cache';

// The cost of a full audit of a model, for the "Sponsor This Audit" box: our active evals at the
// model's default thinking effort, then the OpenAudit card and one Deploymeter panel. All are
// OpenRouter list prices with no markup.

export type AuditEstimate = {
  evals: number;
  /** The evals that came out before the model (`releasedAfter`). */
  older: number;
  samples: number;
  evalsUsd: number;
  /** The card build (aggregator and flaggers) and the reply summaries. */
  cardUsd: number;
  /** The packet and one panel of judges. */
  meterUsd: number;
  totalUsd: number;
};

type PipelineCosts = { cardUsd: number; meterUsd: number };

/** The medians of past models: all card versions and reply summaries of a model, then one packet
 * and one panel. */
export const pipelineCosts = ttlCache(async (): Promise<PipelineCosts> => {
  const [cards, summaries, packets, panels] = await Promise.all([
    prisma.$queryRaw<{ usd: number }[]>`
      SELECT sum(v."costUsd")::float AS usd FROM openaudit_card_version v
        JOIN openaudit_card c ON c.id = v."cardId" GROUP BY c."modelId"`,
    prisma.$queryRaw<{ usd: number }[]>`
      SELECT sum(s."costUsd")::float AS usd FROM reply_summary s
        JOIN eval_attempt a ON a.id = s."attemptId" JOIN eval_run r ON r.id = a."runId" GROUP BY r."modelId"`,
    prisma.deployPacket.findMany({ select: { costUsd: true } }),
    prisma.deployPanel.findMany({ select: { costUsd: true } }),
  ]);
  const mid = (xs: number[]) => (xs.length ? median(xs) : 0);
  return {
    cardUsd: mid(cards.map((r) => r.usd)) + mid(summaries.map((r) => r.usd)),
    meterUsd: mid(packets.map((p) => p.costUsd)) + mid(panels.map((p) => p.costUsd)),
  };
}, 3_600_000);

type EstimateModel = RouteModel & { id: string; released?: string | null };

const byModel = ttlCacheBy(async (key: string): Promise<AuditEstimate | null> => {
  const { id, released, ...model } = JSON.parse(key) as EstimateModel;
  const route = await routeFor(model);
  if (!route) return null;
  const effort = (await effortsFor(route)).default;
  const rows = (await evalRows(id, effort, false)).filter((r) => auditEval(r, model.source));
  const quotes = await priceItems(rows.map((r) => ({ modelId: id, evalId: r.evalId, reasoning: effort })));
  const priced = quotes.flatMap((p, i) => (p.ok ? [{ ...p.quote, evalId: rows[i]!.evalId }] : []));
  if (!priced.length) return null;
  const { cardUsd, meterUsd } = await pipelineCosts();
  const evalsUsd = priced.reduce((n, q) => n + q.estCostUsd, 0);
  const dates = new Map((await runnableEvals()).map((e) => [e.id, e.released]));
  return {
    evals: priced.length,
    older: priced.filter((q) => releasedAfter(released, dates.get(q.evalId))).length,
    samples: priced.reduce((n, q) => n + q.samples, 0),
    evalsUsd,
    cardUsd,
    meterUsd,
    totalUsd: evalsUsd + cardUsd + meterUsd,
  };
}, 3_600_000);

/** The audit's estimate. Null: the model has no OpenRouter route, or no eval has a price. */
export function auditEstimate(model: EstimateModel): Promise<AuditEstimate | null> {
  const { id, name, source, organization, released } = model;
  return byModel(JSON.stringify({ id, name, source, organization, released }));
}
/** A round number for the page: to $10 under $100, else to $50. */
export function roundUsd(usd: number): number {
  const step = usd < 100 ? 10 : 50;
  return Math.max(step, Math.round(usd / step) * step);
}
