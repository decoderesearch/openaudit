import { NAV_MODEL_FEEDS, type ModelFeedKind } from '@/lib/feed';
import { listEvals } from '@/lib/server/catalog';
import { evalHovers } from '@/lib/server/eval-hovers';
import { runnableModelEvalCount } from '@/lib/server/eval-list-rows';
import { evalStandings, type EvalStanding } from '@/lib/server/eval-ranks';
import { homeCounts, type HomeCounts } from '@/lib/server/home-counts';
import { allModels, type OtherModel } from '@/lib/server/home-models';
import { modelFeed, type ModelFeedEntry } from '@/lib/server/model-feed';
import type { SnippetFeedEntry } from '@/lib/server/snippet-feed';
import { ttlCache } from '@/lib/server/ttl-cache';
import { TOPIC_LABELS } from '@/lib/topics';

/** A feed entry with only what the menu shows. */
export type NavFeedEntry = Omit<ModelFeedEntry, 'runs' | 'incidents'> & {
  incidents: { title: string; href?: string; category: ModelFeedEntry['incidents'][number]['category'] }[];
  evals: string[];
};
/** A model eval with results: its creator (as in its `EvalHover`), its topic, the number of models,
 * and the 3 at each end. */
export type NavModelEval = {
  label: string;
  slug: string;
  href: string;
  creator: string | null;
  topic: string | null;
  models: number;
} & Pick<EvalStanding, 'worst' | 'best'>;
/** `feeds`: the `NAV_MODEL_FEEDS` kinds only. `evals`: the first `EVALS_SHOWN` of `evalCount`, the
 * most models first. `evalTotal`: the model evals that we can run, as on the home page. `models`: all models
 * with flagged chats, newest first, as on the Models page, then `others`: all other listed models. */
export type NavModels = {
  feeds: Partial<Record<ModelFeedKind, NavFeedEntry[]>>;
  models: SnippetFeedEntry[];
  others: OtherModel[];
  evals: NavModelEval[];
  evalCount: number;
  evalTotal?: number;
  counts?: HomeCounts;
};

/** Entries in each feed of the menu. */
const FEED_SHOWN = 15;
/** Model evals in the menu, as the menu's `SHOWN`. */
const EVALS_SHOWN = 20;

/** The model evals with results, as on the Evaluations page's Model Evaluations. */
async function modelEvals(): Promise<NavModelEval[]> {
  const [evals, standings, hovers] = await Promise.all([listEvals({}), evalStandings(), evalHovers()]);
  return evals
    .filter((e) => e.facets.subjects.includes('model') && e.status !== 'legacy' && e.status !== 'saturated')
    .flatMap((e) => {
      const s = standings[e.id];
      if (!s?.models) return [];
      const topic = e.facets.topics[0];
      return [
        {
          label: e.displayName,
          slug: e.slug,
          href: `/evaluations/${e.slug}`,
          creator: hovers[e.slug]?.creator ?? null,
          topic: topic ? ((TOPIC_LABELS as Record<string, string>)[topic] ?? null) : null,
          models: s.models,
          worst: s.worst,
          best: s.best,
        },
      ];
    })
    .sort((a, b) => b.models - a.models || a.label.localeCompare(b.label));
}

const slim = ({ runs, incidents, ...e }: ModelFeedEntry): NavFeedEntry => ({
  ...e,
  incidents: incidents.map((i) => ({ title: i.title, href: i.href, category: i.category })),
  evals: runs?.evals.map((r) => r.name).sort((a, b) => a.localeCompare(b)) ?? [],
});

/** The navbar's Models menu: the newest entries of `NAV_MODEL_FEEDS`, the model evals, and all the
 * models, so that the menu shows more and searches with no load. */
export const navModels = ttlCache(async (): Promise<NavModels> => {
  const [feeds, modelEvalRows, evalTotal, { cards, others }, counts] = await Promise.all([
    Promise.all(NAV_MODEL_FEEDS.map((k) => modelFeed(k))),
    modelEvals(),
    runnableModelEvalCount(),
    allModels(),
    homeCounts(),
  ]);
  return {
    counts,
    evals: modelEvalRows.slice(0, EVALS_SHOWN),
    evalCount: modelEvalRows.length,
    evalTotal,
    feeds: Object.fromEntries(NAV_MODEL_FEEDS.map((k, i) => [k, feeds[i].entries.slice(0, FEED_SHOWN).map(slim)])),
    models: cards,
    others,
  };
}, 300_000);
