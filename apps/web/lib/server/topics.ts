import { prisma } from '@/lib/db';
import { newestVersionFirst } from '@/lib/latest-runs';
import { oneEach, subjectBoard, valueKey, variantMedians, type VariantMedian } from '@/lib/methods';
import type { Coverage, Tone, TopicSummary } from '@/lib/openaudit-card';
import { modelPath } from '@/lib/server/catalog';
import { evalCounts } from '@/lib/server/eval-counts';
import { getEvalBoard } from '@/lib/server/methods';
import { evalFromRow, evalVersionFromRow } from '@/lib/spec/rows';
import type { TopicCounts } from '@/lib/topics';
import type { Eval, EvalVersion, MetricDef, Topic } from '@openaudit/spec';
import { cache } from 'react';

export type TopicEval = Eval & { results: number };

/** One eval of methods or auditors: its latest version and each variant's median over models. */
export type ToolEval = {
  eval: Eval;
  version: EvalVersion | null;
  metric: MetricDef | null;
  /** Empty when a variant has more than one artifact on a model (SAEBench). */
  medians: VariantMedian[];
  models: number;
};

/** What a model's latest published OpenAudit says about the topic. */
export type TopicCard = {
  model: { name: string; displayName: string; href: string };
  coverage: Coverage;
  tone: Tone | null;
  summary: string | null;
};

const COVERAGE_ORDER: Coverage[] = ['good', 'some', 'weak', 'none'];

/** The public evals on a topic, in two halves: evals of models and evals of methods or auditors. */
export const getTopic = cache(async (topic: Topic) => {
  const rows = await prisma.eval.findMany({
    where: { visibility: 'public', topics: { has: topic } },
    orderBy: { displayName: 'asc' },
  });
  const evals = rows.map(evalFromRow);
  const ofTools = evals.filter((e) => e.facets.subjects.some((s) => s !== 'model'));
  const [counts, cards, tools] = await Promise.all([
    evalCounts(),
    topicCards(topic),
    Promise.all(ofTools.map(toolEval)),
  ]);
  const ofModels: TopicEval[] = evals
    .filter((e) => e.facets.subjects.includes('model'))
    .map((e) => {
      const c = counts.get(e.id);
      return { ...e, results: c ? c.models + c.reported : 0 };
    });
  return { ofModels, ofTools: tools, cards };
});

export async function toolEval(e: Eval): Promise<ToolEval> {
  const [version] = (await prisma.evalVersion.findMany({ where: { evalId: e.id, status: 'published' } }))
    .map(evalVersionFromRow)
    .sort(newestVersionFirst);
  const metric = version?.metrics.find((m) => m.headline) ?? null;
  if (!version || !metric) return { eval: e, version: version ?? null, metric, medians: [], models: 0 };
  const board = await getEvalBoard(version.id);
  const rows = subjectBoard({
    variants: board.variants,
    artifacts: board.artifacts,
    key: valueKey(e.slug, metric.key),
    direction: metric.direction,
  });
  return {
    eval: e,
    version,
    metric,
    medians: oneEach(board.artifacts)
      ? variantMedians(rows, board.variants, metric.direction, version.methodSetup?.coreSubjects)
      : [],
    models: rows.length,
  };
}

/** The topic summary of each model's latest published OpenAudit, best coverage first. */
async function topicCards(topic: Topic): Promise<TopicCard[]> {
  const latest = await prisma.openAuditCardVersion.groupBy({
    by: ['cardId'],
    where: { status: 'published' },
    _max: { number: true },
  });
  if (!latest.length) return [];
  const versions = await prisma.openAuditCardVersion.findMany({
    where: { OR: latest.map((l) => ({ cardId: l.cardId, number: l._max.number! })) },
    select: { topics: true, card: { select: { model: { select: { name: true, displayName: true } } } } },
  });
  return versions
    .flatMap((v) => {
      const t = (v.topics as TopicSummary[]).find((s) => s.topic === topic);
      const m = v.card.model;
      return t
        ? [
            {
              model: { name: m.name, displayName: m.displayName, href: modelPath(m) },
              coverage: t.coverage,
              tone: t.tone ?? null,
              summary: t.summary ?? null,
            },
          ]
        : [];
    })
    .sort(
      (a, b) =>
        COVERAGE_ORDER.indexOf(a.coverage) - COVERAGE_ORDER.indexOf(b.coverage) ||
        a.model.displayName.localeCompare(b.model.displayName),
    );
}

/** For the index: the number of evals of models, of methods and of auditors on each topic. */
export const topicCounts = cache(async () => {
  const rows = await prisma.eval.findMany({
    where: { visibility: 'public' },
    select: { topics: true, subjects: true },
  });
  const out = new Map<Topic, TopicCounts>();
  for (const r of rows)
    for (const t of r.topics as Topic[]) {
      const c = out.get(t) ?? { models: 0, methods: 0, auditors: 0 };
      if (r.subjects.includes('model')) c.models++;
      if (r.subjects.includes('method')) c.methods++;
      if (r.subjects.includes('auditor')) c.auditors++;
      out.set(t, c);
    }
  return out;
});
