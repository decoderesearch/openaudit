// Maps spec records (spec/schemas) to database rows and back. The spec leaves out an unset field;
// the database stores null.
import { Prisma } from '#prisma';
import { modelReleased } from '@/lib/release-dates';
import type {
  AttemptStatus,
  CardCover,
  Commitment,
  CommitmentCategory,
  CommitmentEventKind,
  CommitmentState,
  DatePrecision,
  DepartureKind,
  Direction,
  Disclosures,
  DisplayRule,
  Document,
  DocumentKind,
  Eval,
  EvalAccess,
  EvalAttempt,
  EvalDataset,
  EvalFacets,
  EvalLink,
  EvalMaintainer,
  EvalResult,
  EvalRun,
  EvalRunner,
  EvalSample,
  EvalStatus,
  EvalSuite,
  EvalVersion,
  EvalVersionStatus,
  ExpertQuote,
  ExpertStance,
  ExternalTester,
  Finding,
  Hazard,
  IncidentCategory,
  IncidentPrimaryCategory,
  IncidentSeverity,
  IncidentStatus,
  Method,
  MethodAccess,
  MethodArtifact,
  MethodArtifactFile,
  MethodCompare,
  MethodEvalSetup,
  MethodExpertView,
  MethodGroup,
  MethodMatch,
  MethodParam,
  MethodPrompt,
  MethodResult,
  MethodSite,
  MethodVariant,
  MetricDef,
  Model,
  ModelFacts,
  ModelSource,
  OrgCommitment,
  OrgCommitmentEvent,
  OrgDeparture,
  OrgIncident,
  OrgIncidentEvent,
  OrgSource,
  Organization,
  ParentRelation,
  RecommendedModel,
  ResultOrigin,
  ResultSettings,
  RiskDecision,
  RunOrigin,
  RunProvenance,
  RunSettings,
  RunStatus,
  SampleTerms,
  ScoreDef,
  ServingRoute,
  SystemCard,
  TokenUsage,
  TopicCoverage,
  Visibility,
} from '@openaudit/spec';

type OrganizationRow = Prisma.OrganizationGetPayload<object>;
type DocumentRow = Prisma.DocumentGetPayload<object>;
type ModelRow = Prisma.ModelGetPayload<{ include: { documents: { select: { documentId: true } } } }>;
type EvalRow = Prisma.EvalGetPayload<object>;
type EvalSuiteRow = Prisma.EvalSuiteGetPayload<object>;
type EvalVersionRow = Prisma.EvalVersionGetPayload<object>;
type EvalSampleRow = Prisma.EvalSampleGetPayload<object>;
type SystemCardRow = Prisma.SystemCardGetPayload<object>;
type EvalResultRow = Prisma.EvalResultGetPayload<object>;
type EvalRunRow = Prisma.EvalRunGetPayload<object>;
type EvalAttemptRow = Prisma.EvalAttemptGetPayload<object>;
type OrgIncidentRow = Prisma.OrgIncidentGetPayload<object>;
type OrgIncidentEventRow = Prisma.OrgIncidentEventGetPayload<object>;
type OrgDepartureRow = Prisma.OrgDepartureGetPayload<object>;
type CommitmentRow = Prisma.CommitmentGetPayload<object>;
type OrgCommitmentRow = Prisma.OrgCommitmentGetPayload<object>;
type OrgCommitmentEventRow = Prisma.OrgCommitmentEventGetPayload<object>;
type MethodRow = Prisma.MethodGetPayload<object>;
type MethodVariantRow = Prisma.MethodVariantGetPayload<object>;
type MethodExpertViewRow = Prisma.MethodExpertViewGetPayload<object>;
type MethodArtifactRow = Prisma.MethodArtifactGetPayload<object>;
type MethodResultRow = Prisma.MethodResultGetPayload<object>;

/** Include this when reading a model, so `modelFromRow` gets its document ids. */
export const MODEL_INCLUDE = { documents: { select: { documentId: true } } } as const;

/** Spec objects have no index signature, so JSON columns cast through `unknown`. */
const toJson = (value: unknown) => value as Prisma.InputJsonValue;
const fromJson = <T>(value: Prisma.JsonValue) => value as unknown as T;

/** Drops null values, so optional spec fields are left out. */
function present<T extends Record<string, unknown>>(obj: T) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined)) as {
    [K in keyof T]?: NonNullable<T[K]>;
  };
}

export function organizationToRow(o: Organization): Prisma.OrganizationUncheckedCreateInput {
  return {
    id: o.id,
    slug: o.slug,
    displayName: o.displayName,
    aliases: o.aliases,
    slugAliases: o.slugAliases,
    website: o.website ?? null,
    summary: o.summary ?? null,
    researchedAt: o.researchedAt ? new Date(`${o.researchedAt}T00:00:00Z`) : null,
    researchDepth: o.researchDepth ?? null,
  };
}

export function organizationFromRow(r: OrganizationRow): Organization {
  return {
    id: r.id,
    slug: r.slug,
    displayName: r.displayName,
    aliases: r.aliases,
    slugAliases: r.slugAliases,
    ...present({
      website: r.website,
      summary: r.summary,
      researchedAt: r.researchedAt?.toISOString().slice(0, 10),
      researchDepth: r.researchDepth as Organization['researchDepth'] | null,
    }),
  };
}

export function documentToRow(d: Document): Prisma.DocumentUncheckedCreateInput {
  return {
    id: d.id,
    key: d.key,
    kind: d.kind,
    title: d.title,
    url: d.url,
    publisherId: d.publisherId,
    publishedDate: d.publishedDate ?? null,
    fileUrl: d.fileUrl ?? null,
    fileKey: d.fileKey ?? null,
    fileType: d.fileType ?? null,
    sha256: d.sha256 ?? null,
    fetchedAt: d.fetchedAt ? new Date(d.fetchedAt) : null,
    verified: d.verified,
    notes: d.notes ?? null,
  };
}

export function documentFromRow(r: DocumentRow): Document {
  return {
    id: r.id,
    key: r.key,
    kind: r.kind as DocumentKind,
    title: r.title,
    url: r.url,
    publisherId: r.publisherId,
    verified: r.verified,
    ...present({
      publishedDate: r.publishedDate,
      fileUrl: r.fileUrl,
      fileKey: r.fileKey,
      fileType: r.fileType as Document['fileType'] | null,
      sha256: r.sha256,
      fetchedAt: r.fetchedAt?.toISOString(),
      notes: r.notes,
    }),
  };
}

export function modelToRow(m: Model): Prisma.ModelUncheckedCreateInput {
  return {
    id: m.id,
    source: m.source,
    name: m.name,
    displayName: m.displayName,
    organizationId: m.organizationId,
    family: m.family ?? null,
    revision: m.revision ?? null,
    aliases: m.aliases,
    parentId: m.parentId ?? null,
    parentRelation: m.parentRelation ?? null,
    removedFromHub: m.removedFromHub ?? false,
    pretrained: m.pretrained ?? false,
    facts: m.facts as Prisma.InputJsonObject,
    releaseDate: modelReleased(m.facts),
    documents: { create: m.documentIds.map((documentId) => ({ documentId })) },
  };
}

export function modelFromRow(r: ModelRow): Model {
  return {
    id: r.id,
    source: r.source as ModelSource,
    name: r.name,
    displayName: r.displayName,
    organizationId: r.organizationId,
    aliases: r.aliases,
    facts: r.facts as ModelFacts,
    documentIds: r.documents.map((d) => d.documentId).sort(),
    ...present({
      family: r.family,
      revision: r.revision,
      parentId: r.parentId,
      parentRelation: r.parentRelation as ParentRelation | null,
      removedFromHub: r.removedFromHub || null,
      pretrained: r.pretrained || null,
    }),
  };
}

export function evalToRow(e: Eval): Prisma.EvalUncheckedCreateInput {
  const f = e.facets;
  return {
    id: e.id,
    slug: e.slug,
    displayName: e.displayName,
    aliases: e.aliases,
    description: e.description ?? null,
    summary: e.summary ?? null,
    family: e.family ?? null,
    suiteId: e.suiteId ?? null,
    maintainers: toJson(e.maintainers),
    links: toJson(e.links),
    access: e.access,
    status: e.status,
    saturatedReason: e.saturatedReason ?? null,
    saturatedDecisionDate: e.saturatedDecisionDate ?? null,
    legacyReason: e.legacyReason ?? null,
    legacyDecisionDate: e.legacyDecisionDate ?? null,
    supersededBy: e.supersededBy ?? null,
    autoApprove: e.autoApprove ?? false,
    measures: f.measures,
    formats: f.formats,
    cases: f.cases,
    grading: f.grading,
    adversarial: f.adversarial,
    humanParticipants: f.humanParticipants,
    subjects: f.subjects,
    topics: f.topics,
    canary: e.canary ?? null,
    recommendedModels: toJson(e.recommendedModels ?? []),
    ownerUserId: e.ownerUserId ?? null,
    visibility: e.visibility,
  };
}

export function evalFromRow(r: EvalRow): Eval {
  return {
    id: r.id,
    slug: r.slug,
    displayName: r.displayName,
    aliases: r.aliases,
    maintainers: fromJson<EvalMaintainer[]>(r.maintainers),
    links: fromJson<EvalLink[]>(r.links),
    access: r.access as EvalAccess,
    status: r.status as EvalStatus,
    facets: {
      measures: r.measures as EvalFacets['measures'],
      formats: r.formats as EvalFacets['formats'],
      cases: r.cases as EvalFacets['cases'],
      grading: r.grading as EvalFacets['grading'],
      adversarial: r.adversarial,
      humanParticipants: r.humanParticipants,
      subjects: r.subjects as EvalFacets['subjects'],
      topics: r.topics as EvalFacets['topics'],
    },
    visibility: r.visibility as Visibility,
    ...present({
      description: r.description,
      summary: r.summary,
      family: r.family,
      suiteId: r.suiteId,
      saturatedReason: r.saturatedReason,
      saturatedDecisionDate: r.saturatedDecisionDate,
      legacyReason: r.legacyReason,
      legacyDecisionDate: r.legacyDecisionDate,
      supersededBy: r.supersededBy,
      autoApprove: r.autoApprove || null,
      recommendedModels: fromJson<RecommendedModel[]>(r.recommendedModels).length
        ? fromJson<RecommendedModel[]>(r.recommendedModels)
        : null,
      canary: r.canary,
      ownerUserId: r.ownerUserId,
    }),
  };
}

export function evalSuiteToRow(s: EvalSuite): Prisma.EvalSuiteUncheckedCreateInput {
  return {
    id: s.id,
    slug: s.slug,
    displayName: s.displayName,
    summary: s.summary,
    description: s.description ?? null,
    maintainers: toJson(s.maintainers),
    links: toJson(s.links),
    evalOrder: s.evalOrder ?? [],
    matched: s.matched ? toJson(s.matched) : Prisma.DbNull,
  };
}

export function evalSuiteFromRow(r: EvalSuiteRow): EvalSuite {
  return {
    id: r.id,
    slug: r.slug,
    displayName: r.displayName,
    summary: r.summary,
    maintainers: fromJson<EvalMaintainer[]>(r.maintainers),
    links: fromJson<EvalLink[]>(r.links),
    ...(r.evalOrder.length && { evalOrder: r.evalOrder }),
    ...present({ description: r.description, matched: r.matched as MethodMatch | null }),
  };
}

/** `publishedAt` is not in the spec; a published version gets it here. */
export function evalVersionToRow(v: EvalVersion, publishedAt = new Date()): Prisma.EvalVersionUncheckedCreateInput {
  return {
    id: v.id,
    evalId: v.evalId,
    version: v.version,
    status: v.status,
    publishedAt: v.status === 'published' ? publishedAt : null,
    releasedDate: v.releasedDate ?? null,
    changes: v.changes ?? null,
    dataset: v.dataset ? toJson(v.dataset) : Prisma.DbNull,
    scores: toJson(v.scores),
    metrics: toJson(v.metrics),
    runner: v.runner ? toJson(v.runner) : Prisma.DbNull,
    sampleTerms: v.sampleTerms ? toJson(v.sampleTerms) : Prisma.DbNull,
    methodSetup: v.methodSetup ? toJson(v.methodSetup) : Prisma.DbNull,
  };
}

export function evalVersionFromRow(r: EvalVersionRow): EvalVersion {
  return {
    id: r.id,
    evalId: r.evalId,
    version: r.version,
    status: r.status as EvalVersionStatus,
    scores: fromJson<ScoreDef[]>(r.scores),
    metrics: fromJson<MetricDef[]>(r.metrics),
    ...present({
      releasedDate: r.releasedDate,
      changes: r.changes,
      dataset: r.dataset === null ? null : fromJson<EvalDataset>(r.dataset),
      runner: r.runner === null ? null : fromJson<EvalRunner>(r.runner),
      sampleTerms: r.sampleTerms === null ? null : fromJson<SampleTerms>(r.sampleTerms),
      methodSetup: r.methodSetup === null ? null : fromJson<MethodEvalSetup>(r.methodSetup),
    }),
  };
}

/** `choices` is a column; the spec leaves it out when a sample has none. */
export function evalSampleToRow(s: EvalSample): Prisma.EvalSampleUncheckedCreateInput {
  return {
    id: s.id,
    evalVersionId: s.evalVersionId,
    split: s.split,
    sourceId: s.sourceId,
    input: s.input === undefined ? Prisma.DbNull : toJson(s.input),
    target: s.target === undefined ? Prisma.DbNull : toJson(s.target),
    choices: s.choices ?? [],
    metadata: toJson(s.metadata),
    sha256: s.sha256,
  };
}

export function evalSampleFromRow(r: EvalSampleRow): EvalSample {
  return {
    id: r.id,
    evalVersionId: r.evalVersionId,
    split: r.split,
    sourceId: r.sourceId,
    metadata: fromJson<EvalSample['metadata']>(r.metadata),
    sha256: r.sha256,
    ...present({
      input: r.input === null ? null : fromJson<EvalSample['input']>(r.input),
      target: r.target === null ? null : fromJson<EvalSample['target']>(r.target),
      choices: r.choices.length ? r.choices : null,
    }),
  };
}

export function systemCardToRow(c: SystemCard): Prisma.SystemCardUncheckedCreateInput {
  return {
    id: c.id,
    documentId: c.documentId,
    alsoDocumentIds: c.alsoDocumentIds,
    covers: toJson(c.covers),
    modelIds: c.covers.flatMap((cover) => (cover.modelId ? [cover.modelId as string] : [])),
    basedOnDocumentId: c.basedOnDocumentId ?? null,
    pageCount: c.pageCount ?? null,
    disclosures: toJson(c.disclosures),
    riskDecisions: toJson(c.riskDecisions),
    topics: toJson(c.topics),
    testers: toJson(c.testers),
    findings: toJson(c.findings),
    reviewed: c.reviewed,
    extractionBy: c.extraction.by,
    extractionAt: new Date(c.extraction.at),
  };
}

export function systemCardFromRow(r: SystemCardRow): SystemCard {
  return {
    id: r.id,
    documentId: r.documentId,
    alsoDocumentIds: r.alsoDocumentIds,
    covers: fromJson<CardCover[]>(r.covers),
    disclosures: fromJson<Disclosures>(r.disclosures),
    riskDecisions: fromJson<RiskDecision[]>(r.riskDecisions),
    topics: fromJson<TopicCoverage[]>(r.topics),
    testers: fromJson<ExternalTester[]>(r.testers),
    findings: fromJson<Finding[]>(r.findings),
    reviewed: r.reviewed,
    extraction: { by: r.extractionBy, at: r.extractionAt.toISOString() },
    ...present({ basedOnDocumentId: r.basedOnDocumentId, pageCount: r.pageCount }),
  };
}

export function evalResultToRow(e: EvalResult): Prisma.EvalResultUncheckedCreateInput {
  return {
    id: e.id,
    origin: e.origin,
    evalId: e.evalId ?? null,
    evalVersionId: e.evalVersionId ?? null,
    rawEvalName: e.rawEvalName ?? null,
    modelId: (e.modelId as string | undefined) ?? null,
    rawModelName: (e.rawModelName as string | undefined) ?? null,
    metric: e.metric,
    value: e.value,
    unit: e.unit ?? null,
    stderr: e.stderr ?? null,
    ciLow: e.ciLow ?? null,
    ciHigh: e.ciHigh ?? null,
    n: e.n ?? null,
    safetyDirection: e.safetyDirection ?? null,
    capabilityDirection: e.capabilityDirection ?? null,
    settings: toJson(e.settings),
    sourceDocumentId: e.source?.documentId ?? null,
    sourcePage: e.source?.page ?? null,
    sourcePdfPage: e.source?.pdfPage ?? null,
    sourceTable: e.source?.table ?? null,
    sourceQuote: e.source?.quote ?? null,
    evalRunId: e.evalRunId ?? null,
    reviewed: e.reviewed,
    extractionBy: e.extraction?.by ?? null,
    extractionAt: e.extraction ? new Date(e.extraction.at) : null,
  };
}

export function evalResultFromRow(r: EvalResultRow): EvalResult {
  return {
    id: r.id,
    origin: r.origin as ResultOrigin,
    metric: r.metric,
    value: r.value,
    settings: fromJson<ResultSettings>(r.settings),
    reviewed: r.reviewed,
    ...present({
      evalId: r.evalId,
      evalVersionId: r.evalVersionId,
      rawEvalName: r.rawEvalName,
      modelId: r.modelId,
      rawModelName: r.rawModelName,
      unit: r.unit as EvalResult['unit'] | null,
      stderr: r.stderr,
      ciLow: r.ciLow,
      ciHigh: r.ciHigh,
      n: r.n,
      safetyDirection: r.safetyDirection as Direction | null,
      capabilityDirection: r.capabilityDirection as Direction | null,
      source: r.sourceDocumentId
        ? {
            documentId: r.sourceDocumentId,
            ...present({
              page: r.sourcePage,
              pdfPage: r.sourcePdfPage,
              table: r.sourceTable,
              quote: r.sourceQuote,
            }),
          }
        : null,
      evalRunId: r.evalRunId,
      extraction: r.extractionBy && r.extractionAt ? { by: r.extractionBy, at: r.extractionAt.toISOString() } : null,
    }),
  } as EvalResult;
}

export function evalRunToRow(r: EvalRun): Prisma.EvalRunUncheckedCreateInput {
  return {
    id: r.id,
    evalId: r.evalId,
    evalVersionId: r.evalVersionId,
    modelId: r.modelId,
    origin: r.origin,
    sourceRunId: r.sourceRunId ?? null,
    status: r.status,
    route: toJson(r.route),
    settings: toJson(r.settings),
    provenance: toJson(r.provenance ?? {}),
    logKey: r.log?.key ?? null,
    logBytes: r.log?.bytes ?? null,
    logSha256: r.log?.sha256 ?? null,
    sampleCount: r.sampleCount ?? null,
    attemptCount: r.attemptCount ?? 0,
    error: r.error ?? null,
    visibility: r.visibility,
    createdAt: new Date(r.createdAt),
  };
}

export function evalRunFromRow(r: EvalRunRow): EvalRun {
  const provenance = fromJson<RunProvenance>(r.provenance);
  return {
    id: r.id,
    evalId: r.evalId,
    evalVersionId: r.evalVersionId,
    modelId: r.modelId,
    origin: r.origin as RunOrigin,
    status: r.status as RunStatus,
    route: fromJson<ServingRoute>(r.route),
    settings: fromJson<RunSettings>(r.settings),
    visibility: r.visibility as Visibility,
    createdAt: r.createdAt.toISOString(),
    ...present({
      sourceRunId: r.sourceRunId,
      provenance: Object.keys(provenance).length ? provenance : null,
      log: r.logKey ? { key: r.logKey, bytes: r.logBytes ?? 0, ...present({ sha256: r.logSha256 }) } : null,
      sampleCount: r.sampleCount,
      attemptCount: r.attemptCount || null,
      error: r.error,
    }),
  };
}

export function evalAttemptToRow(a: EvalAttempt): Prisma.EvalAttemptUncheckedCreateInput {
  return {
    id: a.id,
    runId: a.runId,
    ordinal: a.ordinal,
    sampleId: a.sampleId,
    evalSampleId: a.evalSampleId ?? null,
    epoch: a.epoch,
    status: a.status,
    passed: a.passed ?? null,
    input: a.input ?? null,
    target: a.target === undefined ? Prisma.DbNull : toJson(a.target),
    choices: a.choices ?? [],
    output: a.output ?? null,
    scores: toJson(a.scores),
    metrics: a.metrics ?? [],
    error: a.error ?? null,
    notScored: a.notScored ?? null,
    tokens: toJson(a.tokens ?? {}),
    seconds: a.seconds ?? null,
    display: a.display ?? null,
    hazard: a.hazard ?? null,
    bodyKey: a.body?.key ?? null,
    bodyBytes: a.body?.bytes ?? null,
  };
}

export function evalAttemptFromRow(r: EvalAttemptRow): EvalAttempt {
  const tokens = fromJson<TokenUsage>(r.tokens);
  return {
    id: r.id,
    runId: r.runId,
    ordinal: r.ordinal,
    sampleId: r.sampleId,
    epoch: r.epoch,
    status: r.status as AttemptStatus,
    scores: fromJson<EvalAttempt['scores']>(r.scores),
    ...present({
      evalSampleId: r.evalSampleId,
      passed: r.passed,
      input: r.input,
      target: r.target === null ? null : fromJson<string | string[]>(r.target),
      choices: r.choices.length ? r.choices : null,
      output: r.output,
      metrics: r.metrics.length ? r.metrics : null,
      error: r.error,
      notScored: r.notScored,
      tokens: Object.keys(tokens).length ? tokens : null,
      seconds: r.seconds,
      display: r.display as DisplayRule | null,
      hazard: r.hazard as Hazard | null,
      body: r.bodyKey ? { key: r.bodyKey, bytes: r.bodyBytes ?? 0 } : null,
    }),
  };
}

export function orgIncidentToRow(i: OrgIncident): Prisma.OrgIncidentUncheckedCreateInput {
  return {
    id: i.id,
    organizationId: i.organizationId,
    slug: i.slug,
    title: i.title,
    date: i.date,
    datePrecision: i.datePrecision,
    endDate: i.endDate ?? null,
    severity: i.severity,
    status: i.status,
    primaryCategory: i.primaryCategory,
    categories: i.categories,
    summary: i.summary,
    description: i.description,
    modelIds: i.modelIds ?? [],
    sources: toJson(i.sources),
    logs: toJson(i.logs ?? []),
  };
}

/** A row with no `logs` (lists omit them) gives an incident with no `logs`. */
export function orgIncidentFromRow(r: Omit<OrgIncidentRow, 'logs'> & { logs?: OrgIncidentRow['logs'] }): OrgIncident {
  const logs = r.logs === undefined ? [] : fromJson<NonNullable<OrgIncident['logs']>>(r.logs);
  return {
    id: r.id,
    organizationId: r.organizationId,
    slug: r.slug,
    title: r.title,
    date: r.date,
    datePrecision: r.datePrecision as DatePrecision,
    severity: r.severity as IncidentSeverity,
    status: r.status as IncidentStatus,
    primaryCategory: r.primaryCategory as IncidentPrimaryCategory,
    categories: r.categories as [IncidentCategory, ...IncidentCategory[]],
    summary: r.summary,
    description: r.description,
    ...(r.modelIds.length > 0 && { modelIds: r.modelIds }),
    sources: fromJson<OrgIncident['sources']>(r.sources),
    ...(logs.length > 0 && { logs }),
    ...present({ endDate: r.endDate }),
  };
}

export function orgIncidentEventToRow(e: OrgIncidentEvent): Prisma.OrgIncidentEventUncheckedCreateInput {
  return {
    id: e.id,
    incidentId: e.incidentId,
    order: e.order,
    date: e.date,
    datePrecision: e.datePrecision,
    title: e.title,
    description: e.description ?? null,
    sources: toJson(e.sources),
  };
}

export function orgIncidentEventFromRow(r: OrgIncidentEventRow): OrgIncidentEvent {
  return {
    id: r.id,
    incidentId: r.incidentId,
    order: r.order,
    date: r.date,
    datePrecision: r.datePrecision as DatePrecision,
    title: r.title,
    sources: fromJson<OrgSource[]>(r.sources),
    ...present({ description: r.description }),
  };
}

export function orgDepartureToRow(d: OrgDeparture): Prisma.OrgDepartureUncheckedCreateInput {
  return {
    id: d.id,
    organizationId: d.organizationId,
    name: d.name,
    title: d.title ?? null,
    departedDate: d.departedDate ?? null,
    datePrecision: d.datePrecision ?? null,
    kind: d.kind,
    reason: d.reason ?? null,
    quoteText: d.quote?.text ?? null,
    quoteUrl: d.quote?.url ?? null,
    imageUrl: d.image?.url ?? null,
    imagePageUrl: d.image?.pageUrl ?? null,
    imageLicense: d.image?.license ?? null,
    imageAuthor: d.image?.author ?? null,
    website: d.website ?? null,
    nextRole: d.nextRole ?? null,
    sources: toJson(d.sources),
  };
}

export function orgDepartureFromRow(r: OrgDepartureRow): OrgDeparture {
  return {
    id: r.id,
    organizationId: r.organizationId,
    name: r.name,
    kind: r.kind as DepartureKind,
    sources: fromJson<OrgDeparture['sources']>(r.sources),
    ...present({
      title: r.title,
      departedDate: r.departedDate,
      datePrecision: r.datePrecision as DatePrecision | null,
      reason: r.reason,
      quote: r.quoteText && r.quoteUrl ? { text: r.quoteText, url: r.quoteUrl } : null,
      image:
        r.imageUrl && r.imagePageUrl && r.imageLicense && r.imageAuthor
          ? { url: r.imageUrl, pageUrl: r.imagePageUrl, license: r.imageLicense, author: r.imageAuthor }
          : null,
      website: r.website,
      nextRole: r.nextRole,
    }),
  };
}

export function commitmentToRow(c: Commitment): Prisma.CommitmentUncheckedCreateInput {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    category: c.category,
    order: c.order,
    summary: c.summary,
    description: c.description,
    criteria: toJson(c.criteria),
  };
}

export function commitmentFromRow(r: CommitmentRow): Commitment {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    category: r.category as CommitmentCategory,
    order: r.order,
    summary: r.summary,
    description: r.description,
    criteria: fromJson<Commitment['criteria']>(r.criteria),
  };
}

export function orgCommitmentToRow(x: OrgCommitment): Prisma.OrgCommitmentUncheckedCreateInput {
  return {
    id: x.id,
    organizationId: x.organizationId,
    commitmentId: x.commitmentId,
    checkedAt: new Date(`${x.checkedAt}T00:00:00Z`),
    checkedBy: x.checkedBy ?? null,
    summary: x.summary ?? null,
    state: toJson(x.state),
  };
}

export function orgCommitmentFromRow(r: OrgCommitmentRow): OrgCommitment {
  return {
    id: r.id,
    organizationId: r.organizationId,
    commitmentId: r.commitmentId,
    checkedAt: r.checkedAt.toISOString().slice(0, 10),
    state: fromJson<CommitmentState>(r.state),
    ...present({ checkedBy: r.checkedBy, summary: r.summary }),
  };
}

export function orgCommitmentEventToRow(e: OrgCommitmentEvent): Prisma.OrgCommitmentEventUncheckedCreateInput {
  return {
    id: e.id,
    orgCommitmentId: e.orgCommitmentId,
    order: e.order,
    date: e.date,
    datePrecision: e.datePrecision,
    kind: e.kind,
    title: e.title,
    summary: e.summary ?? null,
    quoteText: e.quote?.text ?? null,
    quoteUrl: e.quote?.url ?? null,
    agreement: e.agreement ?? null,
    sources: toJson(e.sources),
    state: toJson(e.state),
  };
}

export function orgCommitmentEventFromRow(r: OrgCommitmentEventRow): OrgCommitmentEvent {
  return {
    id: r.id,
    orgCommitmentId: r.orgCommitmentId,
    order: r.order,
    date: r.date,
    datePrecision: r.datePrecision as DatePrecision,
    kind: r.kind as CommitmentEventKind,
    title: r.title,
    sources: fromJson<OrgCommitmentEvent['sources']>(r.sources),
    state: fromJson<CommitmentState>(r.state),
    ...present({
      summary: r.summary,
      quote: r.quoteText && r.quoteUrl ? { text: r.quoteText, url: r.quoteUrl } : null,
      agreement: r.agreement,
    }),
  };
}

export function methodToRow(m: Method): Prisma.MethodUncheckedCreateInput {
  return {
    id: m.id,
    slug: m.slug,
    displayName: m.displayName,
    group: m.group,
    summary: m.summary,
    tagline: m.tagline ?? null,
    safetyUse: m.safetyUse,
    caveats: m.caveats,
    params: toJson(m.params),
    compare: toJson(m.compare),
    expertSummary: m.expertSummary ?? null,
    links: toJson(m.links),
  };
}

export function methodFromRow(r: MethodRow): Method {
  return {
    id: r.id,
    slug: r.slug,
    displayName: r.displayName,
    group: r.group as MethodGroup,
    summary: r.summary,
    safetyUse: r.safetyUse,
    caveats: r.caveats,
    params: fromJson<MethodParam[]>(r.params),
    compare: fromJson<MethodCompare>(r.compare),
    links: fromJson<EvalLink[]>(r.links),
    ...present({ tagline: r.tagline, expertSummary: r.expertSummary }),
  };
}

export function methodVariantToRow(v: MethodVariant): Prisma.MethodVariantUncheckedCreateInput {
  return {
    id: v.id,
    methodId: v.methodId,
    slug: v.slug,
    displayName: v.displayName,
    aliases: v.aliases,
    summary: v.summary ?? null,
    access: v.access,
    baseline: v.baseline,
    componentIds: v.componentIds,
    supersedesId: v.supersedesId ?? null,
    params: toJson(v.params),
    links: toJson(v.links),
    prompts: toJson(v.prompts ?? []),
    visibility: v.visibility ?? 'public',
  };
}

export function methodVariantFromRow(r: MethodVariantRow): MethodVariant {
  const prompts = fromJson<MethodPrompt[]>(r.prompts);
  return {
    id: r.id,
    methodId: r.methodId,
    slug: r.slug,
    displayName: r.displayName,
    aliases: r.aliases,
    access: r.access as MethodAccess,
    baseline: r.baseline,
    componentIds: r.componentIds,
    params: fromJson<MethodParam[]>(r.params),
    links: fromJson<EvalLink[]>(r.links),
    ...(prompts.length > 0 && { prompts }),
    ...present({
      summary: r.summary,
      supersedesId: r.supersedesId,
    }),
    ...(r.visibility !== 'public' && { visibility: r.visibility as Visibility }),
  };
}

export function methodExpertViewToRow(v: MethodExpertView): Prisma.MethodExpertViewUncheckedCreateInput {
  return {
    id: v.id,
    methodId: v.methodId,
    slug: v.slug,
    variantIds: v.variantIds,
    title: v.title,
    byline: v.byline,
    organization: v.organization ?? null,
    publishedDate: v.publishedDate,
    stance: v.stance,
    summary: v.summary,
    points: v.points,
    quotes: toJson(v.quotes),
    sources: toJson(v.sources),
    checkedDate: v.checkedDate,
  };
}

export function methodExpertViewFromRow(r: MethodExpertViewRow): MethodExpertView {
  return {
    id: r.id,
    methodId: r.methodId,
    slug: r.slug,
    variantIds: r.variantIds,
    title: r.title,
    byline: r.byline,
    publishedDate: r.publishedDate,
    stance: r.stance as ExpertStance,
    summary: r.summary,
    points: r.points,
    quotes: fromJson<ExpertQuote[]>(r.quotes),
    sources: fromJson<MethodExpertView['sources']>(r.sources),
    checkedDate: r.checkedDate,
    ...present({ organization: r.organization }),
  };
}

export function methodArtifactToRow(a: MethodArtifact): Prisma.MethodArtifactUncheckedCreateInput {
  return {
    id: a.id,
    key: a.key,
    variantId: a.variantId,
    displayName: a.displayName,
    subject: a.subject,
    modelId: a.modelId ?? null,
    revision: a.revision ?? null,
    sites: toJson(a.sites),
    params: toJson(a.params),
    license: a.license ?? null,
    sourceUrl: a.sourceUrl ?? null,
    files: toJson(a.files ?? []),
  };
}

export function methodArtifactFromRow(r: MethodArtifactRow): MethodArtifact {
  const files = fromJson<MethodArtifactFile[]>(r.files);
  return {
    id: r.id,
    key: r.key,
    variantId: r.variantId,
    displayName: r.displayName,
    subject: r.subject,
    sites: fromJson<MethodSite[]>(r.sites),
    params: fromJson<MethodArtifact['params']>(r.params),
    ...present({ modelId: r.modelId, revision: r.revision, license: r.license, sourceUrl: r.sourceUrl }),
    ...(files.length > 0 && { files }),
  };
}

export function methodResultToRow(x: MethodResult): Prisma.MethodResultUncheckedCreateInput {
  return {
    id: x.id,
    artifactId: x.artifactId,
    evalVersionId: x.evalVersionId,
    metric: x.metric,
    value: x.value,
    stderr: x.stderr ?? null,
    n: x.n ?? null,
    sourceUrl: x.sourceUrl,
    sourceTable: x.sourceTable ?? null,
    sourceCommit: x.sourceCommit ?? null,
    measuredAt: x.measuredAt ? new Date(x.measuredAt) : null,
  };
}

export function methodResultFromRow(r: MethodResultRow): MethodResult {
  return {
    id: r.id,
    artifactId: r.artifactId,
    evalVersionId: r.evalVersionId,
    metric: r.metric,
    value: r.value,
    sourceUrl: r.sourceUrl,
    ...present({
      stderr: r.stderr,
      n: r.n,
      sourceTable: r.sourceTable,
      sourceCommit: r.sourceCommit,
      measuredAt: r.measuredAt?.toISOString(),
    }),
  };
}
