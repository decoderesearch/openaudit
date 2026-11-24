import { prisma } from '@/lib/db';
import type {
  Document,
  Eval,
  EvalAttempt,
  EvalResult,
  EvalRun,
  EvalSample,
  EvalVersion,
  Method,
  MethodArtifact,
  MethodExpertView,
  MethodResult,
  MethodVariant,
  Model,
  OrgDeparture,
  OrgIncident,
  OrgIncidentEvent,
  Organization,
  SystemCard,
} from '@openaudit/spec';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  MODEL_INCLUDE,
  documentFromRow,
  documentToRow,
  evalAttemptFromRow,
  evalAttemptToRow,
  evalFromRow,
  evalResultFromRow,
  evalResultToRow,
  evalRunFromRow,
  evalRunToRow,
  evalSampleFromRow,
  evalSampleToRow,
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
} from './rows';

const examples = <T>(type: string): T[] =>
  JSON.parse(readFileSync(new URL(`../../../../spec/examples/${type}.json`, import.meta.url), 'utf8'));

const organizations = examples<Organization>('Organization');
const documents = examples<Document>('Document');
const models = examples<Model>('Model');
const evals = examples<Eval>('Eval');
const versions = examples<EvalVersion>('EvalVersion');
const samples = examples<EvalSample>('EvalSample');
const cards = examples<SystemCard>('SystemCard');
const results = examples<EvalResult>('EvalResult');
const runs = examples<EvalRun>('EvalRun');
const attempts = examples<EvalAttempt>('EvalAttempt');
const incidents = examples<OrgIncident>('OrgIncident');
const incidentEvents = examples<OrgIncidentEvent>('OrgIncidentEvent');
const departures = examples<OrgDeparture>('OrgDeparture');
const methods = examples<Method>('Method');
const methodVariants = examples<MethodVariant>('MethodVariant');
const methodArtifacts = examples<MethodArtifact>('MethodArtifact');
const methodResults = examples<MethodResult>('MethodResult');
const methodViews = examples<MethodExpertView>('MethodExpertView');
const owners = [...new Set(evals.flatMap((e) => (e.ownerUserId ? [e.ownerUserId] : [])))];

const withSortedDocs = (m: Model) => ({ ...m, documentIds: [...m.documentIds].sort() });

// Each spec example goes into its table and comes back the same.
describe('spec records round-trip through the database', () => {
  beforeAll(async () => {
    await prisma.organization.createMany({ data: organizations.map(organizationToRow) });
    await prisma.document.createMany({ data: documents.map(documentToRow) });
    // In file order, so a parent is written before its children.
    for (const m of models) await prisma.model.create({ data: modelToRow(m) });
    await prisma.user.createMany({
      data: owners.map((id) => ({ id, name: 'Owner', email: `spec-owner-${id}@example.org` })),
    });
    await prisma.eval.createMany({ data: evals.map(evalToRow) });
    await prisma.evalVersion.createMany({ data: versions.map((v) => evalVersionToRow(v)) });
    await prisma.evalSample.createMany({ data: samples.map(evalSampleToRow) });
    await prisma.systemCard.createMany({ data: cards.map(systemCardToRow) });
    await prisma.evalRun.createMany({ data: runs.map(evalRunToRow) });
    await prisma.evalAttempt.createMany({ data: attempts.map(evalAttemptToRow) });
    await prisma.evalResult.createMany({ data: results.map(evalResultToRow) });
    await prisma.orgIncident.createMany({ data: incidents.map(orgIncidentToRow) });
    await prisma.orgIncidentEvent.createMany({ data: incidentEvents.map(orgIncidentEventToRow) });
    await prisma.orgDeparture.createMany({ data: departures.map(orgDepartureToRow) });
    await prisma.method.createMany({ data: methods.map(methodToRow) });
    await prisma.methodVariant.createMany({ data: methodVariants.map(methodVariantToRow) });
    await prisma.methodArtifact.createMany({ data: methodArtifacts.map(methodArtifactToRow) });
    await prisma.methodResult.createMany({ data: methodResults.map(methodResultToRow) });
    await prisma.methodExpertView.createMany({ data: methodViews.map(methodExpertViewToRow) });
  });

  afterAll(async () => {
    await prisma.$executeRaw`TRUNCATE method, eval_result, eval_attempt, eval_run, system_card, eval_sample, eval_version, eval, model_document, model, document, organization CASCADE`;
    await prisma.user.deleteMany({ where: { id: { in: owners } } });
    await prisma.$disconnect();
  });

  it('Organization', async () => {
    for (const d of organizations) {
      expect(organizationFromRow(await prisma.organization.findUniqueOrThrow({ where: { id: d.id } }))).toEqual(d);
    }
  });

  it('Document', async () => {
    for (const d of documents) {
      expect(documentFromRow(await prisma.document.findUniqueOrThrow({ where: { id: d.id } }))).toEqual(d);
    }
  });

  it('Model', async () => {
    for (const m of models) {
      const row = await prisma.model.findUniqueOrThrow({ where: { id: m.id }, include: MODEL_INCLUDE });
      expect(modelFromRow(row)).toEqual(withSortedDocs(m));
    }
  });

  it('Eval', async () => {
    for (const e of evals) {
      expect(evalFromRow(await prisma.eval.findUniqueOrThrow({ where: { id: e.id } }))).toEqual(e);
    }
  });

  it('EvalVersion', async () => {
    for (const v of versions) {
      expect(evalVersionFromRow(await prisma.evalVersion.findUniqueOrThrow({ where: { id: v.id } }))).toEqual(v);
    }
  });

  it('EvalSample', async () => {
    for (const x of samples) {
      expect(evalSampleFromRow(await prisma.evalSample.findUniqueOrThrow({ where: { id: x.id } }))).toEqual(x);
    }
  });

  it('SystemCard', async () => {
    for (const c of cards) {
      expect(systemCardFromRow(await prisma.systemCard.findUniqueOrThrow({ where: { id: c.id } }))).toEqual(c);
    }
  });

  it('EvalResult', async () => {
    for (const r of results) {
      expect(evalResultFromRow(await prisma.evalResult.findUniqueOrThrow({ where: { id: r.id } }))).toEqual(r);
    }
  });

  it('EvalRun', async () => {
    for (const r of runs) {
      expect(evalRunFromRow(await prisma.evalRun.findUniqueOrThrow({ where: { id: r.id } }))).toEqual(r);
    }
  });

  it('EvalAttempt', async () => {
    for (const a of attempts) {
      expect(evalAttemptFromRow(await prisma.evalAttempt.findUniqueOrThrow({ where: { id: a.id } }))).toEqual(a);
    }
  });

  it('Method records', async () => {
    for (const x of methods)
      expect(methodFromRow(await prisma.method.findUniqueOrThrow({ where: { id: x.id } }))).toEqual(x);
    for (const x of methodVariants) {
      const row = await prisma.methodVariant.findUniqueOrThrow({ where: { id: x.id } });
      expect(methodVariantFromRow(row)).toEqual(x);
    }
    for (const x of methodArtifacts) {
      const row = await prisma.methodArtifact.findUniqueOrThrow({ where: { id: x.id } });
      expect(methodArtifactFromRow(row)).toEqual(x);
    }
    for (const x of methodResults)
      expect(methodResultFromRow(await prisma.methodResult.findUniqueOrThrow({ where: { id: x.id } }))).toEqual(x);
    for (const x of methodViews) {
      const row = await prisma.methodExpertView.findUniqueOrThrow({ where: { id: x.id } });
      expect(methodExpertViewFromRow(row)).toEqual(x);
    }
  });

  it('Organization research records', async () => {
    for (const x of incidents)
      expect(orgIncidentFromRow(await prisma.orgIncident.findUniqueOrThrow({ where: { id: x.id } }))).toEqual(x);
    for (const x of incidentEvents) {
      const row = await prisma.orgIncidentEvent.findUniqueOrThrow({ where: { id: x.id } });
      expect(orgIncidentEventFromRow(row)).toEqual(x);
    }
    for (const x of departures)
      expect(orgDepartureFromRow(await prisma.orgDeparture.findUniqueOrThrow({ where: { id: x.id } }))).toEqual(x);
  });

  it('refuses an incident with an unknown severity', async () => {
    const i = { ...incidents[0], id: '01a0ea3a-e128-76e4-9de3-0c10000000ff', slug: 'bad', severity: 'blue' };
    await expect(prisma.orgIncident.create({ data: orgIncidentToRow(i as OrgIncident) })).rejects.toThrow(
      /org_incident_severity_check/,
    );
  });

  it('refuses a re-score with no source run', async () => {
    const rescore = runs.find((r) => r.origin === 'rescore')!;
    const r = { ...rescore, id: '01a0ea3a-e128-76e4-9de1-e7c1000000fe', sourceRunId: undefined };
    await expect(prisma.evalRun.create({ data: evalRunToRow(r) })).rejects.toThrow(/eval_run_values_check/);
  });

  it('refuses a measured result with no run', async () => {
    const measured = results.find((r) => r.origin === 'measured')!;
    const r = { ...measured, id: '01a0ea3a-e128-76e4-9de2-5e00000000fe', evalRunId: undefined };
    await expect(prisma.evalResult.create({ data: evalResultToRow(r) })).rejects.toThrow(
      /eval_result_measured_run_check/,
    );
  });

  it('refuses a reported result with no source', async () => {
    const r = { ...results[0], id: '01a0ea3a-e128-76e4-9de2-5e00000000ff', source: undefined };
    await expect(prisma.evalResult.create({ data: evalResultToRow(r) })).rejects.toThrow(/eval_result_reported_check/);
  });

  it('refuses a private eval with no owner', async () => {
    const e = {
      ...evals[1],
      id: '01a0ea3a-e128-76e4-9de2-e7a1000000ff',
      slug: 'no-owner',
      visibility: 'private' as const,
    };
    await expect(prisma.eval.create({ data: evalToRow(e) })).rejects.toThrow(/eval_owner_check/);
  });

  it('keeps an unlisted eval with no owner', async () => {
    const e = {
      ...evals[1],
      id: '01a0ea3a-e128-76e4-9de2-e7a1000000fe',
      slug: 'unlisted-no-owner',
      visibility: 'unlisted' as const,
    };
    await prisma.eval.create({ data: evalToRow(e) });
    expect((await prisma.eval.findUnique({ where: { id: e.id } }))?.visibility).toBe('unlisted');
  });

  it('refuses a published version with no publish time', async () => {
    const v = { ...versions[1], id: '01a0ea3a-e128-76e4-9de2-e7b1000000ff', version: '9.9' };
    await expect(prisma.evalVersion.create({ data: { ...evalVersionToRow(v), publishedAt: null } })).rejects.toThrow(
      /eval_version_status_check/,
    );
  });

  it('refuses a parent without a relation', async () => {
    const [parent] = models;
    const child = {
      ...models[1],
      id: '01a0ea3a-e128-76e4-9de2-0694f2ad7ca8',
      name: 'x/child',
      parentRelation: undefined,
    };
    await expect(prisma.model.create({ data: modelToRow({ ...child, parentId: parent.id }) })).rejects.toThrow(
      /model_parent_check/,
    );
  });
});
