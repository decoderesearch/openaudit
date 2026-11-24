import type { EvalListRow } from '@/components/catalog/eval-browser';
import { prisma } from '@/lib/db';
import { ends } from '@/lib/leaders';
import { listEvals } from '@/lib/server/catalog';
import { evalHovers } from '@/lib/server/eval-hovers';
import { evalStandings } from '@/lib/server/eval-ranks';
import { methodBenchmarks } from '@/lib/server/method-benchmarks';
import { runnableEvals } from '@/lib/server/runs';
import { evalSuiteFromRow } from '@/lib/spec/rows';

const listed = (e: Awaited<ReturnType<typeof listEvals>>[number]) => e.status !== 'legacy' && e.status !== 'saturated';

/** The model evals of the Models page's list, by name, with no legacy or saturated evals. */
export async function modelEvalRows(): Promise<EvalListRow[]> {
  const [evals, hovers, standings] = await Promise.all([listEvals({}), evalHovers(), evalStandings()]);
  return evals
    .filter((e) => listed(e) && e.facets.subjects.includes('model') && !e.facets.subjects.includes('method'))
    .map((e): EvalListRow => {
      const s = standings[e.id];
      return {
        slug: e.slug,
        label: e.displayName,
        kind: 'model',
        creator: hovers[e.slug]?.creator ?? null,
        date: hovers[e.slug]?.date ?? null,
        summary: hovers[e.slug]?.summary ?? null,
        status: e.status,
        topics: e.facets.topics,
        count: s?.models ?? 0,
        newer: s?.newer ?? 0,
        worst: s?.worst ?? [],
        best: s?.best ?? [],
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** The active model evals that we can run now, as `modelEvalRows`. */
export async function runnableModelEvalRows(): Promise<EvalListRow[]> {
  const [rows, runnable] = await Promise.all([modelEvalRows(), runnableEvals()]);
  const can = new Set(runnable.filter((e) => e.status === 'active').map((e) => e.slug));
  return rows.filter((r) => can.has(r.slug));
}

/** The count of `runnableModelEvalRows`: on the home page and in the Models menu. */
export const runnableModelEvalCount = async () => (await runnableModelEvalRows()).length;

const DAY_MS = 86_400_000;
/** The eval of the first day of the turn. */
const FIRST = { slug: 'agentharm', day: Date.UTC(2026, 10, 25) / DAY_MS };

/** One eval each day, in turn: a model eval that we can run or a method eval, each with results. The
 * order is a hash of the slugs, so that the two kinds mix. Days start at midnight UTC. */
export function evalOfTheDay(models: EvalListRow[], methods: EvalListRow[], now = new Date()): EvalListRow | null {
  const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
  const pool = [...models, ...methods]
    .filter((r) => r.count > 0 && r.best.length > 0)
    .sort((a, b) => hash(a.slug) - hash(b.slug) || a.slug.localeCompare(b.slug));
  if (!pool.length) return null;
  const first = Math.max(0, pool.findIndex((r) => r.slug === FIRST.slug));
  const i = first + Math.floor(now.getTime() / DAY_MS) - FIRST.day;
  return pool[((i % pool.length) + pool.length) % pool.length];
}

/** The time (ISO) that each method eval last had a version published, by its slug. */
export async function evalUpdates(): Promise<Map<string, string>> {
  const rows = await prisma.eval.findMany({
    where: { subjects: { has: 'method' } },
    select: {
      slug: true,
      versions: {
        where: { publishedAt: { not: null } },
        orderBy: { publishedAt: 'desc' },
        take: 1,
        select: { publishedAt: true },
      },
    },
  });
  return new Map(
    rows.flatMap((r) => {
      const at = r.versions[0]?.publishedAt;
      return at ? [[r.slug, at.toISOString()] as const] : [];
    }),
  );
}

/** The method evals of the Evaluations page's list, the newest first, with no legacy or saturated
 * evals. An eval with no date goes last. In a month, the most recently updated (`evalUpdates`) first. */
export async function methodEvalRows(): Promise<EvalListRow[]> {
  const [evals, hovers, benchmarks, suites, updates] = await Promise.all([
    listEvals({}),
    evalHovers(),
    methodBenchmarks(),
    prisma.evalSuite.findMany(),
    evalUpdates(),
  ]);
  const updated = (r: EvalListRow) => updates.get(r.slug) ?? '';
  const bench = new Map(benchmarks.map((b) => [b.slug, b]));
  const suiteOf = new Map(
    suites.map(evalSuiteFromRow).map((s) => [
      s.id,
      {
        slug: s.slug,
        label: s.displayName,
        summary: s.summary,
        creator: s.maintainers.map((m) => m.name).join(', ') || null,
        date: null as string | null,
        order: s.evalOrder ?? [],
      },
    ]),
  );
  const rows = evals
    .filter((e) => listed(e) && e.facets.subjects.includes('method'))
    .map((e): EvalListRow => {
      const ranked = bench.get(e.slug)?.ranked ?? [];
      const suite = e.suiteId ? suiteOf.get(e.suiteId) : undefined;
      return {
        ...(suite && { suite }),
        slug: e.slug,
        label: e.displayName,
        kind: 'method',
        creator: hovers[e.slug]?.creator ?? null,
        date: hovers[e.slug]?.date ?? null,
        summary: hovers[e.slug]?.summary ?? null,
        status: e.status,
        topics: e.facets.topics,
        count: ranked.length,
        ...ends(ranked.toReversed()),
        top: ranked.slice(0, 3),
      };
    })
    .sort(
      (a, b) =>
        (b.date ?? '').localeCompare(a.date ?? '') ||
        updated(b).localeCompare(updated(a)) ||
        a.label.localeCompare(b.label),
    );
  // A suite's date is the date of its first eval.
  for (const r of rows) {
    if (r.suite && r.date && (!r.suite.date || r.date < r.suite.date)) r.suite.date = r.date;
  }
  return rows;
}
