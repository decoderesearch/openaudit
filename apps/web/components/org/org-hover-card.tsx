'use client';

import { ScoreBar } from '@/components/commitments/level-pill';
import { HomeOrgStory } from '@/components/home-feed-stories';
import Link from '@/components/link';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import type { Points } from '@/lib/commitments';
import type { HomeOrg } from '@/lib/server/home-orgs';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

/** Wraps `children` so a hover shows the organization's home-page card (`org`): its name, its safety
 * commitments and its incidents. With no `org`, only `children` shows. `onPick`: on a link click. */
export function OrgHoverCard({
  org,
  onPick,
  children,
}: {
  org?: HomeOrg | null;
  onPick?: () => void;
  children: ReactNode;
}) {
  if (!org) return <>{children}</>;
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent align="start" className="w-[22rem] text-slate-700">
        <HomeOrgStory org={org} brief onPick={onPick} />
      </HoverCardContent>
    </HoverCard>
  );
}

/** A map from an organization's href to its home-page card data, for `OrgHoverCard`. */
export type OrgCards = Record<string, HomeOrg>;

/** An organization's total score bar, linking to its commitments (`href`), with a hover of its home
 * card (`card`). A client island, so the hover can slot onto the link: a server parent cannot pass a
 * link to the trigger. `score`, `text`: the bar. `barClassName`, `wrapperClassName`: their styles. */
export function OrgScoreBar({
  href,
  score,
  text,
  card,
  barClassName,
  wrapperClassName,
  onPick,
}: {
  href: string;
  score: Points;
  text: string;
  card?: HomeOrg;
  barClassName?: string;
  wrapperClassName?: string;
  onPick?: () => void;
}) {
  return (
    <OrgHoverCard org={card} onPick={onPick}>
      <Link
        href={href}
        onClick={onPick}
        hover={false}
        className={cn('block rounded-full hover:brightness-95', wrapperClassName)}
      >
        <ScoreBar score={score} text={text} label="Total Score" className={cn('w-full', barClassName)} />
      </Link>
    </OrgHoverCard>
  );
}
