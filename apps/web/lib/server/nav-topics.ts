import { TOPIC_INFO, TOPIC_LABELS } from '@/components/catalog/parts';
import { topicCounts } from '@/lib/server/topics';
import { ttlCache } from '@/lib/server/ttl-cache';
import { topicPath, type TopicCounts } from '@/lib/topics';
import type { Topic } from '@openaudit/spec';

export type NavTopic = { label: string; href: string; info: string } & TopicCounts;
export type NavTopics = { topics: NavTopic[] };

/** The navbar's Topics menu: each topic that has public evals, with its counts. */
export const navTopics = ttlCache(async (): Promise<NavTopics> => {
  const counts = await topicCounts();
  return {
    topics: (Object.keys(TOPIC_LABELS) as Topic[]).flatMap((t) => {
      const c = counts.get(t);
      return c ? [{ label: TOPIC_LABELS[t], href: topicPath(t), info: TOPIC_INFO[t], ...c }] : [];
    }),
  };
}, 300_000, 'nav-topics');
