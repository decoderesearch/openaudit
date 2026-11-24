import type { HomeOrg } from '@/lib/server/home-orgs';
import type { SnippetFeedEntry } from '@/lib/server/snippet-feed';

// The sorts of the home page's lists, by the key in their API's `sort` parameter. The first is the
// default.

export const MODEL_SORTS = {
  date: 'Audit Date',
  flagged: 'Flagged Chats (Most)',
  'flagged-asc': 'Flagged Chats (Fewest)',
  rating: 'Rating (Highest)',
  'rating-asc': 'Rating (Lowest)',
} as const;
export type ModelSort = keyof typeof MODEL_SORTS;

type Card = Pick<SnippetFeedEntry, 'date' | 'meter' | 'counts'>;
const flagged = (c: Card) => c.counts.high + c.counts.medium + c.counts.low;
/** The default model sort: the newest date first. */
export const newest = (a: Pick<Card, 'date'>, b: Pick<Card, 'date'>) => b.date.localeCompare(a.date);

/** `cards` in the order of `sort`. Ties: the newest card first, then the given order. A card with
 * no rating is last in both rating sorts. */
export function sortCards<T extends Card>(cards: T[], sort: ModelSort): T[] {
  const by: Record<ModelSort, (a: Card, b: Card) => number> = {
    date: newest,
    flagged: (a, b) => flagged(b) - flagged(a) || newest(a, b),
    'flagged-asc': (a, b) => flagged(a) - flagged(b) || newest(a, b),
    rating: (a, b) => (b.meter ?? -Infinity) - (a.meter ?? -Infinity) || newest(a, b),
    'rating-asc': (a, b) => (a.meter ?? Infinity) - (b.meter ?? Infinity) || newest(a, b),
  };
  return cards.toSorted(by[sort]);
}

export const ORG_SORTS = { date: 'Updated At', incidents: 'Incidents', departures: 'Departures' } as const;
export type OrgSort = keyof typeof ORG_SORTS;

/** The Organizations page's sorts: the total commitment score first, then the home page's. */
export const ORG_LIST_SORTS = { commitments: 'Commitments', ...ORG_SORTS } as const;
export type OrgListSort = keyof typeof ORG_LIST_SORTS;

/** `orgs` (in the order of `homeOrgs`) in the order of `sort`: `date` keeps it. `commitments`: the
 * most points first, with no commitments last. `incidents` and `departures`: the most first. Ties:
 * the newest first. */
export function sortOrgs<T extends Pick<HomeOrg, 'date' | 'incidents' | 'leavers' | 'commitments'>>(
  orgs: T[],
  sort: OrgListSort,
): T[] {
  if (sort === 'date') return orgs;
  const count = (o: T) =>
    sort === 'commitments' ? (o.commitments?.points ?? -1) : sort === 'incidents' ? o.incidents : o.leavers.length;
  return orgs.toSorted((a, b) => count(b) - count(a) || b.date.localeCompare(a.date));
}

/** `value` if it is a key of `sorts`, else the default. */
export function sortOf<K extends string>(sorts: Record<K, string>, value: string | null | undefined): K {
  return value && Object.hasOwn(sorts, value) ? (value as K) : (Object.keys(sorts)[0] as K);
}

/** `endpoint` with `sort`, or with no `sort` for the default. */
export function sortedEndpoint<K extends string>(endpoint: string, sorts: Record<K, string>, sort: K): string {
  if (sort === sortOf(sorts, null)) return endpoint;
  return `${endpoint}${endpoint.includes('?') ? '&' : '?'}sort=${sort}`;
}
