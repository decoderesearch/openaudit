'use client';

import { INSET_TITLE } from '@/components/box-title';
import { SearchToggle } from '@/components/catalog/title-search';
import { HomeOrgStory } from '@/components/home-feed-stories';
import { boxed, InfiniteFeed } from '@/components/infinite-feed';
import { filterItems } from '@/components/nav/nav-menu';
import { SortMenu } from '@/components/sort-menu';
import { ORG_LIST_SORTS, sortOf, sortOrgs, type OrgListSort } from '@/lib/home-sorts';
import type { HomeOrg } from '@/lib/server/home-orgs';
import { replaceUrlParam } from '@/lib/url-param';
import { cn } from '@/lib/utils';
import { useMemo, useState, type ReactNode } from 'react';

/** An organization as the home page shows it, with the text that the search matches. */
export type OrgListItem = HomeOrg & { search: string };

const renderEntry = boxed(
  (o: OrgListItem) => <HomeOrgStory org={o} brief compact />,
  () => 'Open Organization',
);

/** The Organizations page's list: a slate box of white boxes, with a search toggle after its title and its sorts (`ORG_LIST_SORTS`) at
 * its top right. The list scrolls in its own box. The search and sort work here, with no page load, and
 * keep `q` and `sort` in the URL. Under `lg`, a search puts `data-searching` on the root, which
 * hides the feed (see `FEED_PAGE`). `home`: the home page's column: the URL does not change it.
 * `insetHead`, `headClassName`, `boxClassName` and `scrollClassName`: as in `InfiniteFeed`; `insetHead` replaces the title
 * and search. `actions`: in place of the sorts. */
export function OrgList({
  items,
  q: initial = '',
  sort: initialSort = 'commitments',
  home,
  insetHead,
  actions,
  headClassName = 'px-4 sm:px-4',
  boxClassName,
  scrollClassName,
  className,
}: {
  items: OrgListItem[];
  q?: string;
  sort?: OrgListSort;
  home?: boolean;
  insetHead?: ReactNode;
  actions?: ReactNode;
  headClassName?: string;
  boxClassName?: string;
  scrollClassName?: string;
  className?: string;
}) {
  const [q, setQ] = useState(initial);
  const [open, setOpen] = useState(!!initial);
  const [sort, setSort] = useState(initialSort);
  const sorted = useMemo(() => sortOrgs(items, sort), [items, sort]);
  const shown = filterItems(sorted, q, (i) => i.search);
  const searching = !!q.trim();
  const search = (value: string) => {
    setQ(value);
    if (!home) replaceUrlParam('q', value.trim() || undefined);
  };
  const pick = (next: OrgListSort) => {
    setSort(next);
    if (!home) replaceUrlParam('sort', next === sortOf(ORG_LIST_SORTS, null) ? undefined : next);
  };
  const feed = (feedClassName: string) => (
    <InfiniteFeed
      title="Organizations"
      inset
      cards
      chain
      wheelFrom={home ? 'gaps' : 'left'}
      hideEnd
      headClassName={headClassName}
      boxClassName={boxClassName}
      scrollClassName={scrollClassName}
      insetHead={
        insetHead ?? (
          <span className="flex min-w-0 flex-1 items-center gap-x-1">
            <h2 className={cn(INSET_TITLE, 'shrink-0 text-slate-600')}>Organizations</h2>
            <SearchToggle
              plain
              start
              open={open}
              onOpenChange={setOpen}
              value={q}
              onChange={search}
              placeholder="Search organizations"
            />
          </span>
        )
      }
      actions={actions ?? <SortMenu sorts={ORG_LIST_SORTS} value={sort} onPick={pick} />}
      all={shown}
      empty="No organizations match."
      renderEntry={renderEntry}
      className={feedClassName}
    />
  );
  if (home) return feed(cn('min-w-0', className));
  return (
    <div data-searching={searching || undefined} className={cn('flex min-h-0 min-w-0 flex-col lg:flex-1', className)}>
      {feed('min-h-0 flex-1')}
    </div>
  );
}
