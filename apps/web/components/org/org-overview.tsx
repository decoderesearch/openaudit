import { INSET_TITLE } from '@/components/box-title';
import { LevelPill } from '@/components/commitments/level-pill';
import { Photo } from '@/components/org/departure-photo';
import { PrefetchLink } from '@/components/org/prefetch';
import { CATEGORY_LABELS, orgCommitmentPath, orgCommitmentsPath, type PillState, type Points } from '@/lib/commitments';
import {
  DEPARTURE_LABELS,
  departurePath,
  departuresPath,
  formatDate,
  incidentDate,
  incidentPath,
  incidentsPath,
  orgModelsPath,
  PRIMARY_CATEGORY_LABELS,
  type IncidentCard,
} from '@/lib/org-research';
import { cn } from '@/lib/utils';
import type { CommitmentCategory, OrgDeparture } from '@openaudit/spec';
import { Bot, Handshake, Newspaper, UserX } from 'lucide-react';
import type { ReactNode } from 'react';

// The org page: a cell for each of the organization's commitments, incidents, departures and
// models, with all their items and a link to the full page.

type Org = { slug: string };

export type OverviewData = {
  commitments: {
    slug: string;
    name: string;
    category: CommitmentCategory;
    state: PillState | null;
    score: Points | null;
    latest: string | null;
  }[];
  /** Audited models, then the others with no `date`. */
  models: { label: string; href: string; meter: number | null; date: string | null }[];
  departures: OrgDeparture[];
  incidents: IncidentCard[];
};

export function OrgOverview({ org, data }: { org: Org; data: OverviewData }) {
  const { models, departures, incidents } = data;
  // The most recently changed first; the ones not checked last.
  const commitments = [...data.commitments].sort(
    (a, b) => +!a.state - +!b.state || (b.latest ?? '').localeCompare(a.latest ?? ''),
  );
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <h1 className="sr-only">Overview</h1>
      <Cell
        href={orgCommitmentsPath(org)}
        icon={<Handshake className="text-emerald-700" />}
        title="Safety Commitments"
        empty={commitments.length ? null : 'Not checked yet.'}
      >
        {commitments.map((c) => (
          <Item key={c.slug} href={orgCommitmentPath(org, c.slug)}>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-xs font-medium text-slate-800">{c.name}</span>
              <span className="truncate text-[10px] text-slate-500">
                {CATEGORY_LABELS[c.category]}
                {c.latest && (
                  <>
                    <span aria-hidden className="px-1 text-slate-300">
                      ·
                    </span>
                    {formatDate(c.latest)}
                  </>
                )}
              </span>
            </span>
            {c.state ? (
              <LevelPill state={c.state} score={c.score} className="h-5.5 w-18 shrink-0" />
            ) : (
              <span className="shrink-0 text-[11px] text-slate-500">Not Checked</span>
            )}
          </Item>
        ))}
      </Cell>
      <Cell
        href={incidentsPath(org)}
        icon={<Newspaper className="text-amber-600" />}
        title="Incidents"
        empty={incidents.length ? null : 'No incidents.'}
      >
        {incidents.map((i) => (
          <Item key={i.slug} href={incidentPath(org, i.slug)} column>
            <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-[10px]/4">
              <span className="truncate font-semibold tracking-wide text-amber-600 uppercase">
                {PRIMARY_CATEGORY_LABELS[i.primaryCategory]}
              </span>
              <span className="shrink-0 text-slate-400 tabular-nums">{incidentDate(i, true)}</span>
            </span>
            <span className="line-clamp-2 text-xs/4 font-medium text-slate-800">{i.title}</span>
          </Item>
        ))}
      </Cell>
      <Cell
        href={departuresPath(org)}
        icon={<UserX className="text-rose-700" />}
        title="Departures"
        empty={departures.length ? null : 'No departures.'}
      >
        {departures.map((d) => (
          <Item key={d.name} href={departurePath(org, d.name)}>
            <Photo photo={d.image} name={d.name} className="size-8 text-[10px]" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-xs font-medium text-slate-800">{d.name}</span>
              {d.title && <span className="truncate text-[10px] text-slate-500">{d.title}</span>}
            </span>
            <span className="flex shrink-0 flex-col items-end text-[10px]">
              <span className="font-semibold tracking-wide text-rose-700 uppercase">{DEPARTURE_LABELS[d.kind]}</span>
              {d.departedDate && (
                <span className="text-slate-400 tabular-nums">{formatDate(d.departedDate, d.datePrecision)}</span>
              )}
            </span>
          </Item>
        ))}
      </Cell>
      <Cell
        href={orgModelsPath(org)}
        icon={<Bot className="text-sky-700" />}
        title="Models Audited"
        empty={models.length ? null : 'No models listed.'}
      >
        {models.map((m) => (
          <Item key={m.href} href={m.href}>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={cn('truncate text-xs font-medium', m.date ? 'text-slate-800' : 'text-slate-400')}>
                {m.label}
              </span>
              <span className={cn('text-[10px]', m.date ? 'text-slate-500' : 'text-slate-400')}>
                {m.date ? `Audited ${formatDate(m.date)}` : 'Not Audited'}
              </span>
            </span>
            <span
              className={cn(
                'shrink-0 text-sm font-semibold tabular-nums',
                m.meter === null ? 'text-slate-300' : 'text-slate-700',
              )}
            >
              {m.meter === null ? '—' : `${m.meter}%`}
            </span>
          </Item>
        ))}
      </Cell>
    </div>
  );
}

/** A cell of fixed height: the title bar with a link to the page, then the items, which scroll. */
function Cell({
  href,
  icon,
  title,
  empty,
  children,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  empty: string | null;
  children: ReactNode;
}) {
  return (
    <section className="flex h-80 min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex h-10 shrink-0 items-center justify-between gap-x-3 border-b border-slate-100 bg-slate-50 px-4">
        <h2 className={cn(INSET_TITLE, 'flex items-center gap-x-1.5 text-xs [&>svg]:size-3.5')}>
          {icon}
          <PrefetchLink href={href} className="hover:text-sky-800">
            {title}
          </PrefetchLink>
        </h2>
        <PrefetchLink href={href} className="shrink-0 text-xs font-medium text-sky-800 hover:underline">
          View All
        </PrefetchLink>
      </div>
      {empty ? (
        <p className="px-4 py-3 text-xs text-slate-500">{empty}</p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</ul>
      )}
    </section>
  );
}

function Item({ href, column, children }: { href: string; column?: boolean; children: ReactNode }) {
  return (
    <li className="border-b border-slate-100 last:border-b-0">
      <PrefetchLink
        href={href}
        className={cn('flex px-4 py-2.5 hover:bg-sky-50', column ? 'flex-col gap-y-0.5' : 'items-center gap-x-3')}
      >
        {children}
      </PrefetchLink>
    </li>
  );
}
