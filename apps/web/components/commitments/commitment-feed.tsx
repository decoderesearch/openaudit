'use client';

import { LevelPill } from '@/components/commitments/level-pill';
import { KIND, Sources } from '@/components/commitments/timeline';
import { InfiniteFeed } from '@/components/infinite-feed';
import Link from '@/components/link';
import { criteriaScore, EVENT_LABELS, type CommitmentFeedEntry } from '@/lib/commitments';
import type { FeedPage } from '@/lib/feed';
import { formatDate, plainText } from '@/lib/org-research';
import { cn } from '@/lib/utils';
import { Fragment } from 'react';

/**
 * The events of a commitment's organizations, newest first: a date line before the first event of
 * each date, then rows of the organization, the kind and the level, the title, the summary and the
 * sources. A row links to the organization's page. It starts with `first`, and gets more events as
 * the reader scrolls. `keys`: the commitment's criteria, for the points.
 */
export function CommitmentFeed({
  slug,
  first,
  keys,
  className,
}: {
  slug: string;
  first: FeedPage<CommitmentFeedEntry>;
  keys: string[];
  className?: string;
}) {
  return (
    <InfiniteFeed
      title="Events"
      untitled
      hideEnd
      first={first}
      endpoint={`/api/commitment-events?commitment=${encodeURIComponent(slug)}`}
      className={className}
      renderEntry={({ event: e, org }, i, all) => (
        <Fragment key={e.id}>
          {(i === 0 || all[i - 1].event.date !== e.date) && (
            <li className="px-4 pt-3 pb-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
              {formatDate(e.date, e.datePrecision)}
            </li>
          )}
          <li className="group relative flex flex-col gap-y-1 px-4 pt-1.5 pb-2 hover:bg-slate-50">
            <span className="flex items-center justify-between gap-x-3">
              <span className="flex min-w-0 items-baseline gap-x-2">
                <Link
                  href={org.href}
                  hover={false}
                  className="truncate text-xs font-semibold text-slate-800 group-hover:text-sky-700 after:absolute after:inset-0"
                >
                  {org.displayName}
                </Link>
                <span className={cn(KIND, 'shrink-0 text-slate-300')}>{EVENT_LABELS[e.kind]}</span>
              </span>
              <LevelPill state={e.state} score={criteriaScore(e.state, keys)} />
            </span>
            <span className="flex flex-col pl-3">
              <span className="text-[11px]/4 font-medium text-slate-700">{e.title}</span>
              {e.summary && (
                <span className="mt-0.5 line-clamp-3 text-[11px]/4 text-slate-500">{plainText(e.summary)}</span>
              )}
              <Sources sources={e.sources} small className="relative z-10 mt-1 w-fit" />
            </span>
          </li>
        </Fragment>
      )}
    />
  );
}
