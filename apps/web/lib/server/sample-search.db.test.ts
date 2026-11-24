import { prisma } from '@/lib/db';
import { newId } from '@/lib/ids';
import type { DisplayRule } from '@openaudit/spec';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { evalSampleList } from './runs';
import type { SampleAccess } from './terms';

// Own rows only, with new ids: other db test files run at the same time.
const ids = { organization: newId(), model: newId(), eval: newId(), version: newId(), run: newId() };
const samples = [newId(), newId()];
const version = { id: ids.version };

const reader = (...rules: DisplayRule[]) => ({ canRead: (r: DisplayRule) => rules.includes(r) }) as SampleAccess;
const anon = reader('open', 'scores_only');
const signedIn = reader('open', 'scores_only', 'sign_in');
const found = async (search: string, access = anon) =>
  (await evalSampleList(version, access, 0, 'source', search)).map((s) => s.sourceId);

describe('sample search', () => {
  beforeAll(async () => {
    await prisma.organization.create({
      data: { id: ids.organization, slug: `org-${ids.organization}`, displayName: 'Test Org' },
    });
    await prisma.model.create({
      data: {
        id: ids.model,
        source: 'api',
        name: `test/${ids.model}`,
        displayName: 'Test Model',
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
      data: ['alpha-1', 'beta-2'].map((sourceId, i) => ({
        id: samples[i],
        evalVersionId: ids.version,
        split: 'test',
        sourceId,
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
      data: [
        { input: 'The tax on imported bananas went up.', display: null },
        { input: 'Climate change moves the river water.', display: 'sign_in' },
      ].map((a, i) => ({
        runId: ids.run,
        ordinal: i + 1,
        sampleId: String(i),
        epoch: 1,
        status: 'success',
        evalSampleId: samples[i],
        passed: true,
        ...a,
      })),
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

  it('sets the search words from the new attempts', async () => {
    const rows = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM eval_sample WHERE id = ANY(${samples}::uuid[]) AND search IS NOT NULL`;
    expect(rows[0].n).toBe(2);
  });

  it('finds samples by their words, and all of them with no search', async () => {
    expect(await found('banana')).toEqual(['alpha-1']);
    expect(await found('"imported bananas"')).toEqual(['alpha-1']);
    expect(await found('bananas -tax')).toEqual([]);
    expect(await found('')).toEqual(['alpha-1', 'beta-2']);
  });

  it('finds text only that the reader can read, and ids for all readers', async () => {
    expect(await found('river')).toEqual([]);
    expect(await found('river', signedIn)).toEqual(['beta-2']);
    expect(await found('BETA')).toEqual(['beta-2']);
  });

  it('takes % and _ in a search as text', async () => {
    expect(await found('%')).toEqual([]);
    expect(await found('a_1')).toEqual([]);
    expect(await found('a-1')).toEqual(['alpha-1']);
  });
});
