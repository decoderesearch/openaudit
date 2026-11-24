import type { CommitmentSummary } from '@/lib/commitments';
import { prisma } from '@/lib/db';
import { FEED_PAGE, type FeedPage } from '@/lib/feed';
import { sortOrgs, type OrgSort } from '@/lib/home-sorts';
import { organizationPath } from '@/lib/organizations';
import { LISTED_MODEL, SHOWN_ORG } from '@/lib/server/catalog';
import { orgFeed, type FeedIncident, type OrgFeedEntry } from '@/lib/server/org-feed';
import { incidentCounts } from '@/lib/server/org-research';
import { ttlCache } from '@/lib/server/ttl-cache';
import { orgDepartureFromRow } from '@/lib/spec/rows';
import type { OrgDeparture } from '@openaudit/spec';

/** The number of newest incidents in an organization's box. */
const RECENT = 3;

/** An organization in the home page's list: its incident count, its newest incidents, and all its
 * departures, the newest first. `date`: of its newest incident, else of its newest departure.
 * `audits`: its listed models with a published OpenAudit. `commitments`: only in the lists of all
 * organizations. */
export type HomeOrg = {
  key: string;
  label: string;
  href: string;
  date: string;
  incidents: number;
  audits: number;
  recent: FeedIncident[];
  leavers: OrgDeparture[];
  commitments?: CommitmentSummary;
};

type OrgInfo = { incidents: number; audits?: number; leavers: OrgDeparture[] };

/** The organizations with updates in `feed` (newest first): first those with departures, then the
 * rest. In each part, the newest incident first, then those with no incidents, the newest
 * departure first. `info`: by `href`. */
export function homeOrgs(feed: OrgFeedEntry[], info: Map<string, OrgInfo>): HomeOrg[] {
  const byOrg = new Map<string, OrgFeedEntry[]>();
  for (const e of feed) byOrg.set(e.href, [...(byOrg.get(e.href) ?? []), e]);
  return [...byOrg.values()]
    .map((sorted) => {
      const incident = sorted.find((e) => e.incidents.length)?.date;
      const o = info.get(sorted[0].href);
      return {
        org: {
          key: sorted[0].href,
          label: sorted[0].label,
          href: sorted[0].href,
          date: incident ?? sorted[0].date,
          incidents: o?.incidents ?? 0,
          audits: o?.audits ?? 0,
          recent: sorted.flatMap((e) => e.incidents).slice(0, RECENT),
          leavers: o?.leavers ?? [],
        },
        incident: !!incident,
      };
    })
    .sort(
      (a, b) =>
        Number(b.org.leavers.length > 0) - Number(a.org.leavers.length > 0) ||
        Number(b.incident) - Number(a.incident) ||
        b.org.date.localeCompare(a.org.date) ||
        a.org.label.localeCompare(b.org.label),
    )
    .map((x) => x.org);
}

const allHomeOrgs = ttlCache(async () => {
  const [feed, orgs, incidents, departures, audited] = await Promise.all([
    orgFeed(),
    prisma.organization.findMany({ where: SHOWN_ORG, select: { id: true, slug: true } }),
    incidentCounts(),
    prisma.orgDeparture.findMany({
      where: { organization: SHOWN_ORG },
      orderBy: [{ departedDate: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
    }),
    prisma.model.findMany({
      where: { ...LISTED_MODEL, openAuditCard: { versions: { some: { status: 'published' } } } },
      select: { organizationId: true },
    }),
  ]);
  const audits = new Map<string, number>();
  for (const m of audited) audits.set(m.organizationId, (audits.get(m.organizationId) ?? 0) + 1);
  const leavers = new Map<string, OrgDeparture[]>();
  for (const d of departures)
    leavers.set(d.organizationId, [...(leavers.get(d.organizationId) ?? []), orgDepartureFromRow(d)]);
  const info = new Map(
    orgs.map((o): [string, OrgInfo] => [
      organizationPath(o),
      {
        incidents: Object.values(incidents.get(o.id) ?? {}).reduce((a, n) => a + (n ?? 0), 0),
        audits: audits.get(o.id) ?? 0,
        leavers: leavers.get(o.id) ?? [],
      },
    ]),
  );
  return homeOrgs(feed, info);
}, 300_000);

/** `size` organizations from `offset`, in the order of `sort`. */
export async function homeOrgsPage(offset = 0, size = FEED_PAGE, sort: OrgSort = 'date'): Promise<FeedPage<HomeOrg>> {
  const all = sortOrgs(await allHomeOrgs(), sort);
  return { entries: all.slice(offset, offset + size), more: all.length > offset + size };
}
