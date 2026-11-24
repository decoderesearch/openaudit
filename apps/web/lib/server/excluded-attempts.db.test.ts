import { Prisma } from '#prisma';
import { prisma } from '@/lib/db';
import { newId } from '@/lib/ids';
import { excludedAttempt, excludedAttempts } from '@/lib/server/excluded-attempts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Own rows only, with new ids: other db test files run at the same time.
const ids = { organization: newId(), model: newId(), eval: newId(), version: newId(), run: newId() };
const samples = [newId(), newId(), newId()];
const attempts = [newId(), newId(), newId()];

describe('excludedAttempts', () => {
  beforeAll(async () => {
    await prisma.organization.create({
      data: { id: ids.organization, slug: `org-${ids.organization}`, displayName: 'Test Org' },
    });
    await prisma.model.create({
      data: {
        id: ids.model,
        source: 'api',
        name: `test/${ids.model}`,
        displayName: 'M',
        organizationId: ids.organization,
      },
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
    await prisma.evalRun.create({
      data: {
        id: ids.run,
        evalId: ids.eval,
        evalVersionId: ids.version,
        modelId: ids.model,
        origin: 'run',
        status: 'succeeded',
        route: { kind: 'openrouter', model: 'test/model' },
        visibility: 'public',
      },
    });
    await prisma.evalAttempt.createMany({
      data: attempts.map((id, i) => ({
        id,
        runId: ids.run,
        ordinal: i + 1,
        sampleId: String(i),
        epoch: 1,
        status: 'success',
        evalSampleId: samples[i],
      })),
    });
    // Sample 0: a confirmed exclusion. Sample 1: only proposed. Sample 2: no issue.
    await prisma.evalSampleIssue.createMany({
      data: [
        { evalSampleId: samples[0]!, kind: 'label_error', status: 'confirmed', note: 'x', source: 'staff' },
        { evalSampleId: samples[1]!, kind: 'label_error', status: 'proposed', note: 'x', source: 'staff' },
      ],
    });
  });

  afterAll(async () => {
    await prisma.evalAttempt.deleteMany({ where: { runId: ids.run } });
    await prisma.evalRun.deleteMany({ where: { id: ids.run } });
    await prisma.evalSample.deleteMany({ where: { id: { in: samples } } });
    await prisma.evalVersion.deleteMany({ where: { id: ids.version } });
    await prisma.eval.deleteMany({ where: { id: ids.eval } });
    await prisma.model.deleteMany({ where: { id: ids.model } });
    await prisma.organization.deleteMany({ where: { id: ids.organization } });
    await prisma.$disconnect();
  });

  it('finds only the attempts of samples with a confirmed exclusion', async () => {
    expect([...(await excludedAttempts([...attempts, attempts[0]!]))]).toEqual([attempts[0]]);
    expect((await excludedAttempts([])).size).toBe(0);
  });

  it('gives the same answer as SQL', async () => {
    const rows = await prisma.$queryRaw<{ id: string; excluded: boolean }[]>`
      SELECT a.id::text AS id, ${excludedAttempt(Prisma.sql`a.id`)} AS excluded
      FROM eval_attempt a WHERE a."runId" = ${ids.run}::uuid ORDER BY a.ordinal`;
    expect(rows.map((r) => r.excluded)).toEqual([true, false, false]);
  });
});
