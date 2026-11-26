import type { DeparturePhoto } from '@/components/org/departure-photo';
import { prisma } from '@/lib/db';
import { FEED_PAGE, type FeedPage } from '@/lib/feed';
import { departurePath, incidentPath, plainText, type OrgEventFilter } from '@/lib/org-research';
import { organizationPath } from '@/lib/organizations';
import { SHOWN_ORG } from '@/lib/server/catalog';
import { ttlCache, ttlCacheBy } from '@/lib/server/ttl-cache';
import type { DepartureKind, IncidentPrimaryCategory, IncidentSeverity, IncidentStatus } from '@openaudit/spec';

/** An incident on one date. `key`: the same on each date. `href`: its page. `update`:
 * the event of that date, when the incident started before it; else `summary` tells what happened. */
export type FeedIncident = {
  key: string;
  title: string;
  href?: string;
  date: string;
  severity: IncidentSeverity;
  category: IncidentPrimaryCategory;
  status: IncidentStatus;
  started: string;
  summary: string;
  update?: { title: string; description?: string };
};
/** `href`: the person on the organization's departures page. */
export type FeedDeparture = {
  name: string;
  href?: string;
  date: string;
  kind: DepartureKind;
  role?: string;
  reason?: string;
  quote?: string;
  quoteUrl?: string;
  nextRole?: string;
  photo?: DeparturePhoto;
};
/** An organization's incidents and departures on one date (a day, or a month or year when that is
 * all the sources give). The feed shows one date line for each `date`. */
export type OrgFeedEntry = {
  key: string;
  label: string;
  href: string;
  date: string;
  incidents: FeedIncident[];
  departures: FeedDeparture[];
};

type Event = { orgId: string; date: string } & (
  { kind: 'incident'; item: FeedIncident } | { kind: 'departure'; item: FeedDeparture }
);

/** All updates, newest first. Dates after today are left out. */
export const orgFeed = ttlCache(() => loadOrgFeed(), 300_000, 'org-feed');

/** The updates of the organization with slug `org` only. */
export const orgFeedFor = ttlCacheBy((org: string) => loadOrgFeed(org), 300_000);

async function loadOrgFeed(org?: string): Promise<OrgFeedEntry[]> {
  const ofOrg = org === undefined ? {} : { organization: { slug: org } };
  const [orgs, incidents, departures] = await Promise.all([
    prisma.organization.findMany({
      where: { ...SHOWN_ORG, ...(org !== undefined && { slug: org }) },
      select: { id: true, slug: true, displayName: true },
    }),
    prisma.orgIncident.findMany({
      where: ofOrg,
      select: {
        organizationId: true,
        slug: true,
        date: true,
        title: true,
        severity: true,
        primaryCategory: true,
        status: true,
        summary: true,
        events: { select: { date: true, title: true, description: true } },
      },
    }),
    prisma.orgDeparture.findMany({
      where: { departedDate: { not: null }, ...ofOrg },
      select: {
        organizationId: true,
        departedDate: true,
        name: true,
        title: true,
        kind: true,
        reason: true,
        quoteText: true,
        quoteUrl: true,
        nextRole: true,
        imageUrl: true,
        imagePageUrl: true,
        imageLicense: true,
        imageAuthor: true,
      },
    }),
  ]);
  const named = new Map(orgs.map((o) => [o.id, { slug: o.slug, label: o.displayName, href: organizationPath(o) }]));

  const today = new Date().toISOString().slice(0, 10);
  const events: Event[] = [];
  for (const i of incidents) {
    const org = named.get(i.organizationId);
    if (!org) continue;
    const base = {
      key: `${org.slug}/${i.slug}`,
      title: i.title,
      href: incidentPath(org, i.slug),
      severity: i.severity as IncidentSeverity,
      category: i.primaryCategory as IncidentPrimaryCategory,
      status: i.status as IncidentStatus,
      started: i.date,
      summary: plainText(i.summary),
    };
    events.push({ orgId: i.organizationId, date: i.date, kind: 'incident', item: { ...base, date: i.date } });
    for (const e of i.events) {
      const update =
        e.date > i.date
          ? { title: e.title, ...(e.description && { description: plainText(e.description) }) }
          : undefined;
      events.push({
        orgId: i.organizationId,
        date: e.date,
        kind: 'incident',
        item: { ...base, date: e.date, ...(update && { update }) },
      });
    }
  }
  for (const d of departures) {
    const org = named.get(d.organizationId);
    if (!org) continue;
    events.push({
      orgId: d.organizationId,
      date: d.departedDate!,
      kind: 'departure',
      item: {
        name: d.name,
        href: departurePath(org, d.name),
        date: d.departedDate!,
        kind: d.kind as DepartureKind,
        ...(d.title && { role: d.title }),
        ...(d.reason && { reason: plainText(d.reason) }),
        ...(d.quoteText && { quote: d.quoteText }),
        ...(d.quoteUrl && { quoteUrl: d.quoteUrl }),
        ...(d.nextRole && { nextRole: plainText(d.nextRole) }),
        ...(d.imageUrl &&
          d.imagePageUrl &&
          d.imageLicense &&
          d.imageAuthor && {
            photo: { url: d.imageUrl, pageUrl: d.imagePageUrl, license: d.imageLicense, author: d.imageAuthor },
          }),
      },
    });
  }

  const shown = events.filter((e) => e.date <= today);
  // An incident shows once in the feed: on its newest date.
  const newest = new Map<string, string>();
  for (const e of shown) {
    if (e.kind === 'incident' && e.date > (newest.get(e.item.key) ?? '')) newest.set(e.item.key, e.date);
  }
  const groups = new Map<string, Event[]>();
  for (const e of shown) {
    if (e.kind === 'incident' && e.date !== newest.get(e.item.key)) continue;
    const key = `${e.orgId} ${e.date}`;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return [...groups]
    .map(([key, list]): OrgFeedEntry => {
      const { slug: _, ...org } = named.get(list[0].orgId)!;
      // An incident shows once on a date.
      const incidents = new Map<string, FeedIncident>();
      const departures = new Map<string, FeedDeparture>();
      for (const e of list.sort((a, b) => b.date.localeCompare(a.date))) {
        if (e.kind === 'incident' && !incidents.has(e.item.key)) incidents.set(e.item.key, e.item);
        if (e.kind === 'departure' && !departures.has(e.item.name)) departures.set(e.item.name, e.item);
      }
      return {
        key,
        ...org,
        date: list[0].date,
        incidents: [...incidents.values()],
        departures: [...departures.values()],
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.label.localeCompare(b.label));
}

/** The entries with only their departures, newest first. An entry with no departures is left out.
 * `null`: all. */
export function filterFeed(entries: OrgFeedEntry[], f: OrgEventFilter | null): OrgFeedEntry[] {
  if (!f) return entries;
  return entries.filter((e) => e.departures.length).map((e) => ({ ...e, incidents: [] }));
}

/** `size` entries from `offset`, of `filter` (`filterFeed`). */
export async function orgFeedPage(
  offset = 0,
  filter: OrgEventFilter | null = null,
  size = FEED_PAGE,
): Promise<FeedPage<OrgFeedEntry>> {
  const all = filterFeed(await orgFeed(), filter);
  return { entries: all.slice(offset, offset + size), more: all.length > offset + size };
}
