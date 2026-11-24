import {
  CATEGORY_ORDER,
  COMMITMENT_FEED_PAGE,
  type CommitmentFeedEntry,
  type CommitmentGrid,
  type CommitmentSummary,
  criteriaScore,
  orgCommitmentPath,
  type SideCommitment,
  totalScore,
} from '@/lib/commitments';
import { prisma } from '@/lib/db';
import type { FeedPage } from '@/lib/feed';
import { plainText } from '@/lib/org-research';
import { SHOWN_ORG } from '@/lib/server/catalog';
import { commitmentFromRow, orgCommitmentEventFromRow, orgCommitmentFromRow } from '@/lib/spec/rows';
import type { Commitment, CommitmentLevel, OrgCommitment, OrgCommitmentEvent } from '@openaudit/spec';
import { cache } from 'react';

// Reads for safety commitments: the table, a commitment's page, and an organization's list and
// timelines. Hidden organizations are not shown.

export type CommitmentOrg = { id: string; slug: string; displayName: string };
/** One cell: an organization's state, with the date of its newest event. */
export type CommitmentCell = OrgCommitment & { latest: string | null };

const ORG_SELECT = { id: true, slug: true, displayName: true } as const;
const byOrder = (a: Commitment, b: Commitment) =>
  CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.order - b.order;

/** All commitments, in table order. */
export const listCommitments = cache(async () =>
  (await prisma.commitment.findMany()).map(commitmentFromRow).sort(byOrder),
);

/** Each organization's cells, with the newest event dates. */
async function cells(where: { organizationId?: string; commitmentId?: string }) {
  const rows = await prisma.orgCommitment.findMany({
    where: { ...where, organization: SHOWN_ORG },
    include: {
      organization: { select: ORG_SELECT },
      events: { select: { date: true }, orderBy: { order: 'desc' }, take: 1 },
    },
  });
  return rows.map(({ organization, events, ...row }) => ({
    org: organization,
    cell: { ...orgCommitmentFromRow(row), latest: events[0]?.date ?? null } as CommitmentCell,
  }));
}

/** Levels that count as a commitment, for the order of the rows. */
const COMMITTED: Partial<Record<CommitmentLevel, number>> = { full: 2, partial: 1, intent: 0.5 };

/** The table: the commitments, and the organizations with any cell, the most committed first. */
export const commitmentTable = cache(async () => {
  const [commitments, all] = await Promise.all([listCommitments(), cells({})]);
  const orgs = new Map<string, { org: CommitmentOrg; cells: Record<string, CommitmentCell>; score: number }>();
  const slugOf = new Map(commitments.map((c) => [c.id, c.slug]));
  for (const { org, cell } of all) {
    const row = orgs.get(org.id) ?? { org, cells: {}, score: 0 };
    row.cells[slugOf.get(cell.commitmentId)!] = cell;
    row.score += COMMITTED[cell.state.level] ?? 0;
    orgs.set(org.id, row);
  }
  const rows = [...orgs.values()].sort(
    (a, b) => b.score - a.score || a.org.displayName.localeCompare(b.org.displayName),
  );
  return { commitments, rows };
});

/** The table as a `CommitmentGrid`. `slim`: no summaries or dates, for the navbar menu. */
export const commitmentGrid = cache(async (slim = false): Promise<CommitmentGrid> => {
  const { commitments, rows } = await commitmentTable();
  const keys = new Map(commitments.map((c) => [c.slug, c.criteria.map((x) => x.key)]));
  const orgs = rows
    .map((r) => ({
      ...r,
      total: totalScore(commitments.map((c) => ({ state: r.cells[c.slug]?.state, keys: keys.get(c.slug)! }))),
    }))
    .sort((a, b) => b.total.points - a.total.points || a.org.displayName.localeCompare(b.org.displayName));
  return {
    orgs: orgs.map(({ org, total }) => ({ id: org.id, slug: org.slug, name: org.displayName, total })),
    groups: CATEGORY_ORDER.map((category) => ({
      category,
      list: commitments
        .filter((c) => c.category === category)
        .map((c) => ({
          slug: c.slug,
          name: c.name,
          about: plainText(c.summary),
          cells: orgs.map(({ cells }) => {
            const cell = cells[c.slug];
            if (!cell) return null;
            const score = criteriaScore(cell.state, keys.get(c.slug)!);
            return {
              level: cell.state.level,
              score: score && { points: score.points, total: score.total },
              ...(!slim && { summary: cell.summary, latest: cell.latest }),
            };
          }),
        })),
    })).filter((g) => g.list.length),
  };
});

/** Each organization's points and number of commitments, by organization id. Only organizations
 * with a cell. */
export const commitmentSummaries = cache(async () => {
  const { commitments, rows } = await commitmentTable();
  return new Map<string, CommitmentSummary>(
    rows.map((r) => {
      const score = (list: Commitment[]) =>
        totalScore(list.map((c) => ({ state: r.cells[c.slug]?.state, keys: c.criteria.map((x) => x.key) })));
      return [
        r.org.id,
        {
          ...score(commitments),
          count: Object.values(r.cells).filter((c) => c.state.level in COMMITTED).length,
          categories: Object.fromEntries(
            CATEGORY_ORDER.map((k) => [k, score(commitments.filter((c) => c.category === k))]),
          ) as CommitmentSummary['categories'],
        },
      ];
    }),
  );
});

/** The events of a commitment's organizations, newest first, `size` from `offset`. */
async function eventsPage(
  commitment: { id: string; slug: string },
  offset: number,
  size = COMMITMENT_FEED_PAGE,
): Promise<FeedPage<CommitmentFeedEntry>> {
  const rows = await prisma.orgCommitmentEvent.findMany({
    where: { orgCommitment: { commitmentId: commitment.id, organization: SHOWN_ORG } },
    include: { orgCommitment: { select: { organization: { select: ORG_SELECT } } } },
    orderBy: [{ date: 'desc' }, { order: 'desc' }, { id: 'asc' }],
    skip: offset,
    take: size + 1,
  });
  return {
    entries: rows.slice(0, size).map(({ orgCommitment: { organization: org }, ...e }) => ({
      key: e.id,
      event: orgCommitmentEventFromRow(e),
      org: { displayName: org.displayName, href: orgCommitmentPath(org, commitment.slug) },
    })),
    more: rows.length > size,
  };
}

/** More of a commitment's events, from `offset`. Null when there is no such commitment. */
export async function commitmentEventsPage(slug: string, offset: number) {
  const row = await prisma.commitment.findUnique({ where: { slug }, select: { id: true, slug: true } });
  return row && eventsPage(row, offset);
}

/** A commitment with each organization's cell, the most committed first, and the first page of
 * their events. */
export const getCommitment = cache(async (slug: string) => {
  const row = await prisma.commitment.findUnique({ where: { slug } });
  if (!row) return null;
  const commitment = commitmentFromRow(row);
  const [list, events] = await Promise.all([cells({ commitmentId: commitment.id }), eventsPage(commitment, 0)]);
  const rank = (c: CommitmentCell) => COMMITTED[c.state.level] ?? 0;
  return {
    commitment,
    orgs: list.sort((a, b) => rank(b.cell) - rank(a.cell) || a.org.displayName.localeCompare(b.org.displayName)),
    events,
  };
});

/** Each commitment with the organization's cell, or null when we did not check it. */
export const listOrgCommitments = cache(async (organizationId: string) => {
  const [commitments, list] = await Promise.all([listCommitments(), cells({ organizationId })]);
  const byCommitment = new Map(list.map(({ cell }) => [cell.commitmentId, cell]));
  return commitments.map((commitment) => ({ commitment, cell: byCommitment.get(commitment.id) ?? null }));
});

/** One organization's state for one commitment, with its timeline, newest first. */
export const getOrgCommitment = cache(async (organizationId: string, slug: string) => {
  const commitment = await prisma.commitment.findUnique({ where: { slug } });
  if (!commitment) return null;
  const row = await prisma.orgCommitment.findUnique({
    where: { organizationId_commitmentId: { organizationId, commitmentId: commitment.id } },
    include: { events: { orderBy: { order: 'desc' } } },
  });
  const { events = [], ...cell } = row ?? {};
  return {
    commitment: commitmentFromRow(commitment),
    cell: row ? orgCommitmentFromRow(cell as typeof row) : null,
    events: events.map(orgCommitmentEventFromRow) as OrgCommitmentEvent[],
  };
});

/** Each commitment, by category, with the organization's level and points (null when we did not
 * check it), for the list at the side of its pages. */
export const orgCommitmentStates = cache(async (organizationId: string): Promise<SideCommitment[]> => {
  const rows = await listOrgCommitments(organizationId);
  return CATEGORY_ORDER.flatMap((category) =>
    rows
      .filter((r) => r.commitment.category === category)
      .map(({ commitment: c, cell }) => ({
        slug: c.slug,
        name: c.name,
        category,
        criteria: c.criteria.length,
        state: cell && { level: cell.state.level },
        score:
          cell &&
          criteriaScore(
            cell.state,
            c.criteria.map((x) => x.key),
          ),
      })),
  );
});
