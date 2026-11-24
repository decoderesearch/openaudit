import type { EvalListRow } from '@/components/catalog/eval-browser';
import type { MenuEval } from '@/components/nav/menu-evals';
import { prisma } from '@/lib/db';
import { comparedOf, type ComparedMethod } from '@/lib/method-compares';
import { methodPath, sourceOf, variantPath } from '@/lib/methods';
import { evalUpdates, methodEvalRows } from '@/lib/server/eval-list-rows';
import { homeCounts, type HomeCounts } from '@/lib/server/home-counts';
import { ttlCache } from '@/lib/server/ttl-cache';
import { TOPIC_LABELS } from '@/lib/topics';
import type { EvalLink, MethodGroup, Topic } from '@openaudit/spec';

/** An eval where a variant is in the top 3. `place`: 1, 2 or 3. */
export type Medal = { label: string; slug: string; place: number };

type Variant = { label: string; href: string; summary: string | null; author: string | null; date: string | null };
type BareMethod = { label: string; href: string; group: MethodGroup; summary: string; variants: Variant[] };

/** A method and its variants, without the baselines. A variant's `author` and `date` (`2024-06`):
 * of its first source. Its `medals`: the best first. The variants with the most medal worth go
 * first. */
export type NavMethod = Omit<BareMethod, 'variants'> & { variants: (Variant & { medals: Medal[] })[] };

/** `evals`: the method evals with results, as on the Methods page, the newest first. `evalTotal`:
 * all the method evals, as on the home page. */
export type NavMethods = { methods: NavMethod[]; evals: MenuEval[]; evalTotal?: number; counts?: HomeCounts };

type Medaled = { medals: Medal[] };
/** A 1st place is worth 3, a 2nd 2 and a 3rd 1. */
const worth = (v: Medaled) => v.medals.reduce((n, m) => n + 4 - m.place, 0);
const golds = (v: Medaled) => v.medals.filter((m) => m.place === 1).length;
/** The most medal worth first, then the most 1st places. */
export const byMedals = (a: Medaled, b: Medaled) => worth(b) - worth(a) || golds(b) - golds(a);

/** Each variant with its medals from the top 3 of `rows`. In each method, the most medal worth
 * first, then the most 1st places; else the order does not change. */
export function withMedals(methods: BareMethod[], rows: EvalListRow[]): NavMethod[] {
  const medalsOf = (href: string) =>
    rows
      .flatMap((r) => {
        const place = (r.top ?? r.best).findIndex((l) => l.href === href) + 1;
        return place ? [{ label: r.label, slug: r.slug, place }] : [];
      })
      .sort((a, b) => a.place - b.place || a.label.localeCompare(b.label));
  return methods.map((m) => ({
    ...m,
    variants: m.variants.map((v) => ({ ...v, medals: medalsOf(v.href) })).sort(byMedals),
  }));
}

const linksOf = (links: unknown) => (Array.isArray(links) ? (links as EvalLink[]) : []);

/** The newest of the dates (`2024` or `2024-06`; a year sorts before its months), else null. */
const newest = (dates: (string | null)[]) => dates.reduce<string | null>((a, d) => (d && (!a || d > a) ? d : a), null);

/** A method's date: the newest date of its own links, else the newest date of its variants. */
export function methodDate(links: EvalLink[], variants: { date: string | null }[]): string | null {
  return newest(links.map((l) => sourceOf([l]).date)) ?? newest(variants.map((v) => v.date));
}

/** Each method and its variants, the newest method first (`methodDate`), then by name. */
export async function methodsWithVariants(): Promise<BareMethod[]> {
  const rows = await prisma.method.findMany({
    orderBy: { displayName: 'asc' },
    select: {
      slug: true,
      displayName: true,
      group: true,
      summary: true,
      links: true,
      variants: {
        where: { baseline: false, visibility: 'public' },
        orderBy: { displayName: 'asc' },
        select: { slug: true, displayName: true, summary: true, links: true },
      },
    },
  });
  const methods = rows.map((m) => {
    const variants = m.variants.map((v) => ({
      label: v.displayName,
      href: variantPath(m.slug, v.slug),
      summary: v.summary,
      ...sourceOf(linksOf(v.links)),
    }));
    const method = {
      label: m.displayName,
      href: methodPath(m.slug),
      group: m.group as MethodGroup,
      summary: m.summary,
    };
    return { method: { ...method, variants }, date: methodDate(linksOf(m.links), variants) };
  });
  // Stable: methods with the same date (or none) keep the order by name.
  return methods.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).map((x) => x.method);
}

/** The methods with results on each eval, by the eval's slug. */
async function evalMethods(): Promise<Map<string, ComparedMethod[]>> {
  const methods = await prisma.method.findMany({
    orderBy: { displayName: 'asc' },
    select: { id: true, slug: true, displayName: true, summary: true, tagline: true },
  });
  const evals = await Promise.all(
    methods.map((m) =>
      prisma.eval.findMany({
        where: { versions: { some: { methodResults: { some: { artifact: { variant: { methodId: m.id } } } } } } },
        select: { slug: true },
      }),
    ),
  );
  const out = new Map<string, ComparedMethod[]>();
  methods.forEach((m, i) => {
    const method = { slug: m.slug, label: m.displayName, summary: m.summary, tagline: m.tagline };
    for (const e of evals[i]) out.set(e.slug, [...(out.get(e.slug) ?? []), method]);
  });
  return out;
}

/** The navbar's Methods menu: each method, and the method evals with their worst and best variants. */
export const navMethods = ttlCache(async (): Promise<NavMethods> => {
  const [methods, evals, compared, updates, counts] = await Promise.all([
    methodsWithVariants(),
    methodEvalRows(),
    evalMethods(),
    evalUpdates(),
    homeCounts(),
  ]);
  return {
    counts,
    evalTotal: evals.length,
    methods: withMedals(methods, evals),
    evals: evals
      .filter((e) => e.count > 0)
      .map(({ label, slug, creator, date, summary, topics, worst, best, top, suite }) => ({
        label,
        slug,
        href: `/evaluations/${slug}`,
        creator,
        date,
        summary,
        topic: topics[0] ? ((TOPIC_LABELS as Record<string, string>)[topics[0]] ?? null) : null,
        compares: comparedOf(compared.get(slug) ?? [], (topics[0] as Topic | undefined) ?? null),
        updated: updates.get(slug) ?? null,
        worst,
        best,
        top,
        suite,
      })),
  };
}, 300_000);
