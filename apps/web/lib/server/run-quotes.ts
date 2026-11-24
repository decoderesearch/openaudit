import { AUTO_APPROVE_MAX_USD } from '@/lib/runs/requests';
import { estimateRuns } from '@/lib/server/estimates';
import type { PriceBasis } from '@/lib/server/pricing';
import { busyRuns, repeatRuns, type PricedItem } from '@/lib/server/run-checks';
import { runPath } from '@/lib/server/runs';

export type ItemQuote =
  | {
      ok: true;
      samples: number;
      basis: PriceBasis;
      /** Seconds from start to end. Null: no past runs to tell. */
      seconds: number | null;
      /** A requested, queued or running run of the same request. */
      busyPath: string | null;
      /** The busy run waits for approval. */
      busyRequested: boolean;
      /** An earlier run that stops a user from asking again (see `repeatRuns`). */
      repeatPath: string | null;
      /** A user's request starts without approval (under the daily limit). */
      autoApprove: boolean;
    }
  | { ok: false; error: string };

/** Time and busy state for priced requests. */
export async function quoteMany(priced: PricedItem[]): Promise<ItemQuote[]> {
  const ready = priced.flatMap((p) => (p.ok ? [p] : []));
  const [seconds, busy, repeat] = await Promise.all([
    estimateRuns(
      ready.map(({ request, quote }) => ({
        evalId: request.evalId,
        evalVersionId: request.versionId,
        settings: request.settings,
        samples: quote.samples,
      })),
    ),
    busyRuns(ready.map((p) => p.request)),
    repeatRuns(ready.map((p) => p.request)),
  ]);
  return priced.map((p) => {
    if (!p.ok) return p;
    const i = ready.indexOf(p);
    const { samples, basis } = p.quote;
    const b = busy[i];
    const r = repeat[i];
    return {
      ok: true,
      samples,
      basis,
      seconds: seconds[i],
      busyPath: b && runPath(b),
      busyRequested: b?.status === 'requested',
      repeatPath: r && runPath(r),
      autoApprove: p.request.autoApprove && p.quote.estCostUsd <= AUTO_APPROVE_MAX_USD,
    };
  });
}
