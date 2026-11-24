import { methodPath } from '@/lib/methods';
import { TOPIC_INFO, TOPIC_LABELS } from '@/lib/topics';
import type { Topic } from '@openaudit/spec';

/** A method with results on an eval. */
export type ComparedMethod = { slug: string; label: string; summary: string; tagline: string | null };

/** What a method eval compares: one method, or the topic of several methods. `key`: the same for
 * evals that compare the same thing. `href`: the method page; null for a topic. `about`: the text of
 * its hover card. `topic`: true for a topic. */
export type Compared = {
  key: string;
  label: string;
  href: string | null;
  tagline: string | null;
  about: string;
  topic?: boolean;
};

/** "A, B and C". */
const and = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

/** What an eval with results from `methods` compares. With several methods: its topic, else the
 * method names. Null with no methods. */
export function comparedOf(methods: ComparedMethod[], topic: Topic | null): Compared | null {
  if (methods.length === 1) {
    const [m] = methods;
    return { key: m.slug, label: m.label, href: methodPath(m.slug), tagline: m.tagline, about: m.summary };
  }
  if (!methods.length) return null;
  const names = and(methods.map((m) => m.label));
  if (!topic)
    return {
      key: methods.map((m) => m.slug).join('+'),
      label: names,
      href: null,
      tagline: null,
      about: `Compares ${names}.`,
    };
  return {
    key: `topic:${topic}`,
    label: TOPIC_LABELS[topic],
    href: null,
    tagline: TOPIC_INFO[topic],
    about: `${TOPIC_INFO[topic]} Compares ${names}.`,
    topic: true,
  };
}
