import { prisma } from '@/lib/db';
import { canReadHazard, snippetHazard, strictestHazard } from '@/lib/runs/hazard';
import { attemptRule } from '@/lib/runs/terms';
import type { DisplayRule, Hazard, SampleTerms } from '@openaudit/spec';

/** Each attempt's level: its own (from the dataset's labels) or a stricter one from its flagged
 * snippets. A reply summary's level (`reply_summary.hazard`) replaces it; a snippet can still
 * make it `withheld`. */
export async function attemptHazards(
  attempts: { id: string; hazard?: Hazard | null }[],
): Promise<Map<string, Hazard | null>> {
  const ids = attempts.map((a) => a.id);
  const [snippets, summaries] = ids.length
    ? await Promise.all([
        prisma.openAuditSnippet.findMany({
          where: { attemptId: { in: ids } },
          select: { attemptId: true, category: true, severity: true },
        }),
        prisma.replySummary.findMany({
          where: { attemptId: { in: ids }, uplift: { not: null } },
          select: { attemptId: true, hazard: true },
        }),
      ])
    : [[], []];
  const judged = new Map(summaries.map((s) => [s.attemptId, s.hazard as Hazard | null]));
  const byAttempt = new Map<string, typeof snippets>();
  for (const s of snippets) {
    const list = byAttempt.get(s.attemptId);
    if (list) list.push(s);
    else byAttempt.set(s.attemptId, [s]);
  }
  return new Map(
    attempts.map((a) => [
      a.id,
      attemptHazard(a.hazard ?? null, judged.has(a.id) ? judged.get(a.id)! : undefined, byAttempt.get(a.id) ?? []),
    ]),
  );
}

/** One attempt's level, as `attemptHazards` gives it. `judged`: the reply summary's level, or
 * `undefined` if no summary judged the reply. `snippets`: all flagged snippets of the attempt. */
export function attemptHazard(
  own: Hazard | null,
  judged: Hazard | null | undefined,
  snippets: { category: string; severity: string }[],
): Hazard | null {
  let level = judged === undefined ? own : judged;
  for (const s of snippets) {
    const l = snippetHazard(s.category, s.severity);
    if (judged === undefined || l === 'withheld') level = strictestHazard([level, l]);
  }
  return level;
}

/** True if a reader with no staff role can never read the attempt's reply. */
export function lockedForPublic(level: Hazard | null, sampleTerms: SampleTerms | null, display: string | null) {
  const rule = attemptRule(
    { sampleTerms: sampleTerms ?? undefined },
    { display: (display ?? undefined) as DisplayRule | undefined },
  );
  return rule === 'scores_only' || !canReadHazard(level, { staff: false });
}

export type RunHazard = {
  /** The strictest level over the run's attempts: its log has them all. */
  level: Hazard | null;
  /** The attempts that not all readers can read, by ordinal. */
  attempts: { id: string; ordinal: number; level: Hazard }[];
};

/** Each attempt's level is as `attemptHazards` gives it. */
export async function runHazard(runId: string): Promise<RunHazard> {
  const [own, snippets, summaries] = await Promise.all([
    prisma.evalAttempt.findMany({ where: { runId, hazard: { not: null } }, select: { id: true, hazard: true } }),
    prisma.openAuditSnippet.findMany({ where: { runId }, select: { attemptId: true, category: true, severity: true } }),
    prisma.$queryRaw<{ attemptId: string; hazard: string | null }[]>`
      SELECT s."attemptId", s.hazard FROM reply_summary s JOIN eval_attempt a ON a.id = s."attemptId"
      WHERE a."runId" = ${runId}::uuid AND s.uplift IS NOT NULL`,
  ]);
  const owns = new Map(own.map((a) => [a.id, a.hazard as Hazard]));
  const judged = new Map(summaries.map((s) => [s.attemptId, s.hazard as Hazard | null]));
  const flagged = Map.groupBy(snippets, (s) => s.attemptId);
  const ids = new Set([...owns.keys(), ...judged.keys(), ...flagged.keys()]);
  const levels = [...ids].map((id) => ({
    id,
    level: attemptHazard(owns.get(id) ?? null, judged.has(id) ? judged.get(id)! : undefined, flagged.get(id) ?? []),
  }));
  const locked = levels.filter((a) => !canReadHazard(a.level, { staff: false }));
  const ordinals = locked.length
    ? await prisma.evalAttempt.findMany({
        where: { id: { in: locked.map((a) => a.id) } },
        select: { id: true, ordinal: true },
      })
    : [];
  const ordinal = new Map(ordinals.map((a) => [a.id, a.ordinal]));
  return {
    level: strictestHazard(levels.map((a) => a.level)),
    attempts: locked
      .map((a) => ({ id: a.id, ordinal: ordinal.get(a.id)!, level: a.level! }))
      .sort((a, b) => a.ordinal - b.ordinal),
  };
}

/** The ids of the run's attempts that the public copy of its log must leave out: as
 * `lockedForPublic`, from the levels of `runHazard`. */
export async function publicLocked(
  runId: string,
  hazard: RunHazard,
  sampleTerms: SampleTerms | null,
): Promise<Set<string>> {
  const scoresOnly = await prisma.evalAttempt.findMany({
    where: {
      runId,
      OR: [{ display: 'scores_only' }, ...(sampleTerms?.display === 'scores_only' ? [{ display: null }] : [])],
    },
    select: { id: true },
  });
  return new Set([...hazard.attempts.map((a) => a.id), ...scoresOnly.map((a) => a.id)]);
}

/** The attempts whose reply a reader with no staff role can never read: its hazard level is too
 * high, or the dataset's terms show only scores. */
export async function lockedAttempts(ids: string[]): Promise<Set<string>> {
  const rows = ids.length
    ? await prisma.evalAttempt.findMany({
        where: { id: { in: [...new Set(ids)] } },
        select: {
          id: true,
          hazard: true,
          display: true,
          run: { select: { evalVersion: { select: { sampleTerms: true } } } },
        },
      })
    : [];
  const levels = await attemptHazards(rows.map((a) => ({ id: a.id, hazard: a.hazard as Hazard | null })));
  return new Set(
    rows
      .filter((a) =>
        lockedForPublic(levels.get(a.id) ?? null, a.run.evalVersion.sampleTerms as SampleTerms | null, a.display),
      )
      .map((a) => a.id),
  );
}
