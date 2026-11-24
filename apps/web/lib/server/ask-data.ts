import { pageKind, readablePage, toursFor } from '@/lib/ask/pages';
import { compact } from '@/lib/compact-json';
import { prisma } from '@/lib/db';
import { FRAMEWORKS } from '@/lib/frameworks';
import { mergeCards } from '@/lib/merge-cards';
import { isSystemCardPath } from '@/lib/model-mode';
import { TOP_LEVEL_ROUTES, organizationPath } from '@/lib/organizations';
import {
  cardPath,
  cardTitle,
  cardsForModel,
  findOrganization,
  getEval,
  getModel,
  getOrganization,
  listEvals,
  listModels,
  listOrganizations,
  modelPath,
  resultsForEval,
  systemCardPath,
  systemCardsFor,
} from '@/lib/server/catalog';
import { orgCommitmentStates } from '@/lib/server/commitments';
import { getDeploymeter } from '@/lib/server/deploymeter';
import { evalRunLinks, listRuns, runPath } from '@/lib/server/runs';
import { systemCardFromRow } from '@/lib/spec/rows';
import type { EvalResult, Model } from '@openaudit/spec';

// Catalog data for the chat helper: the page the reader has open, and the lookups its tools make.
// Plain JSON with ids and extraction details removed. Eval samples are never sent.

/** Most result rows sent at once. */
const MAX_RESULTS = 300;
function result(r: EvalResult) {
  return {
    eval: r.rawEvalName,
    metric: r.metric,
    value: r.value,
    unit: r.unit,
    stderr: r.stderr,
    ci: r.ciLow !== undefined && r.ciHigh !== undefined ? [r.ciLow, r.ciHigh] : undefined,
    n: r.n,
    settings: r.settings,
    page: r.source?.page,
  };
}

function modelSummary(m: Model) {
  return { name: m.displayName, path: modelPath(m), family: m.family, source: m.source, facts: m.facts };
}

export async function cardData(owner: string, repo: string, documentKey: string) {
  const found = await getModel(owner, repo);
  if (!found) return null;
  const [c] = await cardsForModel(found.model, { documentKey });
  if (!c) return null;
  return {
    title: cardTitle(c.document),
    kind: c.document.kind,
    path: cardPath(found.model, c.document.key, c.document.kind),
    model: found.model.displayName,
    organization: found.organization.displayName,
    published: c.document.publishedDate,
    originalUrl: c.document.url,
    pages: c.pageCount,
    findings: c.findings,
    riskDecisions: c.riskDecisions.map((r) => ({
      ...r,
      frameworks: r.frameworks?.map((f) => FRAMEWORKS[f].name),
    })),
    topics: c.topics,
    externalTesters: c.testers,
    disclosures: c.disclosures,
    resultCount: c.results.length,
    results: c.results.slice(0, MAX_RESULTS).map(result),
  };
}

/** All of a model's system cards as one: `from` in each item is its index in `sources`. */
export async function systemCardData(owner: string, repo: string) {
  const found = await getModel(owner, repo);
  if (!found) return null;
  const sources = await systemCardsFor(found.model);
  const head = { model: found.model.displayName, path: systemCardPath(found.model) };
  if (!sources.length) return { ...head, systemCard: 'none: we know of no system card for this model' };
  const merged = mergeCards(sources);
  return {
    ...head,
    rule: 'For each item, the newest source that states it wins.',
    sources: sources.map((c) => ({
      title: cardTitle(c.document),
      path: cardPath(found.model, c.document.key, c.document.kind),
      published: c.document.publishedDate,
    })),
    findings: merged.findings,
    riskDecisions: merged.riskDecisions.map((r) => ({
      ...r,
      frameworks: r.frameworks?.map((f) => FRAMEWORKS[f].name),
    })),
    topics: merged.topics,
    externalTesters: merged.testers,
    disclosures: merged.disclosures,
    resultCount: merged.results.length,
    results: merged.results.slice(0, MAX_RESULTS).map((r) => ({ ...result(r), from: r.from })),
  };
}

export async function modelData(owner: string, repo: string) {
  const found = await getModel(owner, repo);
  if (!found) return null;
  const [cards, runs, meter] = await Promise.all([
    cardsForModel(found.model, { results: false }),
    evalRunLinks(found.model.id),
    getDeploymeter(found.model.id, null),
  ]);
  const summary = (c: (typeof cards)[number]) => ({
    title: cardTitle(c.document),
    kind: c.document.kind,
    path: cardPath(found.model, c.document.key, c.document.kind),
    resultCount: c.resultCount,
    findings: c.findings.map((f) => f.text),
  });
  const systemCards = cards.filter((c) => c.document.kind === 'system_card');
  return {
    ...modelSummary(found.model),
    organization: found.organization.displayName,
    organizationPath: organizationPath(found.organization),
    deploymeter: meter
      ? {
          score: meter.meter,
          judgesCounted: meter.counted,
          approve: meter.approvals,
          limitedApproval: meter.withLimits,
          judges: meter.reviews.map((r) => ({ judge: r.judgeName, score: r.score, headline: r.headline })),
        }
      : 'none yet',
    openAuditRuns: runs.map((r) => ({
      eval: r.label,
      evalPath: `/evaluations/${r.slug}`,
      run: r.href,
      result: r.result,
    })),
    parent: found.parent && { relation: found.model.parentRelation, ...modelSummary(found.parent) },
    variants: found.children.map((m) => ({ relation: m.parentRelation, name: m.displayName, path: modelPath(m) })),
    systemCard: systemCards.length
      ? { path: systemCardPath(found.model), sources: systemCards.map(summary) }
      : 'none: we know of no system card for this model',
    reports: cards.filter((c) => c.document.kind !== 'system_card').map(summary),
    otherDocuments: found.documents.map((d) => ({
      title: d.title,
      kind: d.kind,
      published: d.publishedDate,
      url: d.url,
    })),
  };
}

export async function evalData(slug: string) {
  const found = await getEval(slug);
  if (!found) return null;
  const [results, runs] = await Promise.all([resultsForEval(found.eval.id), listRuns({ evalId: found.eval.id }, 200)]);
  // The newest run of each model: `listRuns` is newest first.
  const newest = [...new Map(runs.reverse().map((r) => [r.model.name, r])).values()];
  return {
    name: found.eval.displayName,
    path: `/evaluations/${found.eval.slug}`,
    ...found.eval,
    versions: found.versions.map((v) => ({ version: v.version, released: v.releasedDate })),
    openAuditRuns: newest.map((r) => ({
      model: r.model.displayName,
      modelPath: `/${r.model.name}`,
      run: runPath(r.run),
      modelReleased: r.released.model,
      evalReleased: r.released.eval,
      results: r.results.map(({ metric, value, unit, safetyDirection }) => ({ metric, value, unit, safetyDirection })),
    })),
    documentResultCount: results.length,
    documentResults: results.slice(0, MAX_RESULTS).map((r) => ({
      model: r.model?.displayName ?? r.rawModelName,
      modelPath: r.model && modelPath(r.model),
      document: r.document && cardTitle(r.document),
      ...result(r),
    })),
  };
}

/** An organization by a raw path segment (its slug, a slug alias or another letter case), with its
 * newest 40 incidents and departures and their counts. */
export async function organizationData(segment: string) {
  const named = await findOrganization(segment);
  const found = named && (await getOrganization(named.org.slug));
  if (!found) return null;
  const org = found.organization;
  const path = organizationPath(org);
  const [commitments, incidents, departures, counts] = await Promise.all([
    orgCommitmentStates(org.id),
    prisma.orgIncident.findMany({
      where: { organizationId: org.id },
      select: { slug: true, title: true, date: true, severity: true },
      orderBy: { date: 'desc' },
      take: 40,
    }),
    prisma.orgDeparture.findMany({
      where: { organizationId: org.id },
      select: { name: true, title: true, departedDate: true, reason: true },
      orderBy: { departedDate: 'desc' },
      take: 40,
    }),
    prisma.organization.findUniqueOrThrow({
      where: { id: org.id },
      select: { _count: { select: { incidents: true, departures: true } } },
    }),
  ]);
  return {
    name: org.displayName,
    path,
    commitments: commitments
      .filter((c) => c.state)
      .map((c) => ({
        name: c.name,
        path: `${path}/commitments/${c.slug}`,
        level: c.state!.level,
        points: c.score && `${c.score.points} of ${c.score.total}`,
      })),
    incidentCount: counts._count.incidents,
    incidents: incidents.map((i) => ({ ...i, path: `${path}/incidents/${i.slug}` })),
    departureCount: counts._count.departures,
    departures,
    models: found.models.map((m) => ({
      name: m.displayName,
      path: modelPath(m),
      released: m.facts.releaseDate?.value,
    })),
    documents: found.documents.map((d) => ({ title: d.title, kind: d.kind, published: d.publishedDate, url: d.url })),
  };
}

const has = (q: string, ...names: (string | undefined)[]) => names.some((n) => n?.toLowerCase().includes(q));

/** Models, system cards, evals, organizations, methods, commitments and incidents whose names
 * contain `query`. */
export async function searchCatalog(query: string) {
  const q = query.trim().toLowerCase();
  if (!q)
    return { models: [], systemCards: [], evals: [], organizations: [], methods: [], commitments: [], incidents: [] };
  const named = (...fields: string[]) => ({
    OR: fields.map((f) => ({ [f]: { contains: q, mode: 'insensitive' as const } })),
  });
  const [models, evals, organizations, cards, methods, variants, commitments, incidents] = await Promise.all([
    listModels({ q }),
    listEvals({}),
    listOrganizations(),
    prisma.systemCard.findMany({
      where: { document: { title: { contains: q, mode: 'insensitive' } } },
      include: { document: true },
      take: 15,
    }),
    prisma.method.findMany({
      where: named('displayName', 'slug'),
      select: { slug: true, displayName: true, summary: true },
      take: 10,
    }),
    prisma.methodVariant.findMany({
      where: named('displayName', 'slug'),
      select: { slug: true, displayName: true, method: { select: { slug: true, displayName: true } } },
      take: 10,
    }),
    prisma.commitment.findMany({
      where: named('name', 'slug'),
      select: { slug: true, name: true, summary: true },
      take: 10,
    }),
    prisma.orgIncident.findMany({
      where: { ...named('title', 'summary'), organization: { hidden: false } },
      select: { slug: true, title: true, date: true, organization: { select: { slug: true, displayName: true } } },
      orderBy: { date: 'desc' },
      take: 10,
    }),
  ]);
  const firstCover = (c: (typeof cards)[number]) => {
    const cover = systemCardFromRow(c).covers[0];
    return cover && 'modelId' in cover ? String(cover.modelId) : '';
  };
  const coverModels = new Map(
    (
      await prisma.model.findMany({ where: { id: { in: cards.map(firstCover) } }, select: { id: true, name: true } })
    ).map((m) => [m.id, m]),
  );
  return {
    models: models.slice(0, 15).map((m) => ({
      name: m.displayName,
      path: modelPath(m),
      organization: m.organization.displayName,
      released: m.facts.releaseDate?.value,
    })),
    systemCards: cards.flatMap((c) => {
      const m = coverModels.get(firstCover(c));
      return m ? [{ title: cardTitle(c.document), path: cardPath(m, c.document.key, c.document.kind) }] : [];
    }),
    evals: evals
      .filter((e) => has(q, e.displayName, e.slug, e.family, ...e.aliases))
      .slice(0, 15)
      .map((e) => ({
        name: e.displayName,
        path: `/evaluations/${e.slug}`,
        results: e.results,
        description: e.description,
      })),
    organizations: organizations
      .filter((o) => has(q, o.displayName, o.slug, ...o.aliases, ...o.slugAliases))
      .map((o) => ({ name: o.displayName, path: organizationPath(o), models: o.models })),
    methods: [
      ...methods.map((m) => ({ name: m.displayName, path: `/methods/${m.slug}`, summary: m.summary })),
      ...variants.map((v) => ({
        name: `${v.displayName} (a variant of ${v.method.displayName})`,
        path: `/methods/${v.method.slug}/${v.slug}`,
      })),
    ],
    commitments: commitments.map((c) => ({
      name: c.name,
      path: `/organizations/commitments/${c.slug}`,
      summary: c.summary,
    })),
    incidents: incidents.map((i) => ({
      title: i.title,
      date: i.date,
      organization: i.organization.displayName,
      path: `/${i.organization.slug}/incidents/${i.slug}`,
    })),
  };
}

/** What the panel sends about the page: its title, the heading in view, and its visible text. */
export type Screen = { title?: string; section?: string; text?: string };

/** Most characters of page text in the prompt. */
const MAX_SCREEN_CHARS = 16_000;
/** Most document result rows of an eval in the page block: get_eval has the rest. */
const PAGE_RESULTS = 60;

const clean = (s: unknown, max: number) =>
  typeof s === 'string'
    ? s
        .replace(/[\u0000-\u0008\u000b-\u001f]/g, '')
        .slice(0, max)
        .trim()
    : '';

/** Catalog data for the page at `path`, or null. Loaded here, so the client cannot change it. */
async function pageData(path: string): Promise<unknown> {
  // Raw parts: the catalog reads decode them, as they do for the pages.
  const parts = path.split(/[?#]/)[0].split('/').filter(Boolean);
  if (parts[0] === 'evaluations' && parts[1] && parts.length === 2 && parts[1] !== 'known-errors') {
    const data = await evalData(parts[1]);
    return data && { ...data, documentResults: data.documentResults.slice(0, PAGE_RESULTS) };
  }
  if (!parts[0] || TOP_LEVEL_ROUTES.has(parts[0])) return null;
  if (parts.length === 1) return organizationData(parts[0]);
  if (parts.length === 4 && (parts[2] === 'cards' || parts[2] === 'reports'))
    return cardData(parts[0], parts[1], safeDecode(parts[3]));
  if (parts.length !== 2) return null;
  return isSystemCardPath(path) ? systemCardData(parts[0], parts[1]) : modelData(parts[0], parts[1]);
}

/** The page block of the prompt: the page the reader has open, its tours, its data and its text. */
export async function pageContext(path: string, screen: Screen = {}): Promise<string> {
  const lines = [`The reader has this page open: ${path} (kind of page: ${pageKind(path)}).`];
  const title = clean(screen.title, 200);
  const section = clean(screen.section, 200);
  if (title) lines.push(`Page title: ${title}`);
  if (section) lines.push(`Section in view: ${section}`);
  const tours = toursFor(path);
  lines.push(
    tours.length
      ? `Tours that show this kind of page:\n${tours.map((t) => `- ${t.id}: ${t.title}`).join('\n')}`
      : 'No tour shows this kind of page.',
  );
  try {
    const data = await pageData(path);
    if (data) lines.push(`Catalog data for this page, as JSON:\n${compact(data)}`);
  } catch (error) {
    console.error('[ask] page data failed', error);
  }
  const text = clean(screen.text, MAX_SCREEN_CHARS);
  if (!readablePage(path)) {
    lines.push('This page shows eval content, which you do not read. You know only its path and the data above.');
  } else if (text) {
    lines.push(
      `The text of the page as the reader sees it (cut at ${MAX_SCREEN_CHARS} characters):\n<page_text>\n${text}\n</page_text>`,
    );
  }
  return lines.join('\n\n');
}

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
