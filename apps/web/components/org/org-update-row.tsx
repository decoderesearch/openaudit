import Link from '@/components/link';
import { MenuIncidents } from '@/components/nav/nav-menu';
import { Photo } from '@/components/org/departure-photo';
import { StoryLink } from '@/components/org/story-link';
import { DEPARTURE_LABELS } from '@/lib/org-research';
import type { NavOrgDeparture, NavOrgUpdate } from '@/lib/server/nav-orgs';
import type { ReactNode } from 'react';

/** The body of a menu row: the incidents of an organization's month, each under its category and
 * the organization, then its departures as on the Organizations page (photo, kind, organization,
 * name, role, and quote or reason). */
export function OrgUpdateItem({ org, onPick }: { org: NavOrgUpdate; onPick: () => void }) {
  // The browser can keep a response from before a deploy, in an older form, for a short time.
  const { incidents = [], departures = [] } = org;
  const name = (
    <Link
      href={org.href}
      onClick={onPick}
      className="relative z-10 min-w-0 truncate font-semibold text-slate-400 hover:text-sky-800 hover:underline"
    >
      {org.label}
    </Link>
  );
  return (
    <div className="flex min-w-0 flex-col py-0.5">
      <MenuIncidents
        incidents={incidents}
        onPick={onPick}
        after={<span className="min-w-0 truncate text-[10px]/3">{name}</span>}
        className="gap-y-2.5 pl-0"
        titleClassName="font-normal"
      />
      {departures.length > 0 && <Departures items={departures} org={name} onPick={onPick} />}
    </div>
  );
}

function Departures({ items, org, onPick }: { items: NavOrgDeparture[]; org: ReactNode; onPick: () => void }) {
  return (
    <ul className="mt-1.5 flex flex-col gap-y-1.5 text-[11px] text-slate-600">
      {items.map((n) => (
        <li key={n.name} className="flex gap-x-2">
          <Photo photo={n.photo} name={n.name} className="mt-0.5 size-6 text-[9px]" />
          <div className="flex min-w-0 flex-col gap-y-0.5">
            <span>
              {n.kind && <span className="text-slate-400">{DEPARTURE_LABELS[n.kind]} · </span>}
              {org}
              <span className="text-slate-400"> · </span>
              <StoryLink
                href={n.href}
                onClick={onPick}
                className="relative z-10 font-semibold text-slate-800 hover:text-sky-800 hover:underline"
              >
                {n.name}
              </StoryLink>
              {n.role && <span className="text-slate-500">, {n.role}</span>}
            </span>
            {n.quote && <span className="line-clamp-3 text-slate-500 italic">“{n.quote}”</span>}
            {n.reason && !n.quote && <span className="line-clamp-2 text-slate-500">{n.reason}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}
