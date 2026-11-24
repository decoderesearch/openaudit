import { Prisma } from '#prisma';
import { monthYear } from '@/lib/card-heading';
import { criteriaScore, LEVEL_GROUP, type LevelGroup } from '@/lib/commitments';
import { prisma } from '@/lib/db';
import { methodPath } from '@/lib/methods';
import { COUNTED_SEVERITIES } from '@/lib/openaudit-card';
import {
  findModel,
  findOrganization,
  getEval,
  getModel,
  getOrganization,
  isHiddenModel,
  isHiddenOrganization,
  LISTED_MODEL,
  modelEvalCounts,
} from '@/lib/server/catalog';
import { commitmentGrid, commitmentSummaries, getCommitment } from '@/lib/server/commitments';
import { evalsTooOldFor } from '@/lib/server/eval-age';
import { methodEvalRows, modelEvalRows, runnableModelEvalCount } from '@/lib/server/eval-list-rows';
import { excludedAttempt } from '@/lib/server/excluded-attempts';
import { homeCounts } from '@/lib/server/home-counts';
import { getMethod, getSuite } from '@/lib/server/methods';
import { modelIncidents } from '@/lib/server/model-feed';
import { byMedals, methodsWithVariants, withMedals, type NavMethod } from '@/lib/server/nav-methods';
import { getOrganizationResearch } from '@/lib/server/org-research';
import { cache } from 'react';

// The numbers of the share images and tags. They use the same counts as the pages and lists.

const evalCounts = cache(modelEvalCounts);

/** The newest published OpenAudit's counted snippets of the model: by category, and how many are
 * high (or critical) and medium. */
async function flaggedChats(modelId: string) {
  const rows = await prisma.$queryRaw<{ category: string; severity: string; n: number }[]>`
    SELECT sn.category, sn.severity, count(*)::int AS n
    FROM (
      SELECT v.id FROM openaudit_card_version v JOIN openaudit_card c ON c.id = v."cardId"
      WHERE c."modelId" = ${modelId}::uuid AND v.status = 'published'
        AND v."reviewedAt" IS NOT NULL ORDER BY v.number DESC LIMIT 1
    ) v
    JOIN openaudit_card_snippet s ON s."versionId" = v.id
    JOIN openaudit_snippet sn ON sn.id = s."snippetId"
    WHERE sn.severity = ANY(${COUNTED_SEVERITIES}::text[]) AND NOT ${excludedAttempt(Prisma.sql`sn."attemptId"`)}
    GROUP BY 1, 2`;
  const categories = new Map<string, number>();
  let high = 0;
  let medium = 0;
  for (const r of rows) {
    categories.set(r.category, (categories.get(r.category) ?? 0) + r.n);
    if (r.severity === 'medium') medium += r.n;
    else high += r.n;
  }
  return { categories: [...categories].sort((a, b) => b[1] - a[1]), high, medium };
}

export const modelOg = cache(async (owner: string, repo: string) => {
  const row = await findModel(owner, repo);
  if (!row || (await isHiddenModel(row.id))) return null;
  const [found, counts, flagged, incidents, [tooOld]] = await Promise.all([
    getModel(owner, repo),
    evalCounts(),
    flaggedChats(row.id),
    modelIncidents(row.id),
    evalsTooOldFor([row]),
  ]);
  if (!found) return null;
  const n = (m: Map<string, number>) => m.get(row.id) ?? 0;
  return {
    model: found.model,
    organization: found.organization,
    openAudit: n(counts.openAudit),
    systemCard: n(counts.systemCard),
    meter: counts.deploymeter.get(row.id) ?? null,
    judges: counts.judges.get(row.id) ?? [],
    flagged,
    incidentCount: incidents.length,
    tooOld: tooOld ?? false,
  };
});

export const organizationOg = cache(async (segment: string) => {
  const named = await findOrganization(segment);
  if (!named || (await isHiddenOrganization(named.org.id))) return null;
  const [found, research, counts, summaries, openAudits, listed] = await Promise.all([
    getOrganization(named.org.slug),
    getOrganizationResearch(named.org.id),
    evalCounts(),
    commitmentSummaries(),
    prisma.model.count({
      where: {
        organizationId: named.org.id,
        openAuditCard: { versions: { some: { status: 'published', reviewedAt: { not: null } } } },
      },
    }),
    prisma.model.findMany({ where: { organizationId: named.org.id, ...LISTED_MODEL }, select: { id: true } }),
  ]);
  if (!found) return null;
  const listedIds = new Set(listed.map((m) => m.id));
  const models = found.models.filter((m) => listedIds.has(m.id));
  const sum = (m: Map<string, number>) => found.models.reduce((a, x) => a + (m.get(x.id) ?? 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const incidents = research.incidents.filter((i) => i.date <= today);
  const commitments = summaries.get(named.org.id);
  return {
    organization: found.organization,
    models: models.length,
    openAudits,
    flagged: sum(counts.flagged),
    commitments: commitments ? { points: commitments.points, total: commitments.total } : null,
    incidentCount: incidents.length,
    latestIncident: incidents[0] ?? null,
    departures: research.departures.length,
  };
});

/** The most committed organizations, as the commitments table orders them. */
export const commitmentsOg = cache(async () => {
  const grid = await commitmentGrid(true);
  return {
    orgs: grid.orgs.map((o) => ({ name: o.name, score: o.total })),
    commitments: grid.groups.reduce((n, g) => n + g.list.length, 0),
  };
});

/** A commitment, its organizations with the most points first, and how many are in each level
 * group. */
export const commitmentOg = cache(async (slug: string) => {
  const found = await getCommitment(slug);
  if (!found) return null;
  const keys = found.commitment.criteria.map((x) => x.key);
  const orgs = found.orgs
    .map(({ org, cell }) => ({
      name: org.displayName,
      group: LEVEL_GROUP[cell.state.level],
      score: criteriaScore(cell.state, keys) ?? { points: 0, total: keys.length },
    }))
    .sort((a, b) => b.score.points - a.score.points);
  const groups: Record<LevelGroup, number> = { full: 0, partial: 0, none: 0 };
  for (const o of orgs) groups[o.group]++;
  return { commitment: found.commitment, orgs, groups };
});

/** The variants with medals, the best first, with their method's name. */
const medaled = (methods: NavMethod[]) =>
  methods
    .flatMap((m) => m.variants.map((v) => ({ ...v, method: m.label })))
    .filter((v) => v.medals.length)
    .sort(byMedals);

/** The counts of the Methods page. */
export const methodsOg = cache(async () => {
  const [methods, rows] = await Promise.all([methodsWithVariants(), methodEvalRows()]);
  return {
    methods: methods.length,
    variants: methods.reduce((n, m) => n + m.variants.length, 0),
    evals: rows.length,
  };
});

/** A method, its variants with their medals in its evals (as on its page), and its eval count. */
export const methodOg = cache(async (slug: string) => {
  const data = await getMethod(slug);
  if (!data) return null;
  const [methods, rows] = await Promise.all([methodsWithVariants(), methodEvalRows()]);
  const slugs = new Set(data.evals.map((e) => e.slug));
  const evalRows = rows.filter((r) => slugs.has(r.slug));
  const nav = withMedals(methods, evalRows).find((m) => m.href === methodPath(slug));
  return { method: data.method, variants: nav?.variants ?? [], evals: evalRows.length };
});

/** A suite, its creators and date, and the variants with the most medals in its evals. */
export const suiteOg = cache(async (slug: string) => {
  const found = await getSuite(slug);
  if (!found) return null;
  const [methods, rows] = await Promise.all([methodsWithVariants(), methodEvalRows()]);
  const mine = new Set(found.evals.map((e) => e.slug));
  const suiteRows = rows.filter((r) => mine.has(r.slug));
  return {
    suite: found.suite,
    creator: found.suite.maintainers.map((m) => m.name).join(', '),
    date: monthYear(suiteRows.find((r) => r.suite?.slug === slug)?.suite?.date ?? null),
    top: medaled(withMedals(methods, suiteRows)),
    evals: found.evals.length,
    methods: found.methods.length,
  };
});

/** An eval (public or unlisted), and its row in the Models or Methods page list, as the Evaluation
 * of the Day card shows it. The row is null for an eval that the lists do not show. `authors`: of
 * each variant, by its link. */
export const evalOg = cache(async (slug: string) => {
  const found = await getEval(slug);
  if (!found) return null;
  const method = found.eval.facets.subjects.includes('method');
  const [rows, methods] = await Promise.all([
    method ? methodEvalRows() : modelEvalRows(),
    method ? methodsWithVariants() : [],
  ]);
  const authors = new Map(methods.flatMap((m) => m.variants.map((v) => [v.href, v.author] as const)));
  return { eval: found.eval, method, row: rows.find((r) => r.slug === slug) ?? null, authors };
});

/** The listed models with a Deploymeter, the highest first, and the counts of the Models page. */
export const modelsOg = cache(async () => {
  const [counts, home, evals] = await Promise.all([evalCounts(), homeCounts(), runnableModelEvalCount()]);
  const rows = await prisma.model.findMany({
    where: { id: { in: [...counts.deploymeter.keys()] }, ...LISTED_MODEL },
    select: { id: true, displayName: true, source: true, facts: true },
  });
  const scored = rows
    .map((m) => ({
      row: m,
      name: m.displayName,
      meter: counts.deploymeter.get(m.id)!,
      judges: counts.judges.get(m.id) ?? [],
    }))
    .sort((a, b) => b.meter - a.meter || a.name.localeCompare(b.name));
  const highest = scored.slice(0, 3);
  // The lowest 3, the lowest first, but not the ones in the highest 3.
  const lowest = scored.slice(Math.max(3, scored.length - 3)).reverse();
  const tooOld = await evalsTooOldFor([...highest, ...lowest].map((m) => m.row));
  return { highest, lowest, tooOld: tooOld.some(Boolean), scored: scored.length, models: home.models, evals };
});
