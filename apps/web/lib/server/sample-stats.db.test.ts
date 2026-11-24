import { prisma } from '@/lib/db';
import { newId } from '@/lib/ids';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Own rows only, with new ids: other db test files run at the same time.
const ids = { organization: newId(), modelA: newId(), modelB: newId(), eval: newId(), version: newId() };
const samples = [newId(), newId()];
const runIds: string[] = [];
let ordinal = 1;

async function makeRun(modelId: string, createdAt: string, passed: boolean[], extra: Record<string, unknown> = {}) {
  const id = newId();
  runIds.push(id);
  await prisma.evalRun.create({
    data: {
      id,
      evalId: ids.eval,
      evalVersionId: ids.version,
      modelId,
      origin: 'run',
      status: 'succeeded',
      route: { kind: 'openrouter', model: 'test/model' },
      visibility: 'public',
      createdAt: new Date(createdAt),
      ...extra,
    },
  });
  await prisma.evalAttempt.createMany({
    data: passed.map((p, i) => ({
      runId: id,
      ordinal: ordinal++,
      sampleId: String(i),
      epoch: 1,
      status: 'success',
      evalSampleId: samples[i],
      passed: p,
    })),
  });
  return id;
}

const stats = async () => {
  await prisma.$queryRaw`SELECT refresh_sample_stats(${ids.version}::uuid)`;
  const rows = await prisma.evalSample.findMany({ where: { id: { in: samples } } });
  return samples.map((id) => {
    const s = rows.find((r) => r.id === id)!;
    return [s.graded, s.failed];
  });
};

describe('refresh_sample_stats', () => {
  beforeAll(async () => {
    await prisma.organization.create({
      data: { id: ids.organization, slug: `org-${ids.organization}`, displayName: 'Test Org' },
    });
    await prisma.model.createMany({
      data: [ids.modelA, ids.modelB].map((id) => ({
        id,
        source: 'api',
        name: `test/${id}`,
        displayName: 'Test Model',
        organizationId: ids.organization,
      })),
    });
    await prisma.eval.create({
      data: {
        id: ids.eval,
        slug: `eval-${ids.eval}`,
        displayName: 'Test Eval',
        access: 'public',
        status: 'active',
        adversarial: false,
        humanParticipants: false,
        visibility: 'public',
      },
    });
    await prisma.evalVersion.create({ data: { id: ids.version, evalId: ids.eval, version: '1', status: 'draft' } });
    await prisma.evalSample.createMany({
      data: samples.map((id, i) => ({
        id,
        evalVersionId: ids.version,
        split: 'test',
        sourceId: String(i),
        sha256: String(i).repeat(64),
      })),
    });
  });

  afterAll(async () => {
    await prisma.evalAttempt.deleteMany({ where: { runId: { in: runIds } } });
    await prisma.evalRun.deleteMany({ where: { id: { in: runIds }, origin: 'rescore' } });
    await prisma.evalRun.deleteMany({ where: { id: { in: runIds } } });
    await prisma.evalSample.deleteMany({ where: { id: { in: samples } } });
    await prisma.evalVersion.deleteMany({ where: { id: ids.version } });
    await prisma.eval.deleteMany({ where: { id: ids.eval } });
    await prisma.model.deleteMany({ where: { id: { in: [ids.modelA, ids.modelB] } } });
    await prisma.organization.deleteMany({ where: { id: ids.organization } });
    await prisma.$disconnect();
  });

  it('counts a re-score in place of its source run, and a newer run over an older re-score', async () => {
    const oldA = await makeRun(ids.modelA, '2026-10-01', [false, false]);
    await makeRun(ids.modelB, '2026-10-01', [false, true]);
    expect(await stats()).toEqual([
      [2, 2],
      [2, 1],
    ]);

    await makeRun(ids.modelA, '2026-10-05', [true, false], { origin: 'rescore', sourceRunId: oldA });
    expect(await stats()).toEqual([
      [2, 1],
      [2, 1],
    ]);

    const newA = await makeRun(ids.modelA, '2026-10-03', [true, true]);
    expect(await stats()).toEqual([
      [2, 1],
      [2, 0],
    ]);

    await makeRun(ids.modelA, '2026-10-04', [false, false], { origin: 'rescore', sourceRunId: newA, status: 'failed' });
    expect(await stats()).toEqual([
      [2, 1],
      [2, 0],
    ]);
  });
});
