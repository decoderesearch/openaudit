import { Prisma } from '#prisma';
import { prisma } from '@/lib/db';
import { COUNTED_SEVERITIES } from '@/lib/openaudit-card';
import { storyUrl, type IncidentCard, type IncidentListItem } from '@/lib/org-research';
import { excludedAttempt } from '@/lib/server/excluded-attempts';
import { orgDepartureFromRow, orgIncidentEventFromRow, orgIncidentFromRow } from '@/lib/spec/rows';
import type { IncidentSeverity, OrgDeparture, OrgIncident } from '@openaudit/spec';
import { cache } from 'react';

// Reads for organization research: incidents and departures, and the organizations' flagged chat
// counts.

const byDateDesc = (a?: string, b?: string) => (b ?? '').localeCompare(a ?? '');
const byDeparture = (a: OrgDeparture, b: OrgDeparture) =>
  byDateDesc(a.departedDate, b.departedDate) || a.name.localeCompare(b.name);

/** The newest timeline event of an incident, when it came after the incident's date. */
export type IncidentUpdate = { date: string; datePrecision: OrgIncident['datePrecision'] };
/** `latest`: the date of the newest event, or of the incident. `story`: `storyUrl`. */
export type OrgIncidentItem = OrgIncident & { latest: string; update: IncidentUpdate | null; story?: string };

/** All research for an organization page, newest first. An incident's place is the date of its
 * newest event up to today. */
export const getOrganizationResearch = cache(async (organizationId: string) => {
  const where = { organizationId };
  const today = new Date().toISOString().slice(0, 10);
  const [incidents, events, departures] = await Promise.all([
    prisma.orgIncident.findMany({ where, omit: { logs: true } }),
    prisma.orgIncidentEvent.findMany({
      where: { incident: where, date: { lte: today } },
      select: { incidentId: true, date: true, datePrecision: true, sources: true },
      orderBy: [{ date: 'desc' }, { order: 'desc' }],
    }),
    prisma.orgDeparture.findMany({ where }),
  ]);
  return {
    incidents: incidents
      .map((row): OrgIncidentItem => {
        const i = orgIncidentFromRow(row);
        const own = events.filter((x) => x.incidentId === row.id);
        const e = own[0];
        const later = e && e.date > i.date;
        const story = storyUrl(row.sources, ...own.map((x) => x.sources));
        return {
          ...i,
          latest: later ? e.date : i.date,
          update: later ? { date: e.date, datePrecision: e.datePrecision as OrgIncident['datePrecision'] } : null,
          ...(story && { story }),
        };
      })
      .sort((a, b) => byDateDesc(a.latest, b.latest) || a.title.localeCompare(b.title)),
    departures: departures.map(orgDepartureFromRow).sort(byDeparture),
  };
});

/** One incident with its timeline in order, by the organization and the incident slug. */
export const getIncident = cache(async (organizationId: string, slug: string) => {
  const row = await prisma.orgIncident.findUnique({
    where: { organizationId_slug: { organizationId, slug } },
    include: { events: { orderBy: { order: 'asc' } } },
  });
  if (!row) return null;
  const { events, ...incident } = row;
  return { incident: orgIncidentFromRow(incident), events: events.map(orgIncidentEventFromRow) };
});

/** All departures of an organization, newest first. */
export const listDepartures = cache(async (organizationId: string) =>
  (await prisma.orgDeparture.findMany({ where: { organizationId } })).map(orgDepartureFromRow).sort(byDeparture),
);

/** An incident's `disclosed` column: the earliest full date of its sources (`firstSourceDate`). */
const DISCLOSED = Prisma.sql`(
  SELECT min(s->>'date') FROM jsonb_array_elements(sources) s WHERE length(s->>'date') = 10
) AS disclosed`;

/** All incidents of an organization, newest first, for the list at the side of its pages. */
export const listIncidents = cache(
  (organizationId: string) =>
    prisma.$queryRaw<IncidentListItem[]>`
      SELECT slug, title, date, "datePrecision", "primaryCategory", jsonb_array_length(logs)::int AS logs,
        ${DISCLOSED}
      FROM org_incident WHERE "organizationId" = ${organizationId}::uuid
      ORDER BY date DESC, title`,
);

/** All incidents of an organization, newest first, with the summary of each. */
export const listIncidentCards = cache(
  (organizationId: string) =>
    prisma.$queryRaw<IncidentCard[]>`
      SELECT slug, title, date, "datePrecision", "primaryCategory", summary,
        jsonb_array_length(logs)::int AS logs, ${DISCLOSED}
      FROM org_incident WHERE "organizationId" = ${organizationId}::uuid
      ORDER BY date DESC, title`,
);

/** The number of incidents of each organization, by severity. */
export async function incidentCounts() {
  const rows = await prisma.orgIncident.groupBy({ by: ['organizationId', 'severity'], _count: true });
  const out = new Map<string, Partial<Record<IncidentSeverity, number>>>();
  for (const r of rows)
    out.set(r.organizationId, { ...out.get(r.organizationId), [r.severity as IncidentSeverity]: r._count });
  return out;
}

/** The number of flagged chats (`COUNTED_SEVERITIES`) of each organization, as in its page: in the
 * newest published OpenAudit card version of each model (`modelEvalCounts`). */
export async function flaggedChatCounts() {
  const rows = await prisma.$queryRaw<{ id: string; n: number }[]>`
    SELECT m."organizationId" AS id, count(*)::int AS n
    FROM (
      SELECT DISTINCT ON ("cardId") id, "cardId" FROM openaudit_card_version
      WHERE status = 'published' ORDER BY "cardId", number DESC
    ) v
    JOIN openaudit_card c ON c.id = v."cardId"
    JOIN model m ON m.id = c."modelId" AND NOT m.hidden
    JOIN openaudit_card_snippet s ON s."versionId" = v.id
    JOIN openaudit_snippet sn ON sn.id = s."snippetId"
    WHERE sn.severity = ANY(${COUNTED_SEVERITIES}::text[]) AND NOT ${excludedAttempt(Prisma.sql`sn."attemptId"`)}
    GROUP BY 1`;
  return new Map(rows.map((r) => [r.id, r.n]));
}

/** The number of departures of each organization. */
export async function departureCounts() {
  const rows = await prisma.orgDeparture.groupBy({ by: ['organizationId'], _count: true });
  return new Map(rows.map((r) => [r.organizationId, r._count]));
}

/** Each organization's newest update date, up to today: an incident's date, a later timeline event,
 * or a departure. Organizations with none of these are not in the map. */
export async function lastUpdateDates() {
  const today = new Date().toISOString().slice(0, 10);
  const [incidents, events, departures] = await Promise.all([
    prisma.orgIncident.findMany({ select: { organizationId: true, date: true } }),
    prisma.orgIncidentEvent.findMany({
      where: { date: { lte: today } },
      select: { date: true, incident: { select: { organizationId: true } } },
    }),
    prisma.orgDeparture.findMany({
      where: { departedDate: { lte: today } },
      select: { organizationId: true, departedDate: true },
    }),
  ]);
  const out = new Map<string, string>();
  for (const { organizationId, date } of [
    ...incidents,
    ...events.map((e) => ({ organizationId: e.incident.organizationId, date: e.date })),
    ...departures.map((d) => ({ organizationId: d.organizationId, date: d.departedDate! })),
  ])
    if (date > (out.get(organizationId) ?? '')) out.set(organizationId, date);
  return out;
}
