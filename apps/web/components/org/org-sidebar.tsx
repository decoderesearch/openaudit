'use client';

import { LevelPill, ScoreBar } from '@/components/commitments/level-pill';
import { Leavers } from '@/components/home-feed-stories';
import { useWheelFromSide } from '@/components/infinite-feed';
import Link from '@/components/link';
import { PrefetchLink, usePrefetch } from '@/components/org/prefetch';
import { PageTitle } from '@/components/page';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  formatPoints,
  levelCounts,
  orgCommitmentPath,
  orgCommitmentsPath,
  type SideCommitment,
} from '@/lib/commitments';
import {
  departureCounts,
  departurePath,
  departuresPath,
  formatDate,
  incidentDate,
  incidentPath,
  incidentsPath,
  orgModelsPath,
  PRIMARY_CATEGORY_LABELS,
  type IncidentListItem,
} from '@/lib/org-research';
import { organizationPath } from '@/lib/organizations';
import { cn } from '@/lib/utils';
import type { OrgDeparture } from '@openaudit/spec';
import {
  Bot,
  BuildingComplex,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Handshake,
  Newspaper,
  UserX,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';

type Org = { slug: string; displayName: string };

/** The left column of an organization's pages. `hidden`: the organization has no public page, so
 * the column shows only on its incident pages, with no models, departures or org link. `about`:
 * the line under the name. `latest`: the date of its newest update. `audits`: its models in the
 * Models feed, their mean Deploymeter score, and its listed models that are not in the feed. */
type Props = {
  org: Org;
  hidden: boolean;
  about: ReactNode;
  latest: string | null;
  audits: { models: number; average: number | null; unaudited: number };
  departures: OrgDeparture[];
  incidents: IncidentListItem[];
  /** Each commitment with its level. */
  commitments: SideCommitment[];
};

/** What the URL selects: the overview (the org page), the commitments (`''`) or one by its slug, the
 * models, the departures, or the incidents (`''`) or one by its slug. */
function selected(
  path: string,
  org: Org,
): { [k in 'overview' | 'models' | 'departures']?: true } & {
  commitments?: string;
  incident?: string;
} {
  const base = organizationPath(org);
  if (path === base) return { overview: true };
  if (path === incidentsPath(org)) return { incident: '' };
  if (path === orgModelsPath(org)) return { models: true };
  if (path === departuresPath(org)) return { departures: true };
  if (path === orgCommitmentsPath(org)) return { commitments: '' };
  if (path.startsWith(`${orgCommitmentsPath(org)}/`))
    return { commitments: decodeURIComponent(path.slice(orgCommitmentsPath(org).length + 1)) };
  const prefix = `${incidentsPath(org)}/`;
  return path.startsWith(prefix) ? { incident: decodeURIComponent(path.slice(prefix.length)) } : {};
}

/** The selected row: a light sky background. Its text and caret are dark sky. */
const rowState = (on: boolean) => (on ? 'bg-sky-50' : 'hover:bg-slate-50');
const DOT = <span className="text-slate-300">·</span>;

/** The organization's name, with `about` at the right, level with the bottom of the name. The name
 * links to the org page, and is the page's heading except on an incident page. */
export function OrgHeader({ org, hidden, about }: Pick<Props, 'org' | 'hidden' | 'about'>) {
  const at = selected(usePathname(), org);
  if (hidden && !at.incident) return null;
  const name = hidden ? (
    org.displayName
  ) : (
    <Link href={organizationPath(org)} className="hover:text-sky-800">
      {org.displayName}
    </Link>
  );
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 pl-1">
      <div className="flex min-w-0 flex-col">
        {at.incident ? (
          <p className="font-display text-xl font-semibold text-slate-800 sm:text-2xl">{name}</p>
        ) : (
          <PageTitle>{name}</PageTitle>
        )}
      </div>
      {about}
    </header>
  );
}

/** A white panel: the organization's overview, commitments, incidents, departures, and models. A
 * link changes the page at the right and the URL. From `lg` up, the panel fills the column's height
 * and the open incident list scrolls in itself. Under `lg`, an incident page has a bar instead. */
export function OrgSidebar({ org, hidden, latest, audits, departures, incidents, commitments }: Omit<Props, 'about'>) {
  const path = usePathname();
  const at = selected(path, org);
  const aside = useRef<HTMLElement>(null);
  usePrefetch(
    hidden
      ? []
      : [organizationPath(org), orgCommitmentsPath(org), orgModelsPath(org), departuresPath(org), incidentsPath(org)],
  );
  if (hidden && !at.incident) return null;

  return (
    <aside ref={aside} className="flex min-w-0 flex-col lg:min-h-0">
      <nav
        aria-label={org.displayName}
        className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white lg:flex-1"
      >
        {!hidden && (
          <Row
            href={organizationPath(org)}
            on={!!at.overview}
            icon={<BuildingComplex className="text-slate-500" />}
            title="Overview"
          >
            {latest && `Updated ${formatDate(latest)}`}
          </Row>
        )}
        {!hidden && commitments.some((c) => c.state) && (
          <Commitments org={org} commitments={commitments} current={at.commitments} />
        )}
        <Incidents org={org} hidden={hidden} incidents={incidents} current={at.incident} aside={aside} />
        {!hidden && departures.length > 0 && (
          <Row
            href={departuresPath(org)}
            on={!!at.departures}
            icon={<UserX className="text-rose-700" />}
            title={`${departures.length} ${departures.length === 1 ? 'Departure' : 'Departures'}`}
            beside={
              <Leavers
                leavers={departures}
                large
                hrefOf={(d) => departurePath(org, d.name)}
                className="mt-0 justify-start"
              />
            }
          >
            <Dotted parts={departureCounts(departures)} />
          </Row>
        )}
        {!hidden && (
          <Row
            href={orgModelsPath(org)}
            on={!!at.models}
            icon={<Bot className="text-sky-700" />}
            // The open incident list pushes this row to the panel's bottom border.
            className={cn(at.incident && 'lg:border-b-0')}
            title={
              audits.models
                ? `${audits.models} ${audits.models === 1 ? 'Model' : 'Models'} Audited`
                : 'No Models Audited'
            }
          >
            {(audits.average !== null || audits.unaudited > 0) && (
              <>
                {audits.average !== null && <span>Average Score {audits.average}%</span>}
                {audits.average !== null && audits.unaudited > 0 && DOT}
                {audits.unaudited > 0 && (
                  <span>
                    {audits.unaudited} Unaudited {audits.unaudited === 1 ? 'Model' : 'Models'}
                  </span>
                )}
              </>
            )}
          </Row>
        )}
      </nav>
    </aside>
  );
}

/** The incidents row. On an incident page, the list of incidents opens under it from `lg` up;
 * under `lg`, the page has a bar instead. A hidden organization has no Incidents page, so there
 * the row links to the open incident. */
function Incidents({
  org,
  hidden,
  incidents,
  current,
  aside,
}: {
  org: Org;
  hidden: boolean;
  incidents: IncidentListItem[];
  current?: string;
  aside: RefObject<HTMLElement | null>;
}) {
  const open = !!current;
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) reveal(list.current);
  }, [open, current]);
  // The other rows do not scroll, so a wheel on them or left of them scrolls the list.
  useWheelFromSide('over', aside, list);
  const id = useId();
  const newest = incidents[0];
  const logs = incidents.filter((i) => i.logs > 0).length;
  return (
    <>
      <Row
        href={hidden && current ? incidentPath(org, current) : incidentsPath(org)}
        list={{ open, id, wide: true }}
        on={current === ''}
        icon={<Newspaper className="text-amber-600" />}
        title={`${incidents.length.toLocaleString('en-US')} ${incidents.length === 1 ? 'Incident' : 'Incidents'}`}
      >
        {newest && (
          <Dotted
            parts={[`Newest ${formatDate(newest.date, newest.datePrecision)}`, ...(logs ? [`${logs} With Logs`] : [])]}
          />
        )}
      </Row>
      {open && (
        <div
          id={id}
          ref={list}
          className={cn(
            'relative min-h-0 flex-1 overflow-y-auto overscroll-contain max-lg:hidden',
            !hidden && 'border-b border-slate-200',
          )}
        >
          <Items incidents={incidents} current={current} org={org} />
        </div>
      )}
      {current && (
        <MobileList
          incidents={incidents}
          current={current}
          org={org}
          className={cn(!hidden && 'border-b border-slate-200')}
        />
      )}
    </>
  );
}

/** The commitments row. On a commitment page, the list of each commitment with its level opens
 * under it. */
function Commitments({ org, commitments, current }: { org: Org; commitments: SideCommitment[]; current?: string }) {
  const open = !!current;
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (open) reveal(list.current);
  }, [open, current]);
  const id = useId();
  const counts = levelCounts(commitments.map((c) => c.state));
  const total = {
    points: commitments.reduce((n, c) => n + (c.score?.points ?? 0), 0),
    total: commitments.reduce((n, c) => n + c.criteria, 0),
  };
  return (
    <>
      <Row
        href={orgCommitmentsPath(org)}
        list={{ open, id }}
        on={current === ''}
        icon={<Handshake className="text-emerald-700" />}
        title="Safety Commitments"
        end={
          <ScoreBar
            score={total}
            text={formatPoints(total.points)}
            label="Total Score"
            className="pointer-events-none"
          />
        }
      >
        {counts.length ? <Dotted parts={counts} /> : 'None Found'}
      </Row>
      {open && (
        <ul
          id={id}
          ref={list}
          className="relative shrink-0 overflow-y-auto overscroll-contain border-b border-slate-200 lg:min-h-0 lg:shrink"
        >
          {CATEGORY_ORDER.map((category) => {
            const items = commitments.filter((c) => c.category === category);
            if (!items.length) return null;
            return (
              <li key={category} className="border-b border-slate-100 last:border-b-0">
                <p className="border-b border-slate-100 pt-2.5 pr-6 pb-1 pl-6 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                  {CATEGORY_LABELS[category]}
                </p>
                <ul>
                  {items.map((c) => (
                    <SideItem key={c.slug} org={org} c={c} on={c.slug === current} />
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/** A commitment in the list: its name, and its pill at the right. */
function SideItem({ org, c, on }: { org: Org; c: SideCommitment; on: boolean }) {
  return (
    <li className="border-b border-slate-100 last:border-b-0">
      <PrefetchLink
        href={orgCommitmentPath(org, c.slug)}
        aria-current={on ? 'page' : undefined}
        className={cn('flex items-center justify-between gap-x-3 py-2 pr-6 pl-12', rowState(on))}
      >
        <span className={cn('truncate text-xs', on ? 'font-medium text-sky-800' : 'text-slate-800')}>{c.name}</span>
        {c.state ? (
          <LevelPill state={c.state} score={c.score} className="shrink-0" />
        ) : (
          <span className="shrink-0 text-[11px] text-slate-500">Not Checked</span>
        )}
      </PrefetchLink>
    </li>
  );
}

/** A row that links to a page: a large icon, the title with a line of `children` under it, `beside`
 * at their right, `end` left of the caret, and the caret at the right. The link covers the row;
 * `beside` is above it. A click on the page that is open does nothing. `list`: the list under the
 * row, which turns the caret down when open; with `wide`, the list shows from `lg` up only.
 * `className`: added to the row's. */
function Row({
  href,
  list,
  on,
  icon,
  title,
  beside,
  end,
  className,
  children,
}: {
  href: string;
  list?: { open: boolean; id: string; wide?: boolean };
  on: boolean;
  icon: ReactNode;
  title: string;
  beside?: ReactNode;
  end?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const titleClass = cn(
    'text-[13px] font-semibold whitespace-nowrap tabular-nums after:absolute after:inset-0',
    on ? 'text-sky-800' : 'text-slate-800',
  );
  return (
    <div
      className={cn(
        'relative flex min-h-14 shrink-0 items-center gap-x-3 border-b border-slate-200 px-3 py-1.5 first:rounded-t-[calc(var(--radius-xl)-1px)]',
        rowState(on),
        className,
      )}
    >
      <span aria-hidden className="flex shrink-0 pl-1 [&>svg]:size-5">
        {icon}
      </span>
      <div className={cn('flex min-w-0 flex-col', beside ? 'shrink-0' : 'flex-1')}>
        <Link
          href={href}
          aria-current={on ? 'page' : undefined}
          aria-expanded={list?.open}
          aria-controls={list?.open ? list.id : undefined}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            if (new URL(href, location.href).pathname !== location.pathname) return;
            e.preventDefault();
            // The top loading bar starts on each link click, and stays when no page loads.
            e.nativeEvent.stopImmediatePropagation();
          }}
          className={titleClass}
        >
          {title}
        </Link>
        {children && (
          <span className="flex flex-wrap items-center gap-x-1.5 text-[10px]/4 text-slate-500 tabular-nums">
            {children}
          </span>
        )}
      </div>
      {beside && <div className="flex min-w-0 flex-1 items-center pl-1">{beside}</div>}
      {end}
      <ChevronRight
        aria-hidden
        className={cn(
          'size-4 shrink-0',
          on ? 'text-sky-800' : 'text-slate-400',
          list && 'transition-transform',
          list?.open && (list.wide ? 'lg:rotate-90' : 'rotate-90'),
        )}
      />
    </div>
  );
}

/** The parts with a dot between them, as "17 Resigned · 4 Fired". */
function Dotted({ parts }: { parts: string[] }) {
  return parts.map((c, k) => (
    <span key={c} className="contents">
      {k > 0 && DOT}
      {c}
    </span>
  ));
}

/** Under `lg`: a bar with the newer and older incident and a button that opens the list. With no
 * incident selected, only the button. */
function MobileList({
  incidents,
  current,
  org,
  className,
}: {
  incidents: IncidentListItem[];
  current?: string;
  org: Org;
  className?: string;
}) {
  // The page whose list is open: the list closes on another page.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const page = current ?? '';
  const open = openFor === page;
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) reveal(list.current);
  }, [open]);
  const at = incidents.findIndex((i) => i.slug === current);
  const newer = at > 0 ? incidents[at - 1] : undefined;
  const older = at >= 0 ? incidents[at + 1] : undefined;
  const step = 'flex size-10 shrink-0 items-center justify-center text-slate-500';
  const arrow = (to: IncidentListItem | undefined, label: string, icon: ReactNode) =>
    to ? (
      <Link href={incidentPath(org, to.slug)} aria-label={label} className={cn(step, 'hover:bg-slate-50')}>
        {icon}
      </Link>
    ) : (
      <span className={cn(step, 'text-slate-200')} aria-hidden>
        {icon}
      </span>
    );
  if (!incidents.length) return null;
  return (
    <div className={cn('lg:hidden', className)}>
      <div className="flex items-center">
        {current && arrow(newer, 'Newer incident', <ChevronLeft className="size-4" />)}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpenFor(open ? null : page)}
          className={cn(
            'flex h-10 min-w-0 flex-1 cursor-pointer items-center justify-center gap-x-1 px-2 text-xs font-medium text-slate-700',
            current && 'border-x border-slate-100',
          )}
        >
          {at >= 0 ? (
            <span className="tabular-nums">
              Incident {at + 1} of {incidents.length}
            </span>
          ) : (
            <span>{open ? 'Hide the list' : 'Show the list'}</span>
          )}
          <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
        </button>
        {current && arrow(older, 'Older incident', <ChevronRight className="size-4" />)}
      </div>
      {open && (
        <div ref={list} className="relative max-h-[60dvh] overflow-y-auto overscroll-contain border-t border-slate-200">
          <Items incidents={incidents} current={current} org={org} />
        </div>
      )}
    </div>
  );
}

/** Scrolls a list box, not the page, to show its current item near the top third. No scroll when
 * the item is in view. */
function reveal(box: HTMLElement | null) {
  const item = box?.querySelector<HTMLElement>('[aria-current="page"]');
  if (!box || !item) return;
  const top = item.offsetTop - box.scrollTop;
  if (top >= 0 && top + item.offsetHeight <= box.clientHeight) return;
  box.scrollTop = Math.max(0, item.offsetTop - box.clientHeight / 3);
}

/** The incidents: the category (and "Logs" when there are log excerpts) with the date at the
 * right, then the title. */
function Items({ incidents, current, org }: { incidents: IncidentListItem[]; current?: string; org: Org }) {
  if (!incidents.length) return <p className="py-3 pr-3 pl-6 text-xs text-slate-500">No incidents.</p>;
  return (
    <ul>
      {incidents.map((i) => {
        const on = i.slug === current;
        return (
          <li key={i.slug} className="border-b border-slate-100 last:border-b-0">
            <PrefetchLink
              href={incidentPath(org, i.slug)}
              aria-current={on ? 'page' : undefined}
              className={cn('flex flex-col gap-y-0.5 py-3 pr-6 pl-12', rowState(on))}
            >
              <span className="flex flex-wrap items-baseline justify-between gap-x-2 text-[10px]/4">
                <span className="flex min-w-0 gap-x-1.5 font-semibold tracking-wide uppercase">
                  <span className="truncate text-amber-600">{PRIMARY_CATEGORY_LABELS[i.primaryCategory]}</span>
                  {i.logs > 0 && (
                    <>
                      {DOT}
                      <span className="shrink-0 text-slate-400">Logs</span>
                    </>
                  )}
                </span>
                <span className="shrink-0 text-slate-400 tabular-nums">{incidentDate(i, true)}</span>
              </span>
              <span className={cn('line-clamp-2 text-xs/4', on ? 'font-medium text-sky-800' : 'text-slate-800')}>
                {i.title}
              </span>
            </PrefetchLink>
          </li>
        );
      })}
    </ul>
  );
}
