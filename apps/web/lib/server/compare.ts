import type { SnippetRef } from '@/components/evidence-hover';
import { COMPARE_MAX, modelNameOf } from '@/lib/compare';
import { prisma } from '@/lib/db';
import { findModel } from '@/lib/server/catalog';
import { modelIncidents } from '@/lib/server/model-feed';
import { snippetFeed, snippetFeedChats, type SnippetFeedEntry } from '@/lib/server/snippet-feed';
import { HIDDEN_TOPICS } from '@/lib/topics';

/** The flagged chats of each topic shown in a compare cell. */
const TOPIC_CHATS = 3;

/** One topic of a model: its flagged chats (`total`), its high and medium chats (`counted`), and its
 * first `TOPIC_CHATS` chats in feed order (the most severe open chats first), one of each title. */
export type CompareTopic = { topic: string; total: number; counted: number; chats: SnippetRef[] };

/** One model's column: its feed entry, its topics, and its incidents. `tested`: the topics of its
 * evals, and the topics of its flagged chats. */
export type CompareModel = SnippetFeedEntry & {
  name: string;
  topicChats: CompareTopic[];
  tested: string[];
  incidents: number;
};

/** The first chat of each title. A chat with no title is kept. */
function uniqueTitles(chats: SnippetRef[]) {
  const seen = new Set<string>();
  return chats.filter((c) => {
    const t = c.title?.trim().toLowerCase();
    if (!t) return true;
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  });
}

/** The models that the pickers offer: those with a published OpenAudit card, by name. */
export async function compareChoices(): Promise<SnippetFeedEntry[]> {
  return (await snippetFeed()).toSorted((a, b) => a.label.localeCompare(b.label));
}

/** The models of `names`, in that order, at most `COMPARE_MAX`. A name with no published card is
 * null, so that its column still shows its picker. */
export async function compareModels(names: string[]): Promise<(CompareModel | null)[]> {
  const feed = await snippetFeed();
  return Promise.all(
    names.slice(0, COMPARE_MAX).map(async (name) => {
      const entry = feed.find((e) => modelNameOf(e.href) === name);
      const [owner, ...rest] = name.split('/');
      const model = entry && rest.length ? await findModel(owner!, rest.join('/')) : null;
      if (!entry || !model) return null;
      const [chats, incidents, evalTopics] = await Promise.all([
        snippetFeedChats(entry.key),
        modelIncidents(model.id),
        prisma.eval.findMany({
          where: { slug: { in: entry.evals.map((e) => e.slug) } },
          select: { topics: true },
        }),
      ]);
      const topicChats = entry.topics.map((t) => ({
        topic: t.topic,
        total: t.counted + t.low,
        counted: t.counted,
        chats: uniqueTitles((chats ?? []).filter((c) => c.topics.includes(t.topic))).slice(0, TOPIC_CHATS),
      }));
      const tested = new Set<string>([...evalTopics.flatMap((e) => e.topics), ...entry.topics.map((t) => t.topic)]);
      return {
        ...entry,
        name,
        topicChats,
        tested: [...tested].filter((t) => !HIDDEN_TOPICS.includes(t)),
        incidents: incidents.length,
      };
    }),
  );
}
