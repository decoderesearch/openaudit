import { prisma } from '@/lib/db';
import { METHOD_GROUPS, methodPath, sourceOf, variantPath } from '@/lib/methods';
import { ttlCache } from '@/lib/server/ttl-cache';
import type { EvalLink, MethodGroup } from '@openaudit/spec';

/** What the hover card of a method or variant link shows (`components/method-link.tsx`). `kind`:
 * the method's group (a method), else the method's name (a variant). `variants`: the number of
 * variants, without baselines (a method only). `author` and `date`: of a variant's first source. */
export type MethodHover = {
  name: string;
  kind: string;
  author: string | null;
  date: string | null;
  variants: number | null;
  summary: string | null;
};

/** The hover cards of all methods and variants, by page path. */
export const methodHovers = ttlCache(async (): Promise<Record<string, MethodHover>> => {
  const rows = await prisma.method.findMany({
    select: {
      slug: true,
      displayName: true,
      group: true,
      summary: true,
      variants: {
        select: { slug: true, displayName: true, summary: true, links: true, baseline: true, visibility: true },
      },
    },
  });
  return Object.fromEntries(
    rows.flatMap((m) => [
      [
        methodPath(m.slug),
        {
          name: m.displayName,
          kind: `${METHOD_GROUPS[m.group as MethodGroup]?.title ?? ''} method`.trim(),
          author: null,
          date: null,
          variants: m.variants.filter((v) => !v.baseline && v.visibility === 'public').length,
          summary: m.summary,
        },
      ],
      ...m.variants.map((v) => [
        variantPath(m.slug, v.slug),
        {
          name: v.displayName,
          kind: m.displayName,
          ...sourceOf(Array.isArray(v.links) ? (v.links as unknown as EvalLink[]) : []),
          variants: null,
          summary: v.summary,
        },
      ]),
    ]),
  );
}, 300_000, 'method-hovers');
