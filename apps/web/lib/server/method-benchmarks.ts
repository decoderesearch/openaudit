import type { Score } from '@/components/catalog/score';
import { prisma } from '@/lib/db';
import { titleCase } from '@/lib/format';
import type { Leader } from '@/lib/leaders';
import { matchedSuite, scorecardView, seededViews, variantPath } from '@/lib/methods';
import { getMethod, type MethodData } from '@/lib/server/methods';
import { toolEval } from '@/lib/server/topics';
import { ttlCache } from '@/lib/server/ttl-cache';
import { evalFromRow } from '@/lib/spec/rows';
import { TOPIC_LABELS } from '@/lib/topics';
import type { MetricDef, Topic } from '@openaudit/spec';

/** One method eval with its variants, best first. Benchmarks do not compare. */
export type MethodBenchmark = {
  slug: string;
  label: string;
  href: string;
  /** The topic's name: `Honesty`. */
  topic: string | null;
  /** The head of the score column: `Unlearning Score`. */
  metric: string;
  ranked: Leader[];
};

type Entry = { topic: Topic | null; family: string | null; bench: Omit<MethodBenchmark, 'topic'> };

/** The safety bar on the metric's range. With no range, on the range of `values` (all the eval's
 * ranked scores): the worst is all red and the best all green. */
const bar = (metric: MetricDef, value: number, values: number[]): Score | null => {
  const d = metric.direction;
  if (d === 'neither') return null;
  if (metric.min != null && metric.max != null)
    return { metric: metric.displayName, value, safetyDirection: d, range: [metric.min, metric.max] };
  if (d === 'nearer_zero_is_better') return null;
  return { metric: metric.displayName, value, safetyDirection: d, range: [Math.min(...values), Math.max(...values)] };
};

const leader = (data: MethodData, variantId: string, metric: MetricDef, value: number, values: number[]): Leader => {
  const v = data.variants.find((x) => x.id === variantId)!;
  return {
    label: v.displayName,
    href: variantPath(data.method.slug, v.slug),
    score: value.toFixed(3),
    bar: bar(metric, value, values),
  };
};

const evalHref = (slug: string) => `/evaluations/${slug}`;

/** The suite name, else the family. */
const groupOf = (e: { family?: string | null; suite?: { displayName: string } }) =>
  e.suite?.displayName ?? e.family ?? null;

/** "SAEBench: Unlearning" from "SAEBench Unlearning" in the suite SAEBench. */
const benchName = (e: { displayName: string; family?: string | null; suite?: { displayName: string } }) => {
  const group = groupOf(e);
  return group && e.displayName.startsWith(`${group} `)
    ? `${group}: ${e.displayName.slice(group.length + 1)}`
    : e.displayName;
};

/** The ranked ones, by rank. */
const byRank = <T extends { rank: number | null }>(xs: [string, T | null | undefined][]) =>
  xs.filter((x): x is [string, T & { rank: number }] => x[1]?.rank != null).sort((a, b) => a[1].rank - b[1].rank);

/**
 * Each public method eval with results. Matched methods use the scorecard at the method page's
 * defaults; seeded evals the seed means at the default group; other evals the best median over
 * models, across methods (as on topic pages). By topic, then small families first.
 */
export const methodBenchmarks = ttlCache(async (): Promise<MethodBenchmark[]> => {
  const slugs = (await prisma.method.findMany({ orderBy: { displayName: 'asc' }, select: { slug: true } })).map(
    (m) => m.slug,
  );
  const entries: Entry[] = [];
  const done = new Set<string>();
  for (const data of (await Promise.all(slugs.map((s) => getMethod(s)))).filter((d) => d != null)) {
    const match = matchedSuite(data.evals)?.matched;
    if (match) {
      const view = scorecardView(data, {});
      if (!view.base) continue;
      for (const row of view.rows) {
        const { eval: e, metric } = row.job;
        const ranked = byRank([...row.cells]);
        if (e.slug === match.eval || row.count < 2 || !ranked.length) continue;
        done.add(e.slug);
        entries.push({
          topic: e.topics[0] ?? null,
          family: groupOf(e),
          bench: {
            slug: e.slug,
            label: benchName(e),
            href: evalHref(e.slug),
            metric: titleCase(metric.displayName),
            ranked: ranked.map(([id, c]) =>
              leader(
                data,
                id,
                metric,
                c.value,
                ranked.map(([, x]) => x.value),
              ),
            ),
          },
        });
      }
    }
    for (const s of seededViews(data, {})) {
      const { eval: e, metric } = s.job;
      const ranked = byRank(s.rows.map((r) => [r.variant.id, r.cells.get(metric.key)]));
      if (!ranked.length) continue;
      done.add(e.slug);
      entries.push({
        topic: e.topics[0] ?? null,
        family: groupOf(e),
        bench: {
          slug: e.slug,
          label: benchName(e),
          href: evalHref(e.slug),
          metric: titleCase(metric.displayName),
          ranked: ranked.map(([id, c]) =>
            leader(
              data,
              id,
              metric,
              c.mean,
              ranked.map(([, x]) => x.mean),
            ),
          ),
        },
      });
    }
  }
  const evals = await prisma.eval.findMany({ where: { visibility: 'public', subjects: { has: 'method' } } });
  for (const e of evals.map(evalFromRow).filter((x) => !done.has(x.slug))) {
    const board = await toolEval(e);
    const metric = board.metric;
    const ranked = board.medians.filter((m) => !m.variant.baseline);
    if (!ranked.length || !metric) continue;
    entries.push({
      topic: e.facets.topics[0] ?? null,
      family: groupOf(e),
      bench: {
        slug: e.slug,
        label: benchName(e),
        href: evalHref(e.slug),
        metric: titleCase(metric.displayName),
        ranked: ranked.map((m) => ({
          label: m.variant.displayName,
          href: variantPath(m.variant.method.slug, m.variant.slug),
          score: m.median.toFixed(3),
          bar: bar(
            metric,
            m.median,
            ranked.map((x) => x.median),
          ),
        })),
      },
    });
  }
  const topics = [...(Object.keys(TOPIC_LABELS) as Topic[]), null];
  return topics.flatMap((topic) => {
    const mine = entries.filter((x) => x.topic === topic);
    const size = (x: Entry) => mine.filter((y) => x.family && y.family === x.family).length;
    // Small families first, and the evals of one family together.
    return mine
      .sort(
        (a, b) =>
          size(a) - size(b) ||
          (a.family ?? a.bench.label).localeCompare(b.family ?? b.bench.label) ||
          a.bench.label.localeCompare(b.bench.label),
      )
      .map((x) => ({ ...x.bench, topic: topic && TOPIC_LABELS[topic] }));
  });
}, 300_000);
