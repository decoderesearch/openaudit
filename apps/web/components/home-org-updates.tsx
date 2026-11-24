'use client';

import { HomeOrgStory } from '@/components/home-feed-stories';
import { boxed, InfiniteFeed } from '@/components/infinite-feed';
import type { FeedPage } from '@/lib/feed';
import type { HomeOrg } from '@/lib/server/home-orgs';
import type { ReactNode } from 'react';

const renderEntry = boxed(
  (o: HomeOrg) => <HomeOrgStory org={o} />,
  () => 'Open Organization',
);

/** The organizations with updates, each in a white box with its newest updates, the newest first.
 * More load as the reader scrolls, `size` at a time, after `first` from the server. `insetHead`,
 * `actions`, `headClassName`, `boxClassName` and `scrollClassName`: as in `InfiniteFeed`. */
export function HomeOrgUpdates({
  first,
  size,
  insetHead,
  actions,
  headClassName,
  boxClassName,
  scrollClassName,
  className,
}: {
  first: FeedPage<HomeOrg>;
  size: number;
  insetHead?: ReactNode;
  actions?: ReactNode;
  headClassName?: string;
  boxClassName?: string;
  scrollClassName?: string;
  className?: string;
}) {
  return (
    <InfiniteFeed
      title="Organizations"
      inset
      cards
      chain
      wheelFrom="gaps"
      headClassName={headClassName}
      boxClassName={boxClassName}
      scrollClassName={scrollClassName}
      insetHead={insetHead}
      actions={actions}
      first={first}
      endpoint={`/api/home-orgs?size=${size}`}
      renderEntry={renderEntry}
      className={className}
    />
  );
}
