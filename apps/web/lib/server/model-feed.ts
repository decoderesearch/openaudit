import type { Score } from '@/components/catalog/score';
import { prisma } from '@/lib/db';
import { FEED_PAGE, firstOfEachGroup, type FeedPage, type ModelFeedKind } from '@/lib/feed';
import { sortCards } from '@/lib/home-sorts';
import { incidentPath, plainText } from '@/lib/org-research';
import { organizationPath } from '@/lib/organizations';
import { LISTED_FROM, modelPath } from '@/lib/server/catalog';
import type { FeedIncident } from '@/lib/server/org-feed';
import { runPath } from '@/lib/server/runs';
import { snippetFeed, type SnippetFeedEntry } from '@/lib/server/snippet-feed';
import type { EvalStatus, IncidentPrimaryCategory, IncidentSeverity, IncidentStatus, Topic } from '@openaudit/spec';

/** The evals we ran on the model in the month, each with the headline result of its newest run
 * (`href`). `by`: the usernames of the users who started those runs. "OpenAudit" is a run with no user. */
export type FeedRuns = {
  evals: { name: string; slug: string; href: string; status: EvalStatus; topics: Topic[]; score: Score | null }[];
  date: string;
  by: string[];
};

/** An incident that the model is part of. `org`: the organization of the incident, when it is
 * not the model's. */
export type ModelFeedIncident = FeedIncident & { org?: string };

/** One model's new eval runs or incidents in one month. `date`: of the newest one. */
export type ModelFeedEntry = {
  key: string;
  label: string;
  href: string;
  org: { label: string; href: string };
  date: string;
  runs: FeedRuns | null;
  incidents: ModelFeedIncident[];
};

// Runs: full public runs, not re-scores and not sample runs. Incident dates: for each model, the
// newest date of the incident (its start or a timeline event) up to today.
const SOURCES = `
  incident_all AS (
    SELECT unnest(i."modelIds") AS "modelId", i.id AS "incidentId", i.date,
      NULL::text AS "eventTitle", NULL::text AS "eventDescription"
    FROM org_incident i
    UNION ALL SELECT unnest(i."modelIds"), i.id, e.date, e.title, e.description
    FROM org_incident_event e JOIN org_incident i ON i.id = e."incidentId"
  ),
  incident_dates AS (
    SELECT "modelId", "incidentId", date, "eventTitle", "eventDescription" FROM (
      SELECT a.*, max(a.date) OVER (PARTITION BY a."modelId", a."incidentId") AS newest
      FROM incident_all a WHERE a.date <= to_char(now(), 'YYYY-MM-DD')
    ) t WHERE date = newest
  ),
  runs AS (
    SELECT id, "modelId", "evalId", to_char(coalesce("finishedAt", "createdAt"), 'YYYY-MM-DD') AS date
    FROM eval_run
    WHERE status = 'succeeded' AND visibility = 'public' AND origin <> 'rescore'
      AND coalesce(jsonb_typeof(settings -> 'limit'), '') <> 'number'
  )`;
type GroupRow = {
  modelId: string;
  month: string;
  date: string;
  name: string;
  displayName: string;
  orgName: string;
  orgSlug: string;
};
type RunRow = {
  id: string;
  modelId: string;
  month: string;
  slug: string;
  name: string;
  status: EvalStatus;
  topics: Topic[];
  date: string;
  metric: string | null;
  value: number | null;
  unit: string | null;
  stderr: number | null;
  safetyDirection: string | null;
  min: number | null;
  max: number | null;
  username: string | null;
};
type IncidentRow = {
  modelId: string;
  month: string;
  date: string;
  eventTitle: string | null;
  eventDescription: string | null;
  slug: string;
  title: string;
  severity: IncidentSeverity;
  category: IncidentPrimaryCategory;
  status: IncidentStatus;
  started: string;
  summary: string;
  orgSlug: string;
  orgName: string;
  orgId: string;
  modelOrgId: string;
};

/** `limit` entries of one `kind` from `offset`, newest first, and whether more follow.
 * Models are as `LISTED_MODEL`. A month is "2026-09". */
export async function modelFeed(kind: ModelFeedKind, offset = 0, limit = FEED_PAGE): Promise<FeedPage<ModelFeedEntry>> {
  const events =
    kind === 'evals'
      ? `SELECT "modelId", date FROM runs`
      : `SELECT "modelId", date FROM incident_dates WHERE date <= to_char(now(), 'YYYY-MM-DD')`;
  const groups = await prisma.$queryRawUnsafe<GroupRow[]>(
    `WITH ${SOURCES},
    events AS (${events}),
    groups AS (SELECT "modelId", left(date, 7) AS month, max(date) AS date FROM events GROUP BY 1, 2)
    SELECT g."modelId", g.month, g.date, m.name, m."displayName", o."displayName" AS "orgName", o.slug AS "orgSlug"
    FROM groups g JOIN model m ON m.id = g."modelId" JOIN organization o ON o.id = m."organizationId"
    WHERE NOT o.hidden AND NOT m.hidden AND ((NOT m.pretrained AND m."parentRelation" IS DISTINCT FROM 'quantized'
      AND m.facts #>> '{releaseDate,value}' >= '${LISTED_FROM}' COLLATE "C") OR EXISTS (
      SELECT 1 FROM openaudit_card c JOIN openaudit_card_version v ON v."cardId" = c.id
      WHERE c."modelId" = m.id AND v.status = 'published'))
    ORDER BY g.date DESC, m."displayName", g."modelId"
    LIMIT $1 OFFSET $2`,
    limit + 1,
    offset,
  );
  const more = groups.length > limit;
  const page = groups.slice(0, limit);
  if (!page.length) return { entries: [], more };

  const ids = [...new Set(page.map((g) => g.modelId))];
  const months = [...new Set(page.map((g) => g.month))];
  const none = Promise.resolve([]);
  const [runs, incidents] = await Promise.all([
    kind !== 'evals'
      ? none
      : prisma.$queryRawUnsafe<RunRow[]>(
          `WITH ${SOURCES},
      newest AS (
        SELECT DISTINCT ON (r."modelId", left(r.date, 7), r."evalId") r.id, r."modelId", left(r.date, 7) AS month,
          r."evalId", r.date
        FROM runs r
        WHERE r."modelId" = ANY($1::uuid[]) AND left(r.date, 7) = ANY($2::text[])
        ORDER BY r."modelId", left(r.date, 7), r."evalId", r.date DESC, r.id DESC
      )
      SELECT n.id, n."modelId", n.month, e.slug, e."displayName" AS name, e.status, e.topics, n.date,
        res.metric, res.value, res.unit, res.stderr, res."safetyDirection",
        (def ->> 'min')::float AS min, (def ->> 'max')::float AS max, u.username
      FROM newest n JOIN eval e ON e.id = n."evalId"
      JOIN eval_run er ON er.id = n.id JOIN eval_version v ON v.id = er."evalVersionId"
      LEFT JOIN "user" u ON u.id = er."ownerUserId"
      LEFT JOIN LATERAL (
        SELECT x.metric, x.value, x.unit, x.stderr, x."safetyDirection" FROM eval_result x
        WHERE x."evalRunId" = n.id
        ORDER BY x.metric = (
          SELECT m ->> 'key' FROM jsonb_array_elements(v.metrics) m WHERE (m ->> 'headline')::boolean LIMIT 1
        ) DESC NULLS LAST, x."createdAt", x.id
        LIMIT 1
      ) res ON true
      LEFT JOIN LATERAL (
        SELECT m AS def FROM jsonb_array_elements(v.metrics) m WHERE m ->> 'key' = split_part(res.metric, '@', 1) LIMIT 1
      ) d ON true
      ORDER BY e."displayName"`,
          ids,
          months,
        ),
    // An incident shows once in a month: its newest date there, the start before an event.
    kind !== 'incidents'
      ? none
      : prisma.$queryRawUnsafe<IncidentRow[]>(
          `WITH ${SOURCES}
      SELECT * FROM (
        SELECT DISTINCT ON (x."modelId", left(x.date, 7), i.id) x."modelId", left(x.date, 7) AS month, x.date,
          x."eventTitle", x."eventDescription", i.slug, i.title, i.severity, i."primaryCategory" AS category, i.status, i.date AS started, i.summary,
          o.slug AS "orgSlug", o."displayName" AS "orgName", o.id AS "orgId", m."organizationId" AS "modelOrgId"
        FROM incident_dates x JOIN org_incident i ON i.id = x."incidentId"
        JOIN organization o ON o.id = i."organizationId" JOIN model m ON m.id = x."modelId"
        WHERE x."modelId" = ANY($1::uuid[]) AND left(x.date, 7) = ANY($2::text[])
          AND x.date <= to_char(now(), 'YYYY-MM-DD')
        ORDER BY x."modelId", left(x.date, 7), i.id, x.date DESC, x."eventTitle" IS NOT NULL
      ) t ORDER BY date DESC, title`,
          ids,
          months,
        ),
  ]);

  const key = (r: { modelId: string; month: string }) => `${r.modelId} ${r.month}`;
  const entries = page.map((g): ModelFeedEntry => {
    const m = { name: g.name };
    const myRuns = runs.filter((r) => key(r) === key(g));
    return {
      key: key(g),
      label: g.displayName,
      href: modelPath(m),
      org: { label: g.orgName, href: organizationPath({ slug: g.orgSlug }) },
      date: g.date,
      runs: myRuns.length
        ? {
            evals: myRuns.map((r) => ({
              name: r.name,
              slug: r.slug,
              href: runPath(r),
              status: r.status,
              topics: r.topics,
              score: score(r),
            })),
            date: myRuns.reduce((max, r) => (r.date > max ? r.date : max), ''),
            by: [...new Set(myRuns.map((r) => r.username ?? 'OpenAudit'))].sort(),
          }
        : null,
      incidents: incidents.filter((i) => key(i) === key(g)).map(incident),
    };
  });
  return { entries, more };
}

/** All the models with flagged chats, newest first, as on the home page. Each has its first
 * `FEED_SNIPPETS` chats of each group. */
export async function modelUpdates(): Promise<SnippetFeedEntry[]> {
  return sortCards(await snippetFeed(), 'date').map((e) => ({ ...e, snippets: firstOfEachGroup(e.snippets) }));
}

/** The incidents that the model is part of, newest first, each with its newest update. */
export async function modelIncidents(modelId: string): Promise<ModelFeedIncident[]> {
  const rows = await prisma.$queryRawUnsafe<IncidentRow[]>(
    `WITH ${SOURCES}
    SELECT * FROM (
      SELECT DISTINCT ON (i.id) x."modelId", left(x.date, 7) AS month, x.date, x."eventTitle", x."eventDescription",
        i.slug, i.title, i.severity, i."primaryCategory" AS category, i.status, i.date AS started, i.summary,
        o.slug AS "orgSlug", o."displayName" AS "orgName", o.id AS "orgId", m."organizationId" AS "modelOrgId"
      FROM incident_dates x JOIN org_incident i ON i.id = x."incidentId"
      JOIN organization o ON o.id = i."organizationId" JOIN model m ON m.id = x."modelId"
      WHERE x."modelId" = $1::uuid AND x.date <= to_char(now(), 'YYYY-MM-DD')
      ORDER BY i.id, x.date DESC, x."eventTitle" IS NOT NULL
    ) t ORDER BY date DESC, title`,
    modelId,
  );
  return rows.map(incident);
}

function incident(i: IncidentRow): ModelFeedIncident {
  const update =
    i.eventTitle !== null && i.date.slice(0, 7) > i.started.slice(0, 7)
      ? { title: i.eventTitle, ...(i.eventDescription && { description: plainText(i.eventDescription) }) }
      : undefined;
  return {
    key: `${i.orgSlug}/${i.slug}`,
    title: i.title,
    href: incidentPath({ slug: i.orgSlug }, i.slug),
    date: i.date,
    severity: i.severity,
    category: i.category,
    status: i.status,
    started: i.started,
    summary: plainText(i.summary),
    ...(update && { update }),
    ...(i.orgId !== i.modelOrgId && { org: i.orgName }),
  };
}

function score(r: RunRow): Score | null {
  if (r.metric === null || r.value === null) return null;
  return {
    metric: r.metric,
    value: r.value,
    unit: (r.unit ?? undefined) as Score['unit'],
    stderr: r.stderr ?? undefined,
    safetyDirection: (r.safetyDirection ?? undefined) as Score['safetyDirection'],
    ...(r.min !== null && r.max !== null && { range: [r.min, r.max] as [number, number] }),
  };
}
