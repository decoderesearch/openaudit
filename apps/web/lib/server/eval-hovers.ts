import { prisma } from '@/lib/db';
import { versionKey } from '@/lib/latest-runs';
import { evalReleased } from '@/lib/release-dates';
import { ttlCache } from '@/lib/server/ttl-cache';
import { TOPIC_LABELS } from '@/lib/topics';
import type { Topic } from '@openaudit/spec';

/** What the hover card of an eval link shows (`components/eval-link.tsx`). `creator`: its first
 * maintainer. `date`: from `versionDate`. `summary`: one plain sentence. `topics`: the topic names. */
export type EvalHover = {
  name: string;
  creator: string | null;
  date: string | null;
  summary: string | null;
  topics: string[];
};

type VersionRow = { version: string; releasedDate?: string | null; status: string };

/** The release date of the newest published version (else the newest version), or its name when
 * that is a date. Null when it has none. */
export function versionDate(versions: VersionRow[]): string | null {
  const published = versions.filter((v) => v.status === 'published');
  const [newest] = (published.length ? published : versions).sort((a, b) => {
    const [ka, kb] = [versionKey(a), versionKey(b)];
    return kb[0].localeCompare(ka[0]) || kb[1].localeCompare(ka[1]);
  });
  return newest ? evalReleased(newest) : null;
}

/** The hover cards of all public evals, by slug. */
export const evalHovers = ttlCache(async (): Promise<Record<string, EvalHover>> => {
  const rows = await prisma.eval.findMany({
    where: { visibility: 'public' },
    select: {
      slug: true,
      displayName: true,
      maintainers: true,
      summary: true,
      topics: true,
      versions: { select: { version: true, releasedDate: true, status: true } },
    },
  });
  return Object.fromEntries(
    rows.map((r) => [
      r.slug,
      {
        name: r.displayName,
        creator: (r.maintainers as { name?: string }[] | null)?.[0]?.name ?? null,
        date: versionDate(r.versions),
        summary: r.summary,
        topics: r.topics.map((t) => TOPIC_LABELS[t as Topic] ?? t),
      },
    ]),
  );
}, 300_000);
