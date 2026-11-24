// Imports the seed data into the database. Without --apply, it only prints what would change.
//
//   node scripts/with-env.mjs [--test] tsx scripts/import-seed.ts [--apply] [--only <parts>]
//
// Parts, in order: organizations, documents, models, research, commitments, evals, samples, methods,
// cards. Inputs (repo root):
//   data/seed/system_cards.json         organizations, models and documents
//   data/seed/orgs/*.json               organization research: profile, incidents, departures
//                                       (scripts/org-research.ts)
//   data/seed/commitments/*.json        one safety commitment with each organization's timeline
//                                       (scripts/commitments.ts)
//   data/seed/hf_snapshot.json          Hub facts and parent tags (data/scripts/fetch-hf.mjs)
//   data/seed/eval-suites/*.json        one eval suite per file
//   data/seed/evals/*.json              one eval with its versions per file; a top-level
//                                       `recommendedModels` goes on the eval; `suite` is a slug
//   data/cache/samples/<slug>@<version>.jsonl  samples (data/scripts/samples-<slug>.mjs)
//   data/seed/methods/*.json            one method with its variants and expert views
//   data/extracted/methods/*.json       artifacts and results (data/scripts/fetch-*.mjs)
//   data/extracted/system-cards/*.json  card extractions (spec/scripts/check-extraction.mjs)
//   data/extracted/result-directions.jsonl  result directions (spec/scripts/result-directions.mjs)
//
// Records are matched by their natural key (slug, key, source and name, document), so a second
// run changes nothing. An organization also matches by a slug alias, so a new slug renames it. Rows that are not in the seed are listed, not deleted.
// Research rows, commitments and method expert views are the exception: rows that left their file are deleted.
import { Prisma, PrismaClient } from '#prisma';
import { newId } from '@/lib/ids';
import { groupValue } from '@/lib/methods';
import { LADDERS } from '@/lib/model-ladders';
import { OWNER_ROUTES } from '@/lib/model-links';
import {
  MODEL_INCLUDE,
  commitmentFromRow,
  commitmentToRow,
  documentFromRow,
  documentToRow,
  evalFromRow,
  evalResultFromRow,
  evalResultToRow,
  evalSampleFromRow,
  evalSampleToRow,
  evalSuiteFromRow,
  evalSuiteToRow,
  evalToRow,
  evalVersionFromRow,
  evalVersionToRow,
  methodArtifactFromRow,
  methodArtifactToRow,
  methodExpertViewFromRow,
  methodExpertViewToRow,
  methodFromRow,
  methodResultFromRow,
  methodResultToRow,
  methodToRow,
  methodVariantFromRow,
  methodVariantToRow,
  modelFromRow,
  modelToRow,
  orgCommitmentEventFromRow,
  orgCommitmentEventToRow,
  orgCommitmentFromRow,
  orgCommitmentToRow,
  orgDepartureFromRow,
  orgDepartureToRow,
  orgIncidentEventFromRow,
  orgIncidentEventToRow,
  orgIncidentFromRow,
  orgIncidentToRow,
  organizationFromRow,
  organizationToRow,
  systemCardFromRow,
  systemCardToRow,
} from '@/lib/spec/rows';
import type {
  CardCover,
  Commitment,
  Direction,
  Document,
  Eval,
  EvalResult,
  EvalSample,
  EvalSuite,
  EvalVersion,
  Method,
  MethodArtifact,
  MethodExpertView,
  MethodParam,
  MethodResult,
  MethodVariant,
  Model,
  ModelFacts,
  OrgCommitment,
  OrgCommitmentEvent,
  OrgDeparture,
  OrgIncident,
  OrgIncidentEvent,
  Organization,
  RecommendedModel,
  RiskDecision,
  SystemCard,
} from '@openaudit/spec';
import schema from '@openaudit/spec/schema.json' with { type: 'json' };
import { PrismaPg } from '@prisma/adapter-pg';
import addFormats from 'ajv-formats';
import Ajv2020 from 'ajv/dist/2020.js';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { crossProblems, parseCommitment, type CommitmentFile } from './commitments';
import { parseResearch, researchOrganization, type Research } from './org-research';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const PARTS = [
  'organizations',
  'documents',
  'models',
  'research',
  'commitments',
  'evals',
  'samples',
  'methods',
  'cards',
] as const;
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : [...PARTS];
const run = (part: (typeof PARTS)[number]) => only.includes(part);

const readJson = <T>(...path: string[]): T => JSON.parse(readFileSync(join(ROOT, ...path), 'utf8'));
const jsonFiles = (...path: string[]) =>
  existsSync(join(ROOT, ...path))
    ? readdirSync(join(ROOT, ...path))
        .filter((f) => f.endsWith('.json'))
        .sort()
    : [];

// --- Inputs --------------------------------------------------------------------------------------

type SeedModel = {
  id: string;
  source: 'hf' | 'api';
  displayName: string;
  organizationId: string;
  family?: string;
  releaseDate?: string;
  documents: string[];
  checkpoints: string[];
  apiIds: string[];
  removedFromHub?: boolean;
};
type SeedDocument = Omit<Document, 'id' | 'publisherId'> & { publisherId: string };
type Seed = {
  organizations: { id: string; displayName: string; aliases: string[]; slugAliases: string[] }[];
  models: SeedModel[];
  documents: SeedDocument[];
};
type HubRepo = {
  status: number;
  createdAt?: string;
  parents?: { relation: 'quantized' | 'adapter' | 'finetune' | 'merge'; parent: string }[];
  license?: string;
  totalParams?: number;
  contextWindow?: number;
  architecture?: string;
};
type Extraction = {
  document: string;
  alsoDocuments: string[];
  covers: { model?: string; rawModelName?: string; section?: string }[];
  basedOn?: string;
  fileUrl?: string;
  pageCount?: number;
  disclosures: SystemCard['disclosures'];
  riskDecisions: (Omit<RiskDecision, 'modelIds'> & { models?: [string, ...string[]] })[];
  topics: SystemCard['topics'];
  testers: SystemCard['testers'];
  findings: SystemCard['findings'];
  evalResults: {
    rawEvalName: string;
    model?: string;
    rawModelName?: string;
    metric: string;
    value: number;
    unit?: EvalResult['unit'];
    stderr?: number;
    ciLow?: number;
    ciHigh?: number;
    n?: number;
    settings?: EvalResult['settings'];
    source: { page?: string; pdfPage?: number; table?: string; quote?: string };
  }[];
  extraction: SystemCard['extraction'];
};
type SeedEval = {
  eval: Omit<Eval, 'id' | 'suiteId'> & { suite?: string };
  versions: Omit<EvalVersion, 'id' | 'evalId'>[];
  recommendedModels?: RecommendedModel[];
};
type Directions = { safety: Direction | 'unknown'; capability: Direction | 'unknown' };
type DirectionEntry = Directions & { key: string; bySetting?: Record<string, Directions> };

const seed = readJson<Seed>('data', 'seed', 'system_cards.json');
const hub = readJson<{ repos: Record<string, HubRepo> }>('data', 'seed', 'hf_snapshot.json').repos;

// --- Checks and diffs ----------------------------------------------------------------------------

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats.default(ajv);
ajv.addSchema(schema);
function assertValid(type: string, record: unknown, label: string) {
  const check = ajv.getSchema(`${schema.$id}#/$defs/${type}`)!;
  if (!check(record)) throw new Error(`${type} ${label} is not valid: ${ajv.errorsText(check.errors)}`);
}
function specErrors(type: string, record: unknown) {
  const check = ajv.getSchema(`${schema.$id}#/$defs/${type}`)!;
  return check(record) ? null : ajv.errorsText(check.errors);
}

type Plan<T> = { label: string; create: T[]; update: T[]; same: number; extra: string[] };
function plan<T extends { id: string }>(
  label: string,
  wanted: T[],
  existing: Map<string, T>,
  keyOf: (r: T) => string,
): Plan<T> {
  const p: Plan<T> = { label, create: [], update: [], same: 0, extra: [] };
  const seen = new Set<string>();
  for (const r of wanted) {
    const key = keyOf(r);
    seen.add(key);
    const old = existing.get(key);
    if (!old) p.create.push(r);
    else if (isDeepStrictEqual(old, r)) p.same++;
    else p.update.push(r);
  }
  for (const key of existing.keys()) if (!seen.has(key)) p.extra.push(key);
  return p;
}
function report<T>(p: Plan<T>, show: (r: T) => string) {
  console.log(
    `${p.label}: ${p.create.length} to create, ${p.update.length} to update, ${p.same} unchanged` +
      (p.extra.length ? `, ${p.extra.length} in the database only` : ''),
  );
  for (const r of p.create.slice(0, 3)) console.log(`  + ${show(r)}`);
  for (const r of p.update.slice(0, 3)) console.log(`  ~ ${show(r)}`);
  for (const k of p.extra.slice(0, 3)) console.log(`  ? ${k}`);
}

/** What a published eval version must keep: all but its runner, change note, dataset license,
 * safety directions, score names and pass rules. */
function fixedPart({ runner: _, changes: _c, metrics, scores, dataset, methodSetup, ...v }: EvalVersion) {
  const { license: _l, ...data } = dataset ?? {};
  // The core subjects only rank the variants; they do not change the eval.
  const { coreSubjects: _core, ...setup } = methodSetup ?? {};
  return {
    ...v,
    ...(methodSetup && { methodSetup: setup }),
    dataset: dataset && data,
    scores: scores.map(({ attemptName: _n, attemptScale: _x, displayName: _d, pass: _p, ...s }) => s),
    metrics: metrics.map(({ safetyDirection: _s, displayName: _d, ...m }) => m),
  };
}

/** Sort arrays whose order has no meaning, so a diff does not see a change. */
const sorted = (xs: string[]) => [...xs].sort();
/** JSON with sorted keys, to compare records built in different ways. */
const canonical = (value: unknown): string =>
  Array.isArray(value)
    ? `[${value.map(canonical).join(',')}]`
    : value && typeof value === 'object'
      ? `{${Object.keys(value)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
          .join(',')}}`
      : JSON.stringify(value);

// --- Models: parents from Hub tags ---------------------------------------------------------------

const QUANT = /[-_.](fp8|fp4|nvfp4|mxfp4|int4|int8|gptq|awq|w4a16|w4a4|w8a8|w8a16|bnb|4bit|8bit|gguf|mlx|exl2)/i;
const QUANT_SUFFIX =
  /([-_.](fp8|fp4|nvfp4|mxfp4|int4|int8|gptq|awq|w4a16|w4a4|w8a8|w8a16|bnb|4bit|8bit|gguf|mlx|exl2|dynamic|block))+$/i;

/**
 * The parent of an HF repo, when the parent is also in the seed. Hub tags are not always right:
 * `quantized` counts only when the repo name has a quantization marker (else it is a finetune),
 * and the same name without the marker wins over the tag. Merges are not parents. A parent
 * that is a copy (`copyOf`) is its original.
 */
function parentOf(
  repo: string,
  names: Set<string>,
  copyOf: Map<string, string>,
): { relation: Model['parentRelation']; parent: string } | undefined {
  const tags = (hub[repo]?.parents ?? [])
    .map((p) => ({ ...p, parent: copyOf.get(p.parent) ?? p.parent }))
    .filter((p) => p.relation !== 'merge' && p.parent !== repo && names.has(p.parent));
  if (QUANT.test(repo.split('/')[1])) {
    const stripped = repo.replace(QUANT_SUFFIX, '');
    const base = copyOf.get(stripped) ?? stripped;
    if (base !== repo && names.has(base)) return { relation: 'quantized', parent: base };
    const tagged = tags.find((p) => p.relation === 'quantized');
    if (tagged) return { relation: 'quantized', parent: tagged.parent };
  }
  const [first] = tags;
  if (!first || first.relation === 'merge') return undefined;
  return { relation: first.relation === 'quantized' ? 'finetune' : first.relation, parent: first.parent };
}

function hubFacts(repo: string): ModelFacts {
  const h = hub[repo];
  if (h?.status !== 200) return {};
  const source = { kind: 'hf_config' as const, url: `https://huggingface.co/${repo}` };
  const facts: ModelFacts = {};
  if (h.license) facts.license = { value: h.license, source };
  if (h.totalParams) facts.totalParams = { value: h.totalParams, source };
  if (h.contextWindow) facts.contextWindow = { value: h.contextWindow, source };
  if (h.architecture) facts.architecture = { value: h.architecture, source };
  return facts;
}

/** The Hub gives this creation time to repos made before 2022, so it is not a real date. */
const HUB_PLACEHOLDER_CREATED = '2022-03-02T23:29';
/** A Hub repo is often made this many days before its release, in private. */
const SAME_RELEASE_DAYS = 60;

/**
 * A checkpoint's release date. A Hub creation date near its seed model's date is the same
 * release, so the seed model's date wins; a date far from it is a separate release.
 */
function checkpointRelease(repo: string, seedDate: ModelFacts['releaseDate']): ModelFacts['releaseDate'] {
  const created = hub[repo]?.createdAt;
  if (!created || created.startsWith(HUB_PLACEHOLDER_CREATED)) return seedDate;
  const own = {
    value: created.slice(0, 10),
    source: { kind: 'hf_config' as const, url: `https://huggingface.co/${repo}` },
  };
  if (!seedDate) return own;
  const days = Math.abs(Date.parse(created) - Date.parse(seedDate.value)) / 86_400_000;
  return days <= SAME_RELEASE_DAYS ? seedDate : own;
}

/** A base model by its name: `-Base`, `-Pretrain`, or Google's `-pt` (Baidu's `-PT` is PyTorch). */
const BASE_NAME = /[-_](base|pretrain(ed)?)([-_.]|$)/i;
const GOOGLE_PT = /^google\/.*-pt([-_]\d+)?$/i;
const TUNED_SUFFIXES = ['-instruct', '-it', '-chat'];

/**
 * True for a base model with no instruct or chat tuning: by its name, or when the same name with
 * an instruct suffix is also a model (`Qwen2.5-7B` and `Qwen2.5-7B-Instruct`). A name with no
 * suffix is not enough: from Qwen3 on, the chat model has no suffix and the base has `-Base`.
 */
function isPretrained(d: { name: string; parentRelation?: string | null }, hfNames: Set<string>) {
  if (BASE_NAME.test(d.name.split('/')[1]!) || GOOGLE_PT.test(d.name)) return true;
  if (d.parentRelation === 'finetune' || d.parentRelation === 'adapter') return false;
  const [, stem, tail = ''] = d.name.toLowerCase().match(/^(.*?)(-original)?$/)!;
  return TUNED_SUFFIXES.some((s) => hfNames.has(`${stem}${s}${tail}`));
}

/** A repo name without its owner, case and `-hf` suffix: the same key is the same weights. */
const copyKey = (repo: string) => repo.split('/')[1]!.toLowerCase().replace(/-hf$/, '');

/**
 * Checkpoints with the same weights as another repo of their seed model (another format or
 * owner), to that repo: the seed model, else the repo in its namespace. A copy gets no row;
 * its name is an alias of that repo.
 */
function copiesOf(models: SeedModel[]): Map<string, string> {
  const seedIds = new Set(models.map((m) => m.id));
  const copyOf = new Map<string, string>();
  for (const m of models.filter((s) => s.source === 'hf')) {
    const owner = `${m.id.split('/')[0]}/`;
    for (const repos of Map.groupBy([m.id, ...m.checkpoints], copyKey).values()) {
      const canon = repos.includes(m.id) ? m.id : (repos.find((r) => r.startsWith(owner)) ?? repos[0]!);
      for (const r of repos) if (r !== canon && !seedIds.has(r) && !copyOf.has(r)) copyOf.set(r, canon);
    }
  }
  const original = (r: string): string => (copyOf.has(r) ? original(copyOf.get(r)!) : r);
  return new Map([...copyOf.keys()].map((r) => [r, original(r)]));
}

// --- Main ----------------------------------------------------------------------------------------

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

/**
 * Moves a copy's results, card and incident links and child models to its original, then
 * deletes the copy. Stops if the copy has runs, an OpenAudit or deploy data.
 */
async function mergeModel(from: Model, to: string) {
  const held = await Promise.all([
    prisma.evalRun.count({ where: { modelId: from.id } }),
    prisma.openAuditCard.count({ where: { modelId: from.id } }),
    prisma.methodArtifact.count({ where: { modelId: from.id } }),
    prisma.deployPacket.count({ where: { modelId: from.id } }),
    prisma.deployPanel.count({ where: { modelId: from.id } }),
    prisma.deployHumanReview.count({ where: { modelId: from.id } }),
  ]);
  if (held.some(Boolean))
    throw new Error(`${from.name} has runs, an OpenAudit, method artifacts or deploy data. Merge it by hand.`);
  const swap = Prisma.sql`ARRAY(SELECT DISTINCT unnest(array_replace("modelIds", ${from.id}::uuid, ${to}::uuid)))`;
  await prisma.$transaction([
    prisma.evalResult.updateMany({ where: { modelId: from.id }, data: { modelId: to } }),
    prisma.$executeRaw`UPDATE system_card SET "modelIds" = ${swap},
      covers = replace(covers::text, ${from.id}, ${to})::jsonb,
      "riskDecisions" = replace("riskDecisions"::text, ${from.id}, ${to})::jsonb
      WHERE ${from.id}::uuid = ANY("modelIds") OR "riskDecisions"::text LIKE ${`%${from.id}%`}`,
    prisma.$executeRaw`UPDATE org_incident SET "modelIds" = ${swap} WHERE ${from.id}::uuid = ANY("modelIds")`,
    prisma.model.updateMany({ where: { parentId: from.id }, data: { parentId: to } }),
    prisma.model.delete({ where: { id: from.id } }),
  ]);
}

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? 'postgres://unset').host;
  console.log(`${APPLY ? 'Applying to' : 'Dry run against'} ${host}. Parts: ${only.join(', ')}\n`);

  // Organizations
  const orgRows = (await prisma.organization.findMany()).map(organizationFromRow);
  const orgById = new Map(orgRows.map((o) => [o.id, o]));
  const orgBySlug = new Map(orgRows.map((o) => [o.slug, o]));
  const organizations: Organization[] = seed.organizations.map((o) => ({
    id: (orgBySlug.get(o.id) ?? o.slugAliases.map((a) => orgBySlug.get(a)).find(Boolean))?.id ?? newId(),
    slug: o.id,
    displayName: o.displayName,
    aliases: o.aliases,
    slugAliases: o.slugAliases,
  }));
  // Research files use the slug of their time, so a file matches by a slug alias too. An
  // organization whose file has a problem keeps what it has in the database.
  const research = new Map<string, Research>();
  const broken = new Set<string>();
  const researchProblems: string[] = [];
  const seedNames = new Set(seed.models.flatMap((m) => [m.id, ...m.checkpoints]));
  for (const file of jsonFiles('data', 'seed', 'orgs')) {
    const label = `data/seed/orgs/${file}`;
    const parsed = parseResearch(readFileSync(join(ROOT, 'data', 'seed', 'orgs', file), 'utf8'), label, specErrors);
    for (const n of parsed.notes) console.log(`  note: ${n}`);
    for (const i of parsed.research?.incidents ?? [])
      for (const m of i.models.filter((name) => !seedNames.has(name)))
        parsed.problems.push(`${label}: incident ${i.slug}: model ${m} is not in data/seed/system_cards.json`);
    if (parsed.problems.length) delete parsed.research;
    const slugs = [file.replace(/\.json$/, ''), ...(parsed.research ? [parsed.research.slug] : [])];
    const org = researchOrganization(slugs, organizations);
    if (!org) {
      researchProblems.push(`${label}: no organization has the slug or slug alias ${slugs.join(' or ')}`);
      continue;
    }
    if (!parsed.research || research.has(org.id) || broken.has(org.id)) {
      researchProblems.push(...parsed.problems);
      if (parsed.research) researchProblems.push(`${label}: a second file for ${org.slug}`);
      broken.add(org.id);
      research.delete(org.id);
      continue;
    }
    research.set(org.id, parsed.research);
  }
  for (const o of organizations) {
    const old = orgById.get(o.id);
    const profile = broken.has(o.id)
      ? old && {
          website: old.website,
          summary: old.summary,
          researchedAt: old.researchedAt,
          researchDepth: old.researchDepth,
        }
      : research.get(o.id)?.profile;
    for (const [k, v] of Object.entries(profile ?? {})) if (v !== undefined) Object.assign(o, { [k]: v });
  }

  const orgId = new Map(organizations.map((o) => [o.slug, o.id]));
  const allSlugs = organizations.flatMap((o) => [o.slug, ...o.slugAliases]);
  const twice = allSlugs.filter((x, i) => allSlugs.indexOf(x) !== i);
  if (twice.length) throw new Error(`Organization slugs used twice: ${twice.join(', ')}`);
  if (run('organizations')) {
    organizations.forEach((o) => assertValid('Organization', o, o.slug));
    const p = plan('Organizations', organizations, orgById, (o) => o.id);
    report(p, (o) => {
      const old = orgById.get(o.id);
      return old && old.slug !== o.slug ? `${old.slug} -> ${o.slug}` : o.slug;
    });
    if (APPLY) {
      await prisma.organization.createMany({ data: p.create.map(organizationToRow) });
      for (const o of p.update) await prisma.organization.update({ where: { id: o.id }, data: organizationToRow(o) });
    }
  }

  // Documents
  const docRows = (await prisma.document.findMany()).map(documentFromRow);
  const docByKey = new Map(docRows.map((d) => [d.key, d]));
  const documents: Document[] = seed.documents.map((d) => {
    const old = docByKey.get(d.key);
    return {
      id: old?.id ?? newId(),
      key: d.key,
      kind: d.kind,
      title: d.title,
      url: d.url,
      publisherId: orgId.get(d.publisherId)!,
      verified: d.verified,
      ...(d.publishedDate && { publishedDate: d.publishedDate }),
      ...(d.notes && { notes: d.notes }),
      // The saved copy comes from scripts/mirror-documents.ts, not the seed.
      ...(old?.fileUrl && { fileUrl: old.fileUrl }),
      ...(old?.fileKey && { fileKey: old.fileKey }),
      ...(old?.fileType && { fileType: old.fileType }),
      ...(old?.sha256 && { sha256: old.sha256 }),
      ...(old?.fetchedAt && { fetchedAt: old.fetchedAt }),
    };
  });
  const docId = new Map(documents.map((d) => [d.key, d.id]));
  const docDate = new Map(documents.map((d) => [d.key, d.publishedDate]));
  if (run('documents')) {
    documents.forEach((d) => assertValid('Document', d, d.key));
    const p = plan('Documents', documents, docByKey, (d) => d.key);
    report(p, (d) => d.key);
    if (APPLY) {
      await prisma.document.createMany({ data: p.create.map(documentToRow) });
      for (const d of p.update) await prisma.document.update({ where: { id: d.id }, data: documentToRow(d) });
    }
  }

  // Models: each seed model, then each checkpoint that is not a seed model itself.
  const modelRows = (await prisma.model.findMany({ include: MODEL_INCLUDE })).map(modelFromRow);
  const modelKey = (m: { source: string; name: string }) => `${m.source}:${m.name}`;
  const modelByKey = new Map(modelRows.map((m) => [modelKey(m), m]));
  type Draft = Omit<Model, 'id' | 'parentId'> & { parentName?: string };
  const drafts = new Map<string, Draft>();
  for (const m of seed.models) {
    const linked = m.documents.find((k) => docDate.get(k) === m.releaseDate);
    const releaseDate = m.releaseDate
      ? {
          value: m.releaseDate,
          source: linked ? { kind: 'document' as const, documentId: docId.get(linked)! } : { kind: 'manual' as const },
        }
      : undefined;
    drafts.set(modelKey({ source: m.source, name: m.id }), {
      source: m.source,
      name: m.id,
      displayName: m.displayName,
      organizationId: orgId.get(m.organizationId)!,
      aliases: m.apiIds,
      facts: { ...(m.source === 'hf' ? hubFacts(m.id) : {}), ...(releaseDate && { releaseDate }) },
      documentIds: sorted(m.documents.map((k) => docId.get(k)!)),
      ...(m.family && { family: m.family }),
      ...((m.removedFromHub || (m.source === 'hf' && hub[m.id]?.status === 404)) && { removedFromHub: true }),
    });
  }
  const copyOf = copiesOf(seed.models);
  for (const m of seed.models) {
    const seedDate = drafts.get(modelKey({ source: m.source, name: m.id }))!.facts.releaseDate;
    for (const repo of m.checkpoints) {
      const key = modelKey({ source: 'hf', name: repo });
      if (drafts.has(key) || copyOf.has(repo)) continue;
      const releaseDate = checkpointRelease(repo, seedDate);
      drafts.set(key, {
        source: 'hf',
        name: repo,
        displayName: repo.split('/')[1],
        organizationId: orgId.get(m.organizationId)!,
        aliases: [],
        facts: { ...hubFacts(repo), ...(releaseDate && { releaseDate }) },
        documentIds: sorted(m.documents.map((k) => docId.get(k)!)),
        ...(m.family && { family: m.family }),
        ...(hub[repo]?.status === 404 && { removedFromHub: true }),
      });
    }
  }
  for (const [copy, original] of copyOf) {
    const d = drafts.get(`hf:${original}`)!;
    d.aliases = [...d.aliases, copy];
  }
  const hfNames = new Set([...drafts.values()].filter((d) => d.source === 'hf').map((d) => d.name));
  for (const d of drafts.values()) {
    if (d.source !== 'hf') continue;
    const p = parentOf(d.name, hfNames, copyOf);
    if (p) Object.assign(d, { parentName: p.parent, parentRelation: p.relation });
  }
  // Drop a parent that would make a loop.
  for (const d of drafts.values()) {
    const seen = new Set([d.name]);
    for (let cur = d.parentName; cur; cur = drafts.get(`hf:${cur}`)?.parentName) {
      if (seen.has(cur)) {
        console.log(`  parent loop at ${d.name}; no parent`);
        delete d.parentName;
        delete d.parentRelation;
        break;
      }
      seen.add(cur);
    }
  }
  const hfLower = new Set([...hfNames].map((n) => n.toLowerCase()));
  for (const d of drafts.values()) if (d.source === 'hf' && isPretrained(d, hfLower)) d.pretrained = true;
  const idOfModel = new Map<string, string>();
  for (const key of drafts.keys()) idOfModel.set(key, modelByKey.get(key)?.id ?? newId());
  const models: Model[] = [...drafts].map(([key, d]) => {
    const { parentName, ...rest } = d;
    return { id: idOfModel.get(key)!, ...rest, ...(parentName && { parentId: idOfModel.get(`hf:${parentName}`)! }) };
  });
  // Seed model ids, as extraction files write them, to database ids.
  const seedModelId = new Map<string, string>();
  for (const m of seed.models) seedModelId.set(m.id, idOfModel.get(modelKey({ source: m.source, name: m.id }))!);
  for (const [key, id] of idOfModel)
    if (key.startsWith('hf:') && !seedModelId.has(key.slice(3))) seedModelId.set(key.slice(3), id);
  for (const [copy, original] of copyOf) seedModelId.set(copy, idOfModel.get(`hf:${original}`)!);
  // Rows of copies, to merge into their originals.
  const merges = modelRows
    .filter((m) => m.source === 'hf' && copyOf.has(m.name))
    .map((m) => ({ from: m, to: idOfModel.get(`hf:${copyOf.get(m.name)}`)! }));

  if (run('models')) {
    models.forEach((m) => assertValid('Model', m, m.name));
    const clash = models.filter((m) => OWNER_ROUTES.has(m.name.split('/')[1]?.toLowerCase() ?? ''));
    if (clash.length)
      throw new Error(
        `Model names that clash with organization pages (/<org>/${[...OWNER_ROUTES].join('|')}): ${clash.map((m) => m.name)}`,
      );
    const p = plan('Models', models, modelByKey, modelKey);
    report(
      p,
      (m) =>
        `${m.source}:${m.name}${m.parentRelation ? ` (${m.parentRelation} of ${drafts.get(`hf:${m.name}`)?.parentName})` : ''}`,
    );
    if (merges.length) {
      console.log(`  ${merges.length} copies to merge into their originals, then delete:`);
      for (const { from } of merges) console.log(`    - ${from.name} -> ${copyOf.get(from.name)}`);
    }
    if (APPLY) {
      // A row first goes in without its parent, so parents need no order; then it gets the parent.
      const bare = (m: Model) => {
        const { documents: _docs, ...row } = modelToRow({ ...m, parentId: undefined, parentRelation: undefined });
        return row;
      };
      const links = (ms: Model[]) =>
        ms.flatMap((m) => m.documentIds.map((documentId) => ({ modelId: m.id, documentId })));
      await prisma.model.createMany({ data: p.create.map(bare) });
      for (const m of p.update) await prisma.model.update({ where: { id: m.id }, data: bare(m) });
      await prisma.modelDocument.deleteMany({ where: { modelId: { in: p.update.map((m) => m.id) } } });
      await prisma.modelDocument.createMany({ data: links([...p.create, ...p.update]) });
      for (const m of [...p.create, ...p.update].filter((x) => x.parentId)) {
        await prisma.model.update({
          where: { id: m.id },
          data: { parentId: m.parentId, parentRelation: m.parentRelation },
        });
      }
      for (const merge of merges) await mergeModel(merge.from, merge.to);
    }
  }

  if (run('research')) {
    // A model that is not in the database yet gets its row from the models part.
    const inDatabase = new Set(modelRows.map((m) => m.id));
    const missing = [...research.values()]
      .flatMap((r) => r.incidents.flatMap((i) => i.models))
      .filter((name) => !inDatabase.has(seedModelId.get(name)!));
    if (missing.length && !run('models'))
      throw new Error(`Incident models not in the database; also run the models part: ${[...new Set(missing)]}`);
    await importResearch(organizations, research, broken, (name) => seedModelId.get(name)!);
  }
  if (researchProblems.length) {
    console.log(`\nResearch files with problems (${researchProblems.length}); their organizations were not changed:`);
    for (const p of researchProblems) console.log(`  ! ${p}`);
    process.exitCode = 1;
  }
  if (run('commitments')) await importCommitments(organizations);

  // Eval suites and evals
  const suiteRows = (await prisma.evalSuite.findMany()).map(evalSuiteFromRow);
  const suiteBySlug = new Map(suiteRows.map((s) => [s.slug, s]));
  const suites: EvalSuite[] = jsonFiles('data', 'seed', 'eval-suites').map((file) => {
    const s = readJson<Omit<EvalSuite, 'id'>>('data', 'seed', 'eval-suites', file);
    return { id: suiteBySlug.get(s.slug)?.id ?? newId(), ...s };
  });
  const evalRows = (await prisma.eval.findMany()).map(evalFromRow);
  const evalBySlug = new Map(evalRows.map((e) => [e.slug, e]));
  const versionDbRows = await prisma.evalVersion.findMany();
  const publishedAtOf = new Map(versionDbRows.map((r) => [r.id, r.publishedAt]));
  const versionRows = versionDbRows.map(evalVersionFromRow);
  const versionByKey = new Map(versionRows.map((v) => [`${v.evalId}/${v.version}`, v]));
  const evals: Eval[] = [];
  const versions: EvalVersion[] = [];
  for (const file of jsonFiles('data', 'seed', 'evals')) {
    const s = readJson<SeedEval>('data', 'seed', 'evals', file);
    const recommendedModels = s.recommendedModels ?? s.eval.recommendedModels;
    const { suite, ...fields } = s.eval;
    const suiteId = suite && suites.find((x) => x.slug === suite)?.id;
    if (suite && !suiteId) throw new Error(`Eval ${fields.slug}: suite ${suite} is not in data/seed/eval-suites`);
    const e: Eval = {
      id: evalBySlug.get(s.eval.slug)?.id ?? newId(),
      ...fields,
      ...(suiteId && { suiteId }),
      ...(recommendedModels?.length && { recommendedModels }),
    };
    evals.push(e);
    for (const v of s.versions) {
      versions.push({ id: versionByKey.get(`${e.id}/${v.version}`)?.id ?? newId(), evalId: e.id, ...v });
    }
  }
  if (run('evals')) {
    suites.forEach((s) => assertValid('EvalSuite', s, s.slug));
    for (const s of suites) {
      const m = s.matched;
      const e = m && evals.find((x) => x.slug === m.eval && x.suiteId === s.id);
      const vs = e ? versions.filter((v) => v.evalId === e.id) : [];
      if (m && !(vs.length === 1 && vs[0].metrics.some((x) => x.key === m.metric)))
        throw new Error(`Suite ${s.slug}: matched names ${m.eval} ${m.metric}, not a metric of a suite eval`);
      const strays = (s.evalOrder ?? []).filter((slug) => !evals.some((x) => x.slug === slug && x.suiteId === s.id));
      if (strays.length) throw new Error(`Suite ${s.slug}: evalOrder names evals not in the suite: ${strays}`);
    }
    evals.forEach((e) => assertValid('Eval', e, e.slug));
    for (const e of evals) {
      if (e.supersededBy && !evals.some((x) => x.slug === e.supersededBy)) {
        throw new Error(`Eval ${e.slug}: supersededBy ${e.supersededBy} is not an eval in the seed`);
      }
    }
    versions.forEach((v) => assertValid('EvalVersion', v, v.version));
    for (const v of versions) {
      for (const s of v.runner?.models ?? []) {
        if (s.tier && !(s.tier in LADDERS.tiers))
          throw new Error(`Eval version ${v.id}: slot ${s.id} has tier ${s.tier}, not in spec/model-ladders.yaml`);
      }
    }
    const ps = plan('Eval suites', suites, suiteBySlug, (s) => s.slug);
    report(ps, (s) => s.slug);
    const pe = plan('Evals', evals, evalBySlug, (e) => e.slug);
    report(pe, (e) => e.slug);
    const pv = plan('Eval versions', versions, versionByKey, (v) => `${v.evalId}/${v.version}`);
    report(pv, (v) => `${evals.find((e) => e.id === v.evalId)?.slug}@${v.version}`);
    for (const v of pv.update) {
      const old = versionRows.find((x) => x.id === v.id)!;
      // A published version can declare more scores and metrics, and a dataset when it has none.
      // The ones it has stay as they are.
      const kept = {
        ...v,
        scores: v.scores.filter((s) => old.scores.some((o) => o.key === s.key)),
        metrics: v.metrics.filter((m) => old.metrics.some((o) => o.key === m.key)),
        dataset: old.dataset && v.dataset,
      };
      if (old.status === 'published' && !isDeepStrictEqual(fixedPart(old), fixedPart(kept))) {
        throw new Error(
          `Eval version ${v.id} is published; only its runner, change note, dataset license, safety directions, score and metric names, pass rules, core subjects, new scores, new metrics and a first dataset can change`,
        );
      }
    }
    if (APPLY) {
      for (const s of [...ps.create, ...ps.update]) {
        const row = evalSuiteToRow(s);
        await prisma.evalSuite.upsert({ where: { id: s.id }, create: row, update: row });
      }
      for (const e of [...pe.create, ...pe.update]) {
        const row = evalToRow(e);
        await prisma.eval.upsert({ where: { id: e.id }, create: row, update: row });
      }
      for (const v of pv.create) await prisma.evalVersion.create({ data: evalVersionToRow(v) });
      // An update of a published version keeps its publish time: the home page orders by it.
      for (const v of pv.update) {
        const data = evalVersionToRow(v, publishedAtOf.get(v.id) ?? undefined);
        await prisma.evalVersion.update({ where: { id: v.id }, data });
      }
    }

    // Measured results take the safety direction of their metric. An undeclared metric gets none.
    const defs = new Map(versions.map((v) => [v.id, v.metrics]));
    const wanted = (r: { evalVersionId: string | null; metric: string }) => {
      const key = r.metric.split('@')[0];
      return defs.get(r.evalVersionId ?? '')?.find((m) => m.key === key)?.safetyDirection;
    };
    const measured = await prisma.evalResult.findMany({
      where: { origin: 'measured' },
      select: { id: true, evalVersionId: true, metric: true, safetyDirection: true },
    });
    const moves = new Map<string, string[]>();
    for (const r of measured) {
      const to = wanted(r);
      if (to && to !== r.safetyDirection) moves.set(to, [...(moves.get(to) ?? []), r.id]);
    }
    const moved = [...moves.values()].reduce((n, ids) => n + ids.length, 0);
    console.log(`Measured result safety directions: ${moved} to update, ${measured.length - moved} unchanged`);
    for (const [to, ids] of moves) console.log(`  ~ ${ids.length} to ${to}`);
    if (APPLY) {
      for (const [to, ids] of moves) {
        await prisma.evalResult.updateMany({ where: { id: { in: ids } }, data: { safetyDirection: to } });
      }
    }
  }

  // Samples. A published version's samples do not change; new ones may be added.
  if (run('samples')) {
    for (const e of evals) {
      for (const v of versions.filter((x) => x.evalId === e.id)) {
        const path = ['data', 'cache', 'samples', `${e.slug}@${v.version}.jsonl`];
        if (!existsSync(join(ROOT, ...path))) {
          if (v.dataset?.splits.some((sp) => sp.storage !== 'pointer' && sp.sampleCount > 0)) {
            console.log(`Samples ${e.slug}@${v.version}: no ${path.join('/')}; skipped`);
          }
          continue;
        }
        const lines = readFileSync(join(ROOT, ...path), 'utf8')
          .split('\n')
          .filter(Boolean);
        const old = new Map(
          (await prisma.evalSample.findMany({ where: { evalVersionId: v.id } }))
            .map(evalSampleFromRow)
            .map((x) => [`${x.split}/${x.sourceId}`, x]),
        );
        const wanted: EvalSample[] = lines.map((line) => {
          const x = JSON.parse(line) as Omit<EvalSample, 'id' | 'evalVersionId'>;
          return { id: old.get(`${x.split}/${x.sourceId}`)?.id ?? newId(), evalVersionId: v.id, ...x };
        });
        for (const sp of v.dataset?.splits ?? []) {
          const n = wanted.filter((x) => x.split === sp.name).length;
          if (n !== sp.sampleCount)
            throw new Error(
              `${e.slug}@${v.version} split ${sp.name}: ${n} samples, the version says ${sp.sampleCount}`,
            );
        }
        wanted.forEach((x) => assertValid('EvalSample', x, `${x.split}/${x.sourceId}`));
        const p = plan(`Samples ${e.slug}@${v.version}`, wanted, old, (x) => `${x.split}/${x.sourceId}`);
        report(p, (x) => `${x.split}/${x.sourceId}`);
        if (p.update.length && v.status === 'published') {
          throw new Error(`${e.slug}@${v.version} is published; ${p.update.length} samples would change`);
        }
        if (APPLY) {
          for (let i = 0; i < p.create.length; i += 500) {
            await prisma.evalSample.createMany({ data: p.create.slice(i, i + 500).map(evalSampleToRow) });
          }
          for (const x of p.update) await prisma.evalSample.update({ where: { id: x.id }, data: evalSampleToRow(x) });
        }
      }
    }
  }

  if (run('methods')) {
    // In an apply run without the evals part, results can only point to versions in the database.
    const known = new Set(run('evals') ? versions.map((v) => v.id) : versionRows.map((v) => v.id));
    const modelIds = new Map(models.map((m) => [m.name, m.id]));
    await importMethods(evals, versions, suites, known, (name) => modelIds.get(name));
  }

  // System cards and their reported results
  if (run('cards')) {
    const allEvals = [...evalRows, ...evals];
    const norm = (s: string) =>
      s
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '');
    const evalByName = new Map<string, string>();
    for (const e of allEvals) for (const n of [e.slug, e.displayName, ...e.aliases]) evalByName.set(norm(n), e.id);
    // A lab_internal eval links only to documents from its lab (the maintainer that is an organization).
    const orgByName = new Map<string, string>();
    for (const o of organizations) for (const n of [o.slug, o.displayName, ...o.aliases]) orgByName.set(norm(n), o.id);
    const evalLabs = new Map<string, Set<string>>();
    for (const e of allEvals) {
      if (e.access !== 'lab_internal') continue;
      const labs = new Set(e.maintainers.map((m) => orgByName.get(norm(m.name))).filter((id) => id !== undefined));
      if (labs.size) evalLabs.set(e.id, labs);
    }
    const docPublisher = new Map(documents.map((d) => [d.id, d.publisherId]));
    // One entry per (eval name, metric) key; `bySetting` overrides it for one `settings.other` text.
    const directions = new Map<string, DirectionEntry>();
    const dirFile = join(ROOT, 'data', 'extracted', 'result-directions.jsonl');
    for (const line of existsSync(dirFile) ? readFileSync(dirFile, 'utf8').split('\n') : []) {
      if (!line.trim()) continue;
      const d = JSON.parse(line) as DirectionEntry;
      directions.set(d.key, d);
    }
    let noDirection = 0;
    const directionOf = (r: Extraction['evalResults'][number]) => {
      const entry = directions.get(`${norm(r.rawEvalName)}|${norm(r.metric)}`);
      if (!entry) noDirection++;
      const d = (r.settings?.other && entry?.bySetting?.[r.settings.other]) || entry;
      return {
        ...(d && d.safety !== 'unknown' && { safetyDirection: d.safety }),
        ...(d && d.capability !== 'unknown' && { capabilityDirection: d.capability }),
      };
    };

    const cardRows = (await prisma.systemCard.findMany()).map(systemCardFromRow);
    const cardByDoc = new Map(cardRows.map((c) => [c.documentId, c]));
    const cards: SystemCard[] = [];
    const resultsByDoc = new Map<string, EvalResult[]>();
    const problems: string[] = [];
    for (const file of jsonFiles('data', 'extracted', 'system-cards')) {
      const x = readJson<Extraction>('data', 'extracted', 'system-cards', file);
      const documentId = docId.get(x.document);
      const missing = [x.document, ...x.alsoDocuments, ...(x.basedOn ? [x.basedOn] : [])].filter((k) => !docId.has(k));
      if (!documentId || missing.length) {
        problems.push(`${file}: unknown document keys ${missing.join(', ')}`);
        continue;
      }
      const toCover = (r: { model?: string; rawModelName?: string }) => {
        const id = r.model ? seedModelId.get(r.model) : undefined;
        return id ? { modelId: id } : { rawModelName: r.rawModelName ?? r.model! };
      };
      const card: SystemCard = {
        id: cardByDoc.get(documentId)?.id ?? newId(),
        documentId,
        alsoDocumentIds: x.alsoDocuments.map((k) => docId.get(k)!),
        covers: x.covers.map((c) => ({ ...toCover(c), ...(c.section && { section: c.section }) }) as CardCover),
        disclosures: x.disclosures,
        riskDecisions: x.riskDecisions.map(({ models, ...r }): RiskDecision => {
          if (!models) return r;
          const [first, ...rest] = models.map((m) => seedModelId.get(m) ?? m);
          return { ...r, modelIds: [first!, ...rest] };
        }),
        topics: x.topics,
        testers: x.testers,
        findings: x.findings,
        reviewed: false,
        extraction: { by: x.extraction.by, at: new Date(x.extraction.at).toISOString() },
        ...(x.basedOn && { basedOnDocumentId: docId.get(x.basedOn)! }),
        ...(x.pageCount && { pageCount: x.pageCount }),
      };
      try {
        assertValid('SystemCard', card, file);
      } catch (e) {
        problems.push(`${file}: ${(e as Error).message}`);
        continue;
      }
      cards.push(card);
      const results: EvalResult[] = x.evalResults.map((r) => {
        const named = evalByName.get(norm(r.rawEvalName));
        const labs = named ? evalLabs.get(named) : undefined;
        const evalId = labs && !labs.has(docPublisher.get(documentId)!) ? undefined : named;
        const source = { documentId, ...r.source };
        return {
          id: '',
          origin: 'reported',
          rawEvalName: r.rawEvalName,
          ...toCover(r),
          metric: r.metric,
          value: r.value,
          settings: r.settings ?? {},
          source,
          reviewed: false,
          extraction: card.extraction,
          ...(evalId && { evalId }),
          ...(r.unit && { unit: r.unit }),
          ...(r.stderr !== undefined && { stderr: r.stderr }),
          ...(r.ciLow !== undefined && { ciLow: r.ciLow }),
          ...(r.ciHigh !== undefined && { ciHigh: r.ciHigh }),
          ...(r.n !== undefined && { n: r.n }),
          ...directionOf(r),
        } as EvalResult;
      });
      resultsByDoc.set(documentId, results);
    }
    for (const p of problems) console.log(`  skipped ${p}`);
    const pc = plan('System cards', cards, cardByDoc, (c) => c.documentId);
    const keyOfDoc = new Map(documents.map((d) => [d.id, d.key]));
    report(pc, (c) => keyOfDoc.get(c.documentId) ?? c.documentId);

    // Results: one set per card document. A set with a reviewed row is left alone.
    const oldResults = (await prisma.evalResult.findMany({ where: { origin: 'reported' } })).map(evalResultFromRow);
    const noId = ({ id: _id, ...r }: EvalResult) => canonical(r);
    let replace = 0;
    let same = 0;
    let rows = 0;
    const toWrite: [string, EvalResult[]][] = [];
    for (const [documentId, results] of resultsByDoc) {
      const old = oldResults.filter((r) => r.source?.documentId === documentId);
      if (old.some((r) => r.reviewed)) {
        console.log(`  kept reviewed results for ${keyOfDoc.get(documentId)}`);
        continue;
      }
      if (isDeepStrictEqual(sorted(old.map(noId)), sorted(results.map(noId)))) {
        same++;
        continue;
      }
      replace++;
      rows += results.length;
      toWrite.push([documentId, results.map((r) => ({ ...r, id: newId() }))]);
    }
    console.log(`Reported results: ${replace} cards to replace (${rows} rows), ${same} cards unchanged`);
    const matched = [...resultsByDoc.values()].flat().filter((r) => r.evalId).length;
    console.log(`  ${matched} of ${[...resultsByDoc.values()].flat().length} results match a registry eval`);
    if (noDirection) console.log(`  ${noDirection} results have no direction (spec/scripts/result-directions.mjs)`);
    for (const [, results] of toWrite) results.forEach((r) => assertValid('EvalResult', r, r.rawEvalName ?? ''));

    if (APPLY) {
      for (const c of [...pc.create, ...pc.update]) {
        const row = systemCardToRow(c);
        await prisma.systemCard.upsert({ where: { id: c.id }, create: row, update: row });
      }
      for (const [documentId, results] of toWrite) {
        await prisma.$transaction([
          prisma.evalResult.deleteMany({
            where: { sourceDocumentId: documentId, origin: 'reported', reviewed: false },
          }),
          prisma.evalResult.createMany({ data: results.map(evalResultToRow) }),
        ]);
      }
    }
  }
  if (!APPLY) console.log('\nDry run. Add --apply to write.');
}

type SeedMethods = {
  method: Omit<Method, 'id'>;
  /** `components` and `supersedes`: variant slugs of this method. */
  variants: (Omit<MethodVariant, 'id' | 'methodId' | 'componentIds' | 'supersedesId'> & {
    components?: string[];
    supersedes?: string;
  })[];
  /** `variants`: variant slugs of this method. */
  views?: (Omit<MethodExpertView, 'id' | 'methodId' | 'variantIds'> & { variants?: string[] })[];
};
type ExtractedResult = {
  eval: string;
  /** The eval version. Needed only when the seed eval has more than one. */
  version?: string;
  sourceUrl: string;
  sourceTable?: string;
  commit?: string;
  measuredAt?: string;
  n?: number;
  metrics: Record<string, number>;
  stderr?: Record<string, number>;
};
type ExtractedArtifact = Omit<MethodArtifact, 'id' | 'variantId' | 'modelId'> & {
  method: string;
  variant: string;
  results: ExtractedResult[];
};
type Extracted = { source: Record<string, string>; artifacts: ExtractedArtifact[] };

const PARAM_TYPES: Record<MethodParam['type'], (v: unknown) => boolean> = {
  integer: Number.isInteger,
  number: (v) => typeof v === 'number' && Number.isFinite(v),
  string: (v) => typeof v === 'string' && v.length > 0,
  boolean: (v) => typeof v === 'boolean',
};

/**
 * Methods (by slug) with their variants and expert views (by method and slug), then artifacts (by
 * key) and their results (by artifact, eval version and metric) from `data/extracted/methods`. A
 * result's eval is a seed eval with one version. Only expert views that left their method's file
 * are deleted.
 */
async function importMethods(
  evals: Eval[],
  versions: EvalVersion[],
  suites: EvalSuite[],
  knownVersions: Set<string>,
  modelId: (hfName: string) => string | undefined,
) {
  const [methodRows, variantRows, viewRows, artifactRows, resultRows] = await Promise.all([
    prisma.method.findMany(),
    prisma.methodVariant.findMany(),
    prisma.methodExpertView.findMany(),
    prisma.methodArtifact.findMany(),
    prisma.methodResult.findMany(),
  ]);
  const oldMethods = new Map(methodRows.map(methodFromRow).map((m) => [m.slug, m]));
  const oldVariants = new Map(variantRows.map(methodVariantFromRow).map((v) => [`${v.methodId}/${v.slug}`, v]));
  const oldViews = new Map(viewRows.map(methodExpertViewFromRow).map((v) => [`${v.methodId}/${v.slug}`, v]));
  const oldArtifacts = new Map(artifactRows.map(methodArtifactFromRow).map((a) => [a.key, a]));
  const resultKey = (x: MethodResult) => `${x.artifactId}/${x.evalVersionId}/${x.metric}`;
  const oldResults = new Map(resultRows.map(methodResultFromRow).map((x) => [resultKey(x), x]));

  const methods: Method[] = [];
  const variants: MethodVariant[] = [];
  const views: MethodExpertView[] = [];
  for (const file of jsonFiles('data', 'seed', 'methods')) {
    const s = readJson<SeedMethods>('data', 'seed', 'methods', file);
    const method: Method = { id: oldMethods.get(s.method.slug)?.id ?? newId(), ...s.method };
    methods.push(method);
    const idOf = new Map(
      s.variants.map((v) => [v.slug, oldVariants.get(`${method.id}/${v.slug}`)?.id ?? newId()] as const),
    );
    const ref = (slug: string, by: string) => {
      const id = idOf.get(slug);
      if (!id) throw new Error(`${file}: ${by} names variant ${slug}, not in the file`);
      return id;
    };
    for (const { components = [], supersedes, ...v } of s.variants) {
      variants.push({
        id: idOf.get(v.slug)!,
        methodId: method.id,
        componentIds: components.map((c) => ref(c, v.slug)),
        ...(supersedes && { supersedesId: ref(supersedes, v.slug) }),
        ...v,
      });
    }
    for (const { variants: named = [], ...v } of s.views ?? []) {
      views.push({
        id: oldViews.get(`${method.id}/${v.slug}`)?.id ?? newId(),
        methodId: method.id,
        variantIds: named.map((n) => ref(n, `view ${v.slug}`)),
        ...v,
      });
    }
  }
  methods.forEach((m) => assertValid('Method', m, m.slug));
  variants.forEach((v) => assertValid('MethodVariant', v, v.slug));
  views.forEach((v) => assertValid('MethodExpertView', v, v.slug));

  const methodBySlug = new Map(methods.map((m) => [m.slug, m]));
  const variantByKey = new Map(variants.map((v) => [`${methods.find((m) => m.id === v.methodId)!.slug}/${v.slug}`, v]));
  const versionsOf = new Map(evals.map((e) => [e.slug, versions.filter((v) => v.evalId === e.id)]));
  const versionOf = (r: ExtractedResult) => {
    const vs = versionsOf.get(r.eval) ?? [];
    return r.version ? vs.find((v) => v.version === r.version) : vs.length === 1 ? vs[0] : undefined;
  };
  const artifacts: MethodArtifact[] = [];
  const results: MethodResult[] = [];
  const groups = new Map<string, string>();
  const extracted = jsonFiles('data', 'extracted', 'methods').map(
    (file) => [file, readJson<Extracted>('data', 'extracted', 'methods', file)] as const,
  );
  // A method with results on a matched eval reads a line through its artifacts, so a group can have many.
  const matchedEvals = new Set(suites.flatMap((s) => (s.matched ? [s.matched.eval] : [])));
  const matched = new Set(
    extracted.flatMap(([, x]) =>
      x.artifacts.filter((a) => a.results.some((r) => matchedEvals.has(r.eval))).map((a) => a.method),
    ),
  );
  for (const [file, x] of extracted) {
    for (const { method: ms, variant: vs, results: rs, ...a } of x.artifacts) {
      const method = methodBySlug.get(ms);
      const variant = variantByKey.get(`${ms}/${vs}`);
      if (!method || !variant) throw new Error(`${file}: ${a.key} has variant ${ms}/${vs}, not in the seed`);
      const defs = new Map([...method.params, ...variant.params].map((d) => [d.key, d]));
      for (const [k, v] of Object.entries(a.params)) {
        const def = defs.get(k);
        if (!def) throw new Error(`${file}: ${a.key} has param ${k}, which ${ms}/${vs} does not define`);
        if (!PARAM_TYPES[def.type](v)) throw new Error(`${file}: ${a.key} param ${k} is not a ${def.type}`);
      }
      for (const f of a.files ?? []) {
        if (!f.url && !f.mirror) throw new Error(`${file}: ${a.key} file ${f.name} has no url and no mirror`);
      }
      if (!matched.has(ms)) {
        const group = [variant.id, a.subject, ...method.compare.groupBy.map((k) => groupValue(a, k))].join('|');
        const other = groups.get(group);
        if (other) throw new Error(`${file}: ${a.key} and ${other} are in one group; ${ms} compares one each`);
        groups.set(group, a.key);
      }
      const model = modelId(a.subject);
      const artifact: MethodArtifact = {
        id: oldArtifacts.get(a.key)?.id ?? newId(),
        variantId: variant.id,
        ...a,
        ...(model && { modelId: model }),
      };
      artifacts.push(artifact);
      for (const r of rs) {
        const v = versionOf(r);
        if (!v)
          throw new Error(
            `${file}: ${a.key} has eval ${r.eval}${r.version ? `@${r.version}, not a seed eval version` : ', which is not a seed eval with one version; give its version'}`,
          );
        for (const [metric, value] of Object.entries(r.metrics)) {
          if (!v.metrics.some((m) => m.key === metric))
            throw new Error(`${r.eval}@${v.version} has no metric ${metric}`);
          const row: MethodResult = {
            id: '',
            artifactId: artifact.id,
            evalVersionId: v.id,
            metric,
            value,
            sourceUrl: r.sourceUrl,
            ...(r.stderr?.[metric] !== undefined && { stderr: r.stderr[metric] }),
            ...(r.n && { n: r.n }),
            ...(r.sourceTable && { sourceTable: r.sourceTable }),
            ...(r.commit && { sourceCommit: r.commit }),
            ...(r.measuredAt && { measuredAt: r.measuredAt }),
          };
          row.id = oldResults.get(resultKey(row))?.id ?? newId();
          results.push(row);
        }
      }
    }
  }
  artifacts.forEach((a) => assertValid('MethodArtifact', a, a.key));
  results.forEach((r) => assertValid('MethodResult', r, resultKey(r)));

  const pm = plan('Methods', methods, oldMethods, (m) => m.slug);
  report(pm, (m) => m.slug);
  const pvar = plan('Method variants', variants, oldVariants, (v) => `${v.methodId}/${v.slug}`);
  report(pvar, (v) => v.slug);
  const pv = plan('Method expert views', views, oldViews, (v) => `${v.methodId}/${v.slug}`);
  report(pv, (v) => v.slug);
  const seeded = new Set(methods.map((m) => m.id));
  const goneViews = pv.extra.map((k) => oldViews.get(k)!).filter((v) => seeded.has(v.methodId));
  for (const v of goneViews) console.log(`  - ${v.slug} (left its file; to delete)`);
  const pa = plan('Method artifacts', artifacts, oldArtifacts, (a) => a.key);
  report(pa, (a) => a.key);
  const pr = plan('Method results', results, oldResults, resultKey);
  report(pr, (r) => `${artifacts.find((a) => a.id === r.artifactId)?.key} ${r.metric} = ${r.value}`);
  if (!APPLY) return;

  const missing = [...new Set(results.map((r) => r.evalVersionId))].filter((id) => !knownVersions.has(id));
  if (missing.length)
    throw new Error(`Method results need ${missing.length} eval versions; import the evals part first`);
  for (const m of [...pm.create, ...pm.update]) {
    const row = methodToRow(m);
    await prisma.method.upsert({ where: { id: m.id }, create: row, update: row });
  }
  // Without `supersedesId` first, so that a variant can name one that comes later.
  const changed = [...pvar.create, ...pvar.update];
  for (const v of changed) {
    const row = { ...methodVariantToRow(v), supersedesId: null };
    await prisma.methodVariant.upsert({ where: { id: v.id }, create: row, update: row });
  }
  for (const v of changed.filter((v) => v.supersedesId)) {
    await prisma.methodVariant.update({ where: { id: v.id }, data: { supersedesId: v.supersedesId } });
  }
  for (const v of [...pv.create, ...pv.update]) {
    const row = methodExpertViewToRow(v);
    await prisma.methodExpertView.upsert({ where: { id: v.id }, create: row, update: row });
  }
  await prisma.methodExpertView.deleteMany({ where: { id: { in: goneViews.map((v) => v.id) } } });
  await prisma.methodArtifact.createMany({ data: pa.create.map(methodArtifactToRow) });
  for (const a of pa.update) await prisma.methodArtifact.update({ where: { id: a.id }, data: methodArtifactToRow(a) });
  for (let i = 0; i < pr.create.length; i += 1000) {
    await prisma.methodResult.createMany({ data: pr.create.slice(i, i + 1000).map(methodResultToRow) });
  }
  for (const r of pr.update) await prisma.methodResult.update({ where: { id: r.id }, data: methodResultToRow(r) });
}

/**
 * Incidents (by slug) with their timeline events (by place), and departures (by name), for each
 * organization with a valid file. Rows that are not in the file are deleted, also for an
 * organization with no file.
 */
async function importResearch(
  organizations: Organization[],
  research: Map<string, Research>,
  broken: Set<string>,
  modelId: (name: string) => string,
) {
  const [incidentRows, eventRows, departureRows] = await Promise.all([
    prisma.orgIncident.findMany(),
    prisma.orgIncidentEvent.findMany(),
    prisma.orgDeparture.findMany(),
  ]);
  const oldIncidents = incidentRows.map(orgIncidentFromRow);
  const oldEvents = eventRows.map(orgIncidentEventFromRow);
  const oldDepartures = departureRows.map(orgDepartureFromRow);
  const keyed = <T>(xs: T[], key: (x: T) => string) => new Map(xs.map((x) => [key(x), x]));

  const wanted = {
    incidents: [] as OrgIncident[],
    events: [] as OrgIncidentEvent[],
    departures: [] as OrgDeparture[],
  };
  const incidentKey = (x: { organizationId: string; slug: string }) => `${x.organizationId}/${x.slug}`;
  const eventKey = (x: { incidentId: string; order: number }) => `${x.incidentId}/${x.order}`;
  const nameKey = (x: { organizationId: string; name: string }) => `${x.organizationId}/${x.name}`;
  const oldIncidentByKey = keyed(oldIncidents, incidentKey);
  const oldEventByKey = keyed(oldEvents, eventKey);
  const oldDepartureByKey = keyed(oldDepartures, nameKey);
  const counts: [string, number[]][] = [];
  for (const o of organizations) {
    const r = research.get(o.id);
    if (!r) continue;
    const organizationId = o.id;
    let events = 0;
    for (const { timeline, models, ...x } of r.incidents) {
      const id = oldIncidentByKey.get(incidentKey({ organizationId, slug: x.slug }))?.id ?? newId();
      wanted.incidents.push({ id, organizationId, ...x, ...(models.length > 0 && { modelIds: models.map(modelId) }) });
      for (const e of timeline) {
        events++;
        const eventId = oldEventByKey.get(eventKey({ incidentId: id, order: e.order }))?.id ?? newId();
        wanted.events.push({ id: eventId, incidentId: id, ...e });
      }
    }
    for (const x of r.departures)
      wanted.departures.push({
        id: oldDepartureByKey.get(nameKey({ organizationId, ...x }))?.id ?? newId(),
        organizationId,
        ...x,
      });
    counts.push([o.slug, [r.incidents.length, events, r.departures.length]]);
  }

  // Rows of an organization whose file has a problem stay.
  const keep =
    <T>(orgOf: (x: T) => string | undefined) =>
    (x: T) =>
      broken.has(orgOf(x) ?? '');
  const incidentOrg = new Map(oldIncidents.map((i) => [i.id, i.organizationId]));
  const plans = {
    incidents: plan('Org incidents', wanted.incidents, oldIncidentByKey, incidentKey),
    events: plan('Org incident events', wanted.events, oldEventByKey, eventKey),
    departures: plan('Org departures', wanted.departures, oldDepartureByKey, nameKey),
  };
  const removeIds = {
    incidents: plans.incidents.extra
      .map((k) => oldIncidentByKey.get(k)!)
      .filter((x) => !keep<OrgIncident>((i) => i.organizationId)(x))
      .map((x) => x.id),
    events: plans.events.extra
      .map((k) => oldEventByKey.get(k)!)
      .filter((x) => !keep<OrgIncidentEvent>((e) => incidentOrg.get(e.incidentId))(x))
      .map((x) => x.id),
    departures: plans.departures.extra
      .map((k) => oldDepartureByKey.get(k)!)
      .filter((x) => !keep<OrgDeparture>((d) => d.organizationId)(x))
      .map((x) => x.id),
  };
  report(plans.incidents, (x) => `${x.slug}`);
  report(plans.events, (x) => `${x.title}`);
  report(plans.departures, (x) => x.name);
  console.log(
    `  to delete: ${Object.entries(removeIds)
      .map(([k, ids]) => `${ids.length} ${k}`)
      .join(', ')}`,
  );

  if (APPLY) {
    await prisma.orgIncidentEvent.deleteMany({ where: { id: { in: removeIds.events } } });
    await prisma.orgIncident.deleteMany({ where: { id: { in: removeIds.incidents } } });
    await prisma.orgDeparture.deleteMany({ where: { id: { in: removeIds.departures } } });
    await prisma.orgIncident.createMany({ data: plans.incidents.create.map(orgIncidentToRow) });
    for (const x of plans.incidents.update)
      await prisma.orgIncident.update({ where: { id: x.id }, data: orgIncidentToRow(x) });
    await prisma.orgIncidentEvent.createMany({ data: plans.events.create.map(orgIncidentEventToRow) });
    for (const x of plans.events.update)
      await prisma.orgIncidentEvent.update({ where: { id: x.id }, data: orgIncidentEventToRow(x) });
    await prisma.orgDeparture.createMany({ data: plans.departures.create.map(orgDepartureToRow) });
    for (const x of plans.departures.update)
      await prisma.orgDeparture.update({ where: { id: x.id }, data: orgDepartureToRow(x) });
  }

  console.log('\nResearch per organization: incidents, timeline events, departures');
  for (const [slug, n] of counts) console.log(`  ${slug.padEnd(18)} ${n.map((x) => String(x).padStart(4)).join('')}`);
  const sum = (i: number) => counts.reduce((s, [, n]) => s + n[i], 0);
  console.log(`  ${'total'.padEnd(18)} ${[0, 1, 2].map((i) => String(sum(i)).padStart(4)).join('')}`);
}

/**
 * Commitments (by slug), each organization's state (by organization and commitment) and its events
 * (by place). Rows that are not in the files are deleted. With a problem in any file, nothing changes.
 */
async function importCommitments(organizations: Organization[]) {
  const problems: string[] = [];
  const files: CommitmentFile[] = [];
  for (const file of jsonFiles('data', 'seed', 'commitments')) {
    const label = `data/seed/commitments/${file}`;
    const r = parseCommitment(readFileSync(join(ROOT, 'data', 'seed', 'commitments', file), 'utf8'), label, specErrors);
    problems.push(...r.problems);
    if (!r.parsed) continue;
    for (const o of r.parsed.orgs)
      if (!researchOrganization([o.org], organizations))
        problems.push(`${label}: no organization has the slug ${o.org}`);
    files.push(r.parsed);
  }
  problems.push(...crossProblems(files));
  if (problems.length) {
    console.log(`\nCommitment files with problems (${problems.length}); no commitment was changed:`);
    for (const p of problems) console.log(`  ! ${p}`);
    process.exitCode = 1;
    return;
  }

  const [commitmentRows, orgRows, eventRows] = await Promise.all([
    prisma.commitment.findMany(),
    prisma.orgCommitment.findMany(),
    prisma.orgCommitmentEvent.findMany(),
  ]);
  const oldCommitments = new Map(commitmentRows.map(commitmentFromRow).map((c) => [c.slug, c]));
  const orgKey = (x: OrgCommitment) => `${x.organizationId}/${x.commitmentId}`;
  const oldOrgs = new Map(orgRows.map(orgCommitmentFromRow).map((x) => [orgKey(x), x]));
  const eventKey = (x: OrgCommitmentEvent) => `${x.orgCommitmentId}/${x.order}`;
  const oldEvents = new Map(eventRows.map(orgCommitmentEventFromRow).map((x) => [eventKey(x), x]));

  const commitments: Commitment[] = [];
  const orgs: OrgCommitment[] = [];
  const events: OrgCommitmentEvent[] = [];
  for (const { commitment: c, orgs: entries } of files) {
    const commitment: Commitment = { id: oldCommitments.get(c.slug)?.id ?? newId(), ...c };
    commitments.push(commitment);
    for (const { org, events: timeline, ...x } of entries) {
      const draft: OrgCommitment = {
        id: '',
        organizationId: researchOrganization([org], organizations)!.id,
        commitmentId: commitment.id,
        ...x,
      };
      const row = { ...draft, id: oldOrgs.get(orgKey(draft))?.id ?? newId() };
      orgs.push(row);
      for (const e of timeline) {
        const event: OrgCommitmentEvent = { id: '', orgCommitmentId: row.id, ...e };
        events.push({ ...event, id: oldEvents.get(eventKey(event))?.id ?? newId() });
      }
    }
  }
  commitments.forEach((c) => assertValid('Commitment', c, c.slug));
  orgs.forEach((x) => assertValid('OrgCommitment', x, orgKey(x)));
  events.forEach((x) => assertValid('OrgCommitmentEvent', x, eventKey(x)));

  const pc = plan('Commitments', commitments, oldCommitments, (c) => c.slug);
  const po = plan('Org commitments', orgs, oldOrgs, orgKey);
  const pe = plan('Org commitment events', events, oldEvents, eventKey);
  report(pc, (c) => c.slug);
  report(po, (x) => `${organizations.find((o) => o.id === x.organizationId)?.slug} ${x.state.level}`);
  report(pe, (x) => x.title);
  const gone = {
    commitments: pc.extra.map((k) => oldCommitments.get(k)!.id),
    orgs: po.extra.map((k) => oldOrgs.get(k)!.id),
    events: pe.extra.map((k) => oldEvents.get(k)!.id),
  };
  console.log(
    `  to delete: ${gone.commitments.length} commitments, ${gone.orgs.length} org commitments, ${gone.events.length} events`,
  );
  if (!APPLY) return;

  await prisma.orgCommitmentEvent.deleteMany({ where: { id: { in: gone.events } } });
  await prisma.orgCommitment.deleteMany({ where: { id: { in: gone.orgs } } });
  await prisma.commitment.deleteMany({ where: { id: { in: gone.commitments } } });
  for (const c of [...pc.create, ...pc.update]) {
    const row = commitmentToRow(c);
    await prisma.commitment.upsert({ where: { id: c.id }, create: row, update: row });
  }
  await prisma.orgCommitment.createMany({ data: po.create.map(orgCommitmentToRow) });
  for (const x of po.update) await prisma.orgCommitment.update({ where: { id: x.id }, data: orgCommitmentToRow(x) });
  await prisma.orgCommitmentEvent.createMany({ data: pe.create.map(orgCommitmentEventToRow) });
  for (const x of pe.update)
    await prisma.orgCommitmentEvent.update({ where: { id: x.id }, data: orgCommitmentEventToRow(x) });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
