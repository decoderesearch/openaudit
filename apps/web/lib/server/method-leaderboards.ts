import type { SubjectLink } from '@/components/methods/subject-board';
import { prisma } from '@/lib/db';
import {
  subjectBoard,
  valueKey,
  variantMedians,
  type BoardRow,
  type BoardVariant,
  type VariantMedian,
} from '@/lib/methods';
import { getEvalBoard, subjectLinks } from '@/lib/server/methods';
import { evalFromRow, evalVersionFromRow } from '@/lib/spec/rows';
import type { Eval, MetricDef, Topic } from '@openaudit/spec';
import { cache } from 'react';

// Leaderboards of methods for one safety task, across sources. A task names topics, not evals or
// papers: each public method eval on one of its topics joins when it has results.

export type LeaderboardTask = { slug: string; title: string; about: string; topics: Topic[] };

export const LEADERBOARD_TASKS: LeaderboardTask[] = [
  {
    slug: 'deception',
    title: 'Deception Detectors',
    about:
      'The detectors that find lies best, for each model and across models. A detector is a variant of a method: a probe, a logprob classifier or an LLM monitor. Each eval on honesty with method results has its own board, because the metrics of two evals do not compare.',
    topics: ['honesty'],
  },
];

export type ModelBest = {
  subject: string;
  /** The ranked variants of the row, best first. */
  ranked: { variant: BoardVariant; value: number }[];
};

export type DetectorRow = VariantMedian & {
  /** The models where it ranks first. */
  firsts: number;
};

export type EvalBoardView = {
  eval: Eval;
  /** The methods with results on the eval, for the filter. */
  methods: { slug: string; displayName: string }[];
  version: string;
  metric: MetricDef;
  models: ModelBest[];
  detectors: DetectorRow[];
  subjects: Record<string, SubjectLink>;
};

function bestOf(row: BoardRow, byId: Map<string, BoardVariant>): ModelBest {
  return {
    subject: row.subject,
    ranked: [...row.cells]
      .sort((a, b) => a[1].rank - b[1].rank)
      .map(([id, c]) => ({ variant: byId.get(id)!, value: c.value })),
  };
}

/**
 * The task's boards: one for each eval with results from two or more variants. `method`: only the
 * variants of this method, ranked among themselves.
 */
export const methodLeaderboard = cache(async (task: LeaderboardTask, method?: string): Promise<EvalBoardView[]> => {
  const rows = await prisma.eval.findMany({
    where: { visibility: 'public', subjects: { has: 'method' } },
    include: { versions: { where: { status: 'published' } } },
    orderBy: { displayName: 'asc' },
  });
  const boards: EvalBoardView[] = [];
  for (const row of rows) {
    const e = evalFromRow(row);
    if (!e.facets.topics.some((t) => task.topics.includes(t))) continue;
    const [version] = row.versions
      .map((v) => ({ row: v, v: evalVersionFromRow(v) }))
      .sort((a, b) => (b.v.releasedDate ?? b.v.version).localeCompare(a.v.releasedDate ?? a.v.version));
    const metric = version?.v.metrics.find((m) => m.headline);
    if (!version || !metric) continue;
    const board = await getEvalBoard(version.row.id);
    const methods = [...new Map(board.variants.map((v) => [v.method.slug, v.method])).values()];
    const variants = board.variants.filter((v) => !method || v.method.slug === method);
    const compared = variants.filter((v) => !v.baseline);
    if (compared.length < (method ? 1 : 2)) continue;
    const byId = new Map(variants.map((v) => [v.id, v]));
    const subjectRows = subjectBoard({
      variants,
      artifacts: board.artifacts.filter((a) => byId.has(a.variantId)),
      key: valueKey(e.slug, metric.key),
      direction: metric.direction,
      order: version.v.methodSetup?.subjectOrder,
    });
    const models = subjectRows.map((r) => bestOf(r, byId)).filter((m) => m.ranked.length);
    const firsts = new Map<string, number>();
    for (const m of models)
      if (m.ranked.length > 1) firsts.set(m.ranked[0].variant.id, (firsts.get(m.ranked[0].variant.id) ?? 0) + 1);
    boards.push({
      eval: e,
      methods,
      version: version.v.version,
      metric,
      models,
      detectors: variantMedians(
        subjectRows,
        compared,
        metric.direction,
        version.v.methodSetup?.coreSubjects,
      ).map((d) => ({
        ...d,
        firsts: firsts.get(d.variant.id) ?? 0,
      })),
      subjects: subjectLinks(
        board.subjects,
        models.map((m) => m.subject),
      ),
    });
  }
  return boards;
});
