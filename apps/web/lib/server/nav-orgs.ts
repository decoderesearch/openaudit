import type { DeparturePhoto } from '@/components/org/departure-photo';
import type { CommitmentGrid, CommitmentSummary } from '@/lib/commitments';
import { prisma } from '@/lib/db';
import type { OrgEventFilter } from '@/lib/org-research';
import { organizationPath } from '@/lib/organizations';
import { LISTED_MODEL, SHOWN_ORG } from '@/lib/server/catalog';
import { commitmentGrid, commitmentSummaries } from '@/lib/server/commitments';
import { homeCounts, type HomeCounts } from '@/lib/server/home-counts';
import { homeOrgsPage } from '@/lib/server/home-orgs';
import { filterFeed, orgFeed, type OrgFeedEntry } from '@/lib/server/org-feed';
import { departureCounts, flaggedChatCounts, incidentCounts } from '@/lib/server/org-research';
import { ttlCache } from '@/lib/server/ttl-cache';
import type { DepartureKind, IncidentPrimaryCategory, OrgDeparture } from '@openaudit/spec';

/** `flagged`: the flagged chat count (`flaggedChatCounts`). `researched`: the organization has
 * incident and departure research. `models`: its listed models; `audits`: those with an OpenAudit.
 * `leavers`: its departures, the newest first, as on the home page. `commitments`: none when we
 * checked no commitment. */
export type NavOrg = {
  label: string;
  href: string;
  flagged: number;
  incidentCount: number;
  departures: number;
  researched: boolean;
  models: number;
  audits: number;
  leavers: OrgDeparture[];
  commitments?: CommitmentSummary;
};
/** `quote`, or else `reason`, as on the organization page. `kind`: how the person left. */
export type NavOrgDeparture = {
  name: string;
  kind?: DepartureKind;
  href?: string;
  role?: string;
  quote?: string;
  reason?: string;
  photo?: DeparturePhoto;
};
/** An organization's incidents and departures in one month (or year). `date`: of the newest one. */
export type NavOrgUpdate = {
  key: string;
  label: string;
  href: string;
  date: string;
  incidents: { title: string; href?: string; category: IncidentPrimaryCategory }[];
  departures: NavOrgDeparture[];
};
export type NavOrgs = { all: NavOrg[]; updates: NavOrgUpdate[]; grid: CommitmentGrid; counts?: HomeCounts };

const UPDATES = 25;

/** A feed entry with only what the menu shows. */
function navUpdate(e: OrgFeedEntry): NavOrgUpdate {
  return {
    key: e.key,
    label: e.label,
    href: e.href,
    date: e.date,
    incidents: e.incidents.map((i) => ({ title: i.title, href: i.href, category: i.category })),
    departures: e.departures.map((d) => ({
      name: d.name,
      kind: d.kind,
      href: d.href,
      ...(d.role && { role: d.role }),
      ...(d.quote ? { quote: d.quote } : d.reason && { reason: d.reason }),
      ...(d.photo && { photo: d.photo }),
    })),
  };
}

/** An org's group, from first to last: with departures; with OpenAudits and incidents; with
 * OpenAudits only; with incidents or flagged chats; with none of these. */
function activityRank(n: { audits: number; incidentCount: number; flagged: number; departures: number }) {
  if (n.departures) return 0;
  if (n.audits) return n.incidentCount ? 1 : 2;
  return n.incidentCount || n.flagged ? 3 : 4;
}

/** The navbar's Organizations menu: all organizations with models, the most commitment points
 * first (none last), then by activity (`activityRank`, then by name), the commitments
 * table (slim), and the organizations with the newest incidents and departures.
 * Models are `LISTED_MODEL`, as on the Organizations page. */
export const navOrgs = ttlCache(async (): Promise<NavOrgs> => {
  const [orgs, models, incidents, departures, flagged, updates, home, commitments, grid, counts] = await Promise.all([
    prisma.organization.findMany({
      where: SHOWN_ORG,
      select: { id: true, slug: true, displayName: true, researchedAt: true },
    }),
    prisma.model.findMany({
      where: LISTED_MODEL,
      select: {
        organizationId: true,
        openAuditCard: { select: { versions: { where: { status: 'published' }, select: { id: true }, take: 1 } } },
      },
    }),
    incidentCounts(),
    departureCounts(),
    flaggedChatCounts(),
    navOrgUpdates(null),
    homeOrgsPage(0, Number.MAX_SAFE_INTEGER),
    commitmentSummaries(),
    commitmentGrid(true),
    homeCounts(),
  ]);
  const leavers = new Map(home.entries.map((o) => [o.href, o.leavers]));

  const count = new Map<string, { models: number; audits: number }>();
  for (const m of models) {
    const c = count.get(m.organizationId) ?? { models: 0, audits: 0 };
    c.models++;
    if (m.openAuditCard?.versions.length) c.audits++;
    count.set(m.organizationId, c);
  }
  const all = orgs
    .flatMap((o) => {
      const c = count.get(o.id);
      if (!c) return [];
      const n = {
        label: o.displayName,
        href: organizationPath(o),
        flagged: flagged.get(o.id) ?? 0,
        incidentCount: Object.values(incidents.get(o.id) ?? {}).reduce((a, n) => a + (n ?? 0), 0),
        departures: departures.get(o.id) ?? 0,
        researched: !!o.researchedAt,
        ...c,
        leavers: leavers.get(organizationPath(o)) ?? [],
        commitments: commitments.get(o.id),
      };
      return [{ n, rank: activityRank(n) }];
    })
    .sort(
      (a, b) =>
        (b.n.commitments?.points ?? -1) - (a.n.commitments?.points ?? -1) ||
        a.rank - b.rank ||
        a.n.label.localeCompare(b.n.label, undefined, { sensitivity: 'base' }),
    )
    .map((x) => x.n);

  return { all, updates, grid, counts };
}, 300_000);

/** The newest updates of the menu, of one filter (`filterFeed`). */
export async function navOrgUpdates(filter: OrgEventFilter | null): Promise<NavOrgUpdate[]> {
  return filterFeed(await orgFeed(), filter)
    .slice(0, UPDATES)
    .map(navUpdate);
}
