import { Prisma } from '#prisma';
import type { PdfDocument } from '@/components/pdf-viewer';
import { monthYear } from '@/lib/card-heading';
import { prisma } from '@/lib/db';
import { titleOf, type MeterJudge } from '@/lib/deploymeter';
import { hiddenVersions, newestVersionFirst } from '@/lib/latest-runs';
import { modelModePath } from '@/lib/model-mode';
import { COUNTED_SEVERITIES } from '@/lib/openaudit-card';
import { organizationPath, resolveOrganization, slugKey } from '@/lib/organizations';
import { excludedAttempt } from '@/lib/server/excluded-attempts';
import {
  MODEL_INCLUDE,
  documentFromRow,
  evalFromRow,
  evalResultFromRow,
  evalSampleFromRow,
  evalVersionFromRow,
  modelFromRow,
  organizationFromRow,
  systemCardFromRow,
} from '@/lib/spec/rows';
import type { Document, Eval, EvalResult, EvalVersion, Model, Organization, SystemCard, Topic } from '@openaudit/spec';
import { cache } from 'react';

// Reads for the public catalog pages: organizations, models, documents, system cards and evals.
// Only public evals are listed; private ones need an owner check, which comes with the API.

/** The page path of a model: its name is `<owner>/<repo>`. */
export function modelPath(m: Pick<Model, 'name'>) {
  return `/${m.name.split('/').map(encodeURIComponent).join('/')}`;
}

/** The organizations that the public sees. */
export const SHOWN_ORG = { hidden: false } satisfies Prisma.OrganizationWhereInput;

/** The models that the public sees: not hidden, and not of a hidden organization. */
export const SHOWN_MODEL = { hidden: false, organization: SHOWN_ORG } satisfies Prisma.ModelWhereInput;

/** Lists show models released from this month. Older and undated models are not relevant. */
export const LISTED_FROM = '2024-09';

/** The models that lists show: models released from `LISTED_FROM` that are not base models or
 * quantized copies, and all models with a published OpenAudit. Only `SHOWN_MODEL` models.
 * `isListed` and `model-feed.ts` (in SQL) have the same rule. */
export const LISTED_MODEL = {
  ...SHOWN_MODEL,
  OR: [
    {
      facts: { path: ['releaseDate', 'value'], gte: LISTED_FROM },
      pretrained: false,
      OR: [{ parentRelation: null }, { parentRelation: { not: 'quantized' } }],
    },
    { openAuditCard: { versions: { some: { status: 'published' } } } },
  ],
} satisfies Prisma.ModelWhereInput;

/** `LISTED_MODEL` for a loaded model. `published`: it has a published OpenAudit. */
export const isListed = (m: Pick<Model, 'parentRelation' | 'facts' | 'pretrained'>, published: boolean) =>
  published || (!m.pretrained && m.parentRelation !== 'quantized' && (m.facts.releaseDate?.value ?? '') >= LISTED_FROM);

export type ModelRow = Model & { organization: Organization };

async function withOrganizations(models: Model[]): Promise<ModelRow[]> {
  const ids = [...new Set(models.map((m) => m.organizationId))];
  const orgs = new Map(
    (await prisma.organization.findMany({ where: { id: { in: ids } } })).map((o) => [o.id, organizationFromRow(o)]),
  );
  return models.map((m) => ({ ...m, organization: orgs.get(m.organizationId)! }));
}

/** Newest first by release date; models with no date go last. */
function byRelease(a: Model, b: Model) {
  const da = a.facts.releaseDate?.value ?? '';
  const db = b.facts.releaseDate?.value ?? '';
  return db.localeCompare(da) || a.displayName.localeCompare(b.displayName);
}

/** Each organization with counts: models (as `LISTED_MODEL`), documents, the system cards it
 * published, and its models with an OpenAudit. */
export async function listOrganizations() {
  const [orgs, models, docs, systemCards, openAuditCards] = await Promise.all([
    prisma.organization.findMany({ where: SHOWN_ORG, orderBy: { displayName: 'asc' } }),
    prisma.model.groupBy({ by: ['organizationId'], _count: true, where: LISTED_MODEL }),
    prisma.document.groupBy({ by: ['publisherId'], _count: true }),
    prisma.document.groupBy({ by: ['publisherId'], _count: true, where: { kind: 'system_card' } }),
    prisma.openAuditCard.findMany({
      where: { versions: { some: { status: 'published' } } },
      select: { model: { select: { organizationId: true } } },
    }),
  ]);
  const modelCount = new Map(models.map((m) => [m.organizationId, m._count]));
  const docCount = new Map(docs.map((d) => [d.publisherId, d._count]));
  const systemCardCount = new Map(systemCards.map((d) => [d.publisherId, d._count]));
  const openAuditCardCount = new Map<string, number>();
  for (const c of openAuditCards)
    openAuditCardCount.set(c.model.organizationId, (openAuditCardCount.get(c.model.organizationId) ?? 0) + 1);
  return orgs.map((o) => ({
    ...organizationFromRow(o),
    models: modelCount.get(o.id) ?? 0,
    documents: docCount.get(o.id) ?? 0,
    systemCards: systemCardCount.get(o.id) ?? 0,
    openAuditCards: openAuditCardCount.get(o.id) ?? 0,
  }));
}

/** True when an admin hid the organization. Cached per request. */
export const isHiddenOrganization = cache(
  async (id: string) => !!(await prisma.organization.findUnique({ where: { id }, select: { hidden: true } }))?.hidden,
);

/** True when an admin hid the model or its organization. Cached per request. */
export const isHiddenModel = cache(async (id: string) => {
  const m = await prisma.model.findUnique({
    where: { id },
    select: { hidden: true, organization: { select: { hidden: true } } },
  });
  return !!m && (m.hidden || m.organization.hidden);
});

export const organizationById = cache(async (id: string) => {
  const row = await prisma.organization.findUnique({ where: { id } });
  return row ? organizationFromRow(row) : null;
});

/**
 * The organization that a raw path segment names, by its slug, a slug alias or another letter
 * case. `redirect` is true when the segment is not the slug itself. Cached per request.
 */
export const findOrganization = cache(async (segment: string) => {
  const key = slugKey(segment);
  if (!key) return null;
  const rows = await prisma.organization.findMany({ where: { OR: [{ slug: key }, { slugAliases: { has: key } }] } });
  return resolveOrganization(segment, rows.map(organizationFromRow));
});

/** An organization's page data, by its slug. No hidden models. */
export const getOrganization = cache(async (slug: string) => {
  const row = await prisma.organization.findUnique({ where: { slug } });
  if (!row) return null;
  const [models, documents] = await Promise.all([
    prisma.model.findMany({ where: { organizationId: row.id, hidden: false }, include: MODEL_INCLUDE }),
    prisma.document.findMany({ where: { publisherId: row.id }, orderBy: { publishedDate: 'desc' } }),
  ]);
  return {
    organization: organizationFromRow(row),
    models: models.map(modelFromRow).sort(byRelease),
    documents: documents.map(documentFromRow),
  };
});

/** Only `LISTED_MODEL` models. */
export type ModelFilter = { q?: string; organization?: string; source?: 'hf' | 'api' };

export async function listModels(filter: ModelFilter) {
  const q = filter.q?.trim();
  const rows = await prisma.model.findMany({
    where: {
      ...(filter.source && { source: filter.source }),
      ...LISTED_MODEL,
      ...(filter.organization && { organization: { slug: filter.organization } }),
      ...(q && {
        AND: [
          {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { displayName: { contains: q, mode: 'insensitive' } },
              { family: { contains: q, mode: 'insensitive' } },
              { aliases: { has: q } },
            ],
          },
        ],
      }),
    },
    include: MODEL_INCLUDE,
  });
  return withOrganizations(rows.map(modelFromRow).sort(byRelease));
}

/** Eval counts by model id. `openAudit`: evals with a finished public run, as the OpenAudit Card
 * uses them. `systemCard`: evals with results in a system card. `flagged`: the flagged chats of
 * the newest published OpenAudit card version, from `COUNTED_SEVERITIES`. `deploymeter` and
 * `judges`: as `PUBLISHED_METERS`. */
export const modelEvalCounts = cache(async () => {
  const [runs, reported, flagged, meters] = await Promise.all([
    prisma.$queryRaw<{ id: string; n: number }[]>`
      SELECT "modelId" AS id, count(DISTINCT "evalId")::int AS n FROM eval_run
      WHERE status = 'succeeded' AND visibility = 'public' AND origin <> 'rescore'
      GROUP BY 1`,
    prisma.$queryRaw<{ id: string; n: number }[]>`
      SELECT r."modelId" AS id, count(DISTINCT r."evalId")::int AS n FROM eval_result r
      JOIN document d ON d.id = r."sourceDocumentId"
      WHERE r.origin = 'reported' AND d.kind = 'system_card' AND r."modelId" IS NOT NULL AND r."evalId" IS NOT NULL
      GROUP BY 1`,
    prisma.$queryRaw<{ id: string; n: number }[]>`
      SELECT c."modelId" AS id, count(*)::int AS n
      FROM (
        SELECT DISTINCT ON ("cardId") id, "cardId" FROM openaudit_card_version
        WHERE status = 'published' ORDER BY "cardId", number DESC
      ) v
      JOIN openaudit_card c ON c.id = v."cardId"
      JOIN openaudit_card_snippet s ON s."versionId" = v.id
      JOIN openaudit_snippet sn ON sn.id = s."snippetId"
      WHERE sn.severity = ANY(${COUNTED_SEVERITIES}::text[]) AND NOT ${excludedAttempt(Prisma.sql`sn."attemptId"`)}
      GROUP BY 1`,
    prisma.$queryRaw<{ id: string; meter: number; judges: PublishedJudge[] }[]>(PUBLISHED_METERS),
  ]);
  const byId = (rows: { id: string; n: number }[]) => new Map(rows.map((r) => [r.id, r.n]));
  return {
    openAudit: byId(runs),
    systemCard: byId(reported),
    flagged: byId(flagged),
    deploymeter: new Map(meters.map((r) => [r.id, r.meter])),
    judges: new Map(meters.map((r) => [r.id, meterJudges(r.judges)])),
  };
});

/** A judge as `PUBLISHED_METERS` reads it. `name`: null if the judge is not in the catalog. */
export type PublishedJudge = { id: string; name: string | null; score: number | null };

/** The newest published Deploymeter panel of each model (`id`): its score, and its counted and
 * abstaining judges (as `counts` and `abstains` in lib/deploymeter), the highest score first. */
export const PUBLISHED_METERS = Prisma.sql`
  SELECT DISTINCT ON (p."modelId") p."modelId" AS id, p.meter, j.judges
  FROM deploy_panel p
  CROSS JOIN LATERAL (
    SELECT coalesce(json_agg(json_build_object('id', r.judge, 'name', m."displayName", 'score', r.score)
      ORDER BY r.score DESC NULLS LAST, r.judge), '[]') AS judges
    FROM deploy_review r
    LEFT JOIN LATERAL (SELECT "displayName" FROM model WHERE lower(name) = lower(r.judge) LIMIT 1) m ON true
    WHERE r."panelId" = p.id AND (r.score IS NOT NULL OR r.abstain) AND NOT r."sameLab" AND NOT r.self
  ) j
  WHERE p.status = 'published' AND p.meter IS NOT NULL
  ORDER BY p."modelId", p.number DESC`;

export const meterJudges = (judges: PublishedJudge[]): MeterJudge[] =>
  judges.map((j) => ({ name: j.name ?? titleOf(j.id), score: j.score }));

/**
 * Only the model row for a path, in one query, so that callers can start other reads early. A
 * name can be both an HF repo and an API model; the HF repo wins. Cached per request.
 */
export const findModel = cache(async (owner: string, repo: string) => {
  const name = `${decodeURIComponent(owner)}/${decodeURIComponent(repo)}`;
  const rows = await prisma.model.findMany({ where: { name }, include: MODEL_INCLUDE });
  const row = rows.find((r) => r.source === 'hf') ?? rows[0];
  return row ? modelFromRow(row) : null;
});

/** The model with a path's name as an alias (an old name, or a copy of its weights), to redirect to. */
export const findModelByAlias = cache(async (owner: string, repo: string) => {
  const name = `${decodeURIComponent(owner)}/${decodeURIComponent(repo)}`;
  const row = await prisma.model.findFirst({ where: { aliases: { has: name } }, include: MODEL_INCLUDE });
  return row ? modelFromRow(row) : null;
});

/**
 * A model by its path, with its organization, lineage and documents.
 * Cached per request: the page and its breadcrumbs both read it.
 */
export const getModel = cache(async (owner: string, repo: string) => {
  const model = await findModel(owner, repo);
  if (!model) return null;
  const [organization, parent, children, documents] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: model.organizationId } }).then(organizationFromRow),
    model.parentId
      ? prisma.model
          .findUnique({ where: { id: model.parentId }, include: MODEL_INCLUDE })
          .then((r) => r && modelFromRow(r))
      : null,
    prisma.model
      .findMany({ where: { parentId: model.id, hidden: false }, include: MODEL_INCLUDE })
      .then((rs) => rs.map(modelFromRow)),
    prisma.document.findMany({ where: { id: { in: model.documentIds } } }).then((rs) => rs.map(documentFromRow)),
  ]);
  documents.sort((a, b) => (b.publishedDate ?? '').localeCompare(a.publishedDate ?? ''));
  return { model, organization, parent, children: children.sort(byRelease), documents };
});

/**
 * The page path of our summary of one document. The document key names it. System cards are
 * under /cards and other kinds under /reports; /cards sends other kinds on.
 */
export function cardPath(m: Pick<Model, 'name'>, documentKey: string, kind?: string) {
  const dir = kind && kind !== 'system_card' ? 'reports' : 'cards';
  return `${modelPath(m)}/${dir}/${encodeURIComponent(documentKey)}`;
}

/** The model page in System Card mode: all its system cards as one. */
export function systemCardPath(m: Pick<Model, 'name'>) {
  return modelModePath(modelPath(m), 'system-card');
}

export type CardView = SystemCard & { document: Document; results: EvalResult[]; resultCount: number };

/**
 * The cards about a model: cards that cover it, cards on its documents, and for a quantized
 * copy, its base's cards. `results` and `riskDecisions` have only this model's items.
 * `documentKey` picks one card.
 */
export async function cardsForModel(
  model: Model,
  { results: withResults = true, documentKey }: { results?: boolean; documentKey?: string } = {},
): Promise<CardView[]> {
  const ids = [model.id, ...(model.parentRelation === 'quantized' && model.parentId ? [model.parentId] : [])];
  const docIds = model.documentIds;
  const rows = await prisma.systemCard.findMany({
    where: {
      OR: [{ modelIds: { hasSome: ids } }, { documentId: { in: docIds } }, { alsoDocumentIds: { hasSome: docIds } }],
      ...(documentKey && { document: { key: documentKey } }),
    },
    include: { document: { include: { _count: { select: { results: true } } } } },
  });
  const cards = rows.map((c) => ({
    ...systemCardFromRow(c),
    document: documentFromRow(c.document),
    resultCount: c.document._count.results,
    results: [] as EvalResult[],
  }));
  return (withResults ? await cardsWithResults(model, cards) : cards)
    .map((c) => ({
      ...c,
      riskDecisions: c.riskDecisions.filter((r) => !r.modelIds || r.modelIds.some((id) => ids.includes(id))),
    }))
    .sort((a, b) => (b.document.publishedDate ?? '').localeCompare(a.document.publishedDate ?? ''));
}

/** `cards` with the results each reports for the model (or its quantized base). */
export async function cardsWithResults(
  model: Pick<Model, 'id' | 'parentRelation' | 'parentId'>,
  cards: CardView[],
): Promise<CardView[]> {
  const ids = [model.id, ...(model.parentRelation === 'quantized' && model.parentId ? [model.parentId] : [])];
  const rows = await prisma.evalResult.findMany({
    where: { sourceDocumentId: { in: cards.map((c) => c.documentId) }, modelId: { in: ids } },
    orderBy: [{ rawEvalName: 'asc' }, { metric: 'asc' }],
  });
  const all = rows.map(evalResultFromRow);
  return cards.map((c) => ({ ...c, results: all.filter((r) => r.source?.documentId === c.documentId) }));
}

/** Our summary of one document, for its page. `key` is the raw path segment. */
export async function summaryFor(owner: string, repo: string, key: string) {
  const found = await getModel(owner, repo);
  if (!found) return null;
  const [card] = await cardsForModel(found.model, { documentKey: decodeURIComponent(key) });
  return card ? { model: found.model, card } : null;
}

/** A summary page's title; the model name is added when the document title lacks it. */
export function summaryTitle(model: Model, document: Document) {
  const name = model.displayName;
  return document.title.includes(name) ? cardTitle(document) : `${cardTitle(document)}: ${name}`;
}

/** A model's system cards, not its other summaries, newest first. */
export async function systemCardsFor(model: Model, options: { results?: boolean } = {}) {
  return (await cardsForModel(model, options)).filter((c) => c.document.kind === 'system_card');
}

/** Names for the model ids a card covers, for its "covers" line. */
export async function modelsByIds(ids: string[]) {
  const rows = await prisma.model.findMany({ where: { id: { in: ids } }, include: MODEL_INCLUDE });
  return new Map(rows.map((r) => [r.id, modelFromRow(r)]));
}

/** Slugs, names, descriptions, topics and access for the public evals among some eval ids.
 * `description`: the short summary, else the long description. */
export async function evalsByIds(ids: string[]) {
  const rows = await prisma.eval.findMany({
    where: { id: { in: ids }, visibility: 'public' },
    select: { id: true, slug: true, displayName: true, summary: true, description: true, topics: true, access: true },
  });
  return new Map(
    rows.map(({ summary, ...r }) => [
      r.id,
      { ...r, description: summary || r.description, topics: r.topics as Topic[] },
    ]),
  );
}

export type EvalFilter = Partial<Record<'topic' | 'subject' | 'measure' | 'grading' | 'access', string>>;

export async function listEvals(filter: EvalFilter) {
  const rows = await prisma.eval.findMany({
    where: {
      visibility: 'public',
      ...(filter.topic && { topics: { has: filter.topic } }),
      ...(filter.subject && { subjects: { has: filter.subject } }),
      ...(filter.measure && { measures: { has: filter.measure } }),
      ...(filter.grading && { grading: { has: filter.grading } }),
      ...(filter.access && { access: filter.access }),
    },
    orderBy: { displayName: 'asc' },
    include: { _count: { select: { results: { where: { origin: 'reported' } } } } },
  });
  return rows.map((r) => ({ ...evalFromRow(r), results: r._count.results }));
}

/** A public or unlisted eval, with its versions newest first. An unlisted eval opens by link only.
 * A version whose runs are all private is left out (`hiddenVersions`). */
export const getEval = cache(async (slug: string) => {
  const row = await prisma.eval.findFirst({ where: { slug, visibility: { in: ['public', 'unlisted'] } } });
  if (!row) return null;
  const [rows, runs] = await Promise.all([
    prisma.evalVersion.findMany({ where: { evalId: row.id } }),
    prisma.evalRun.groupBy({ by: ['evalVersionId', 'visibility'], where: { evalVersion: { evalId: row.id } } }),
  ]);
  const hidden = hiddenVersions(runs);
  const versions = rows
    .filter((v) => !hidden.has(v.id))
    .map(evalVersionFromRow)
    .sort(newestVersionFirst);
  return { eval: evalFromRow(row), versions };
});

/** The public evals that test `subject` (`model`), for the breadcrumb menu. */
export const evalLinksFor = cache(async (subject: string) =>
  (
    await prisma.eval.findMany({
      where: { visibility: 'public', subjects: { has: subject } },
      orderBy: { displayName: 'asc' },
      select: { slug: true, displayName: true },
    })
  ).map((e) => ({ label: e.displayName, href: `/evaluations/${e.slug}` })),
);

/** All organizations, for the breadcrumb menu. */
export const organizationLinks = cache(async () =>
  (
    await prisma.organization.findMany({
      where: SHOWN_ORG,
      orderBy: { displayName: 'asc' },
      select: { slug: true, displayName: true },
    })
  ).map((o) => ({ label: o.displayName, href: organizationPath(o) })),
);

/** An organization's `LISTED_MODEL` models, newest first, for the breadcrumb menu. */
/** `released`: the release date, for `byOpenAuditThenRelease`. */
export async function modelLinks(organizationId: string) {
  const rows = await prisma.model.findMany({
    where: { organizationId, ...LISTED_MODEL },
    include: MODEL_INCLUDE,
  });
  const links = rows
    .map(modelFromRow)
    .sort(byRelease)
    .map((m) => ({ id: m.id, label: m.displayName, href: modelPath(m), released: m.facts.releaseDate?.value }));
  // An HF repo and an API model can share a name, and so a path.
  return links.filter((l, i) => links.findIndex((x) => x.href === l.href) === i);
}

export async function documentByKey(key: string) {
  return prisma.document.findUnique({ where: { key }, select: { title: true, publishedDate: true, kind: true } });
}

/** A card's title with its month and year: "System Card: Claude Opus 5.5 (Sept 2026)". */
export function cardTitle(d: { title: string; publishedDate?: string | null }) {
  const date = monthYear(d.publishedDate);
  return date ? `${d.title} (${date})` : d.title;
}

/** Our saved copy of a document, for the PDF viewer. Only for a saved PDF. */
export function savedPdf(d: Document | undefined): PdfDocument | undefined {
  if (d?.fileType !== 'pdf') return undefined;
  return { url: savedCopyUrl(d)!, title: d.title, originalUrl: d.url };
}

/** The URL of our saved copy (app/files/documents), when there is one. */
export function savedCopyUrl(d: Pick<Document, 'fileKey'>) {
  return d.fileKey ? `/files/${d.fileKey}` : undefined;
}

export type EvalResultView = EvalResult & { model?: Model; document?: Document };

/** An eval's reported results, newest document first, with their models and source documents.
 * None of hidden models. */
export async function resultsForEval(evalId: string): Promise<EvalResultView[]> {
  const rows = await prisma.evalResult.findMany({
    where: { evalId, origin: 'reported', OR: [{ modelId: null }, { model: { hidden: false } }] },
    include: {
      model: { include: MODEL_INCLUDE },
      sourceDocument: true,
    },
  });
  return rows
    .map((r) => ({
      ...evalResultFromRow(r),
      model: r.model ? modelFromRow(r.model) : undefined,
      document: r.sourceDocument ? documentFromRow(r.sourceDocument) : undefined,
    }))
    .sort(
      (a, b) =>
        (b.document?.publishedDate ?? '').localeCompare(a.document?.publishedDate ?? '') ||
        (a.model?.displayName ?? a.rawModelName ?? '').localeCompare(b.model?.displayName ?? b.rawModelName ?? '') ||
        a.metric.localeCompare(b.metric),
    );
}

export const SAMPLES_PER_PAGE = 20;

export async function getSamples(version: EvalVersion, split: string, page: number) {
  const where = { evalVersionId: version.id, split };
  const [rows, total] = await Promise.all([
    prisma.evalSample.findMany({
      where,
      orderBy: { sourceId: 'asc' },
      skip: (page - 1) * SAMPLES_PER_PAGE,
      take: SAMPLES_PER_PAGE,
    }),
    prisma.evalSample.count({ where }),
  ]);
  return { samples: rows.map(evalSampleFromRow), total };
}

export type { Eval };
