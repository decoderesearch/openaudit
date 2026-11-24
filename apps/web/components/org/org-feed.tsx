'use client';

import { byDay, InfiniteFeed } from '@/components/infinite-feed';
import Link from '@/components/link';
import { Photo } from '@/components/org/departure-photo';
import { IncidentCategory } from '@/components/org/incident-category';
import type { OrgCards } from '@/components/org/org-hover-card';
import { OrgPills, type OrgPill } from '@/components/org/org-pills';
import { StoryLink, storyRow } from '@/components/org/story-link';
import type { FeedPage } from '@/lib/feed';
import { DEPARTURE_LABELS, formatDate } from '@/lib/org-research';
import type { FeedDeparture, FeedIncident, OrgFeedEntry } from '@/lib/server/org-feed';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

/** The Organizations page's updates: for each organization and date, its incidents and departures,
 * newest first. The head is the pill strip of organizations (`orgs`), which fades into the list. */
export function OrgFeed({
  first,
  orgs,
  cards,
  className,
}: {
  first: FeedPage<OrgFeedEntry>;
  orgs: OrgPill[];
  cards?: OrgCards;
  className?: string;
}) {
  return (
    <InfiniteFeed
      title="Latest Incidents"
      inset
      headClassName="h-auto items-stretch bg-slate-100 pt-5 pr-0 pb-2.5 pl-4 max-lg:hidden sm:pr-0 sm:pl-5"
      boxClassName="border-0 bg-slate-100"
      insetHead={<OrgPills orgs={orgs} bars cards={cards} className="min-w-0 flex-1" />}
      scrollClassName="[mask-image:linear-gradient(to_bottom,transparent,black_1rem)] max-lg:pt-4"
      first={first}
      endpoint="/api/org-feed"
      className={className}
      renderEntry={byDay(
        (e: OrgFeedEntry) => (
          <OrgFeedRow entry={e} />
        ),
        { flush: true, dense: true, rules: false },
      )}
    />
  );
}

/** One organization in a day, each story with the organization after its category or kind.
 * `inOrg`: in a list for that organization, so no organization or indent, and full quotes. */
export function OrgFeedRow({ entry: e, inOrg }: { entry: OrgFeedEntry; inOrg?: boolean }) {
  const org = !inOrg && (
    <Link
      href={e.href}
      className="relative z-10 min-w-0 truncate font-semibold text-slate-400 hover:text-sky-800 hover:underline"
    >
      {e.label}
    </Link>
  );
  return (
    <div className={cn('flex flex-col gap-y-0.5 text-xs text-slate-600', !inOrg && 'pl-3')}>
      {e.incidents.length > 0 && (
        <ul className={cn('flex flex-col', !inOrg && 'gap-y-0.5')}>
          {e.incidents.map((i) => (
            <IncidentItem key={i.key} incident={i} org={org} />
          ))}
        </ul>
      )}
      {e.departures.length > 0 && (
        <ul className="flex flex-col gap-y-0.5">
          {e.departures.map((d) => (
            <DepartureItem key={d.name} departure={d} org={org} full={inOrg} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** An incident's category (and `org`), then its title. */
function IncidentItem({ incident: i, org }: { incident: FeedIncident; org: ReactNode }) {
  return (
    <li className={cn('flex flex-col', storyRow(i.href))}>
      <div className="flex">
        <div className="flex min-w-0 flex-col gap-y-0.5">
          {org ? (
            <span className="flex min-w-0 items-baseline gap-x-1 text-[10px]/4">
              <IncidentCategory category={i.category} className="shrink-0" />
              <span aria-hidden className="text-slate-400">
                ·
              </span>
              <span className="min-w-0 truncate text-[11px]/4">{org}</span>
            </span>
          ) : (
            <IncidentCategory category={i.category} />
          )}
          <span>
            <StoryLink href={i.href} row className="text-slate-700 hover:underline">
              {i.title}
            </StoryLink>
          </span>
        </div>
      </div>
    </li>
  );
}

/** The kind ("Resigned") and `org`, then the name and date. `full`: the full quote, and no date or
 * next role. */
function DepartureItem({ departure: d, org, full }: { departure: FeedDeparture; org: ReactNode; full?: boolean }) {
  return (
    <li className={cn('flex gap-x-2', storyRow(d.href))}>
      {/* Above the row's link, so that its photo credit shows on hover. */}
      <Photo photo={d.photo} name={d.name} className="relative z-10 mt-0.5 size-8 text-[11px]" />
      <div className="flex min-w-0 flex-col gap-y-0.5">
        <span>
          <span className="text-slate-400">{DEPARTURE_LABELS[d.kind] ?? d.kind} · </span>
          {org && (
            <>
              {org}
              <span className="text-slate-400"> · </span>
            </>
          )}
          <StoryLink href={d.href} row className="font-semibold text-slate-800 hover:text-sky-800 hover:underline">
            {d.name}
          </StoryLink>
          {d.role && <span className="text-slate-500">, {d.role}</span>}
          {!full && <span className="text-slate-400"> · {formatDate(d.date)}</span>}
        </span>
        {d.reason && !d.quote && <span className="line-clamp-2 text-slate-500">{d.reason}</span>}
        {d.quote && <span className={cn('text-slate-500 italic', full ? 'block' : 'line-clamp-3')}>“{d.quote}”</span>}
        {d.nextRole && !full && (
          <span className="text-slate-500">
            <span className="font-medium text-slate-600">Next: </span>
            {d.nextRole}
          </span>
        )}
      </div>
    </li>
  );
}
