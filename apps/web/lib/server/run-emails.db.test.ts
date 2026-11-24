import { prisma } from '@/lib/db';
import { newId } from '@/lib/ids';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { estimateRun } from './estimates';
import { RUN_EMAILS_PER_DAY, sendRunEmail } from './run-emails';
import { cancelRun, ownRuns } from './runs';

// Own rows only, with new ids: other db test files run at the same time.
const ids = {
  organization: newId(),
  model: newId(),
  eval: newId(),
  version: newId(),
  shardVersion: newId(),
  owner: newId(),
  other: newId(),
};
const ownerEmail = `run-owner-${ids.owner}@example.org`;
const runIds: string[] = [];

async function makeRun(data: { status: string; ownerUserId?: string | null; [k: string]: unknown }) {
  const id = newId();
  runIds.push(id);
  await prisma.evalRun.create({
    data: {
      id,
      evalId: ids.eval,
      evalVersionId: ids.version,
      modelId: ids.model,
      origin: 'run',
      route: { kind: 'openrouter', model: 'test/model' },
      settings: {},
      visibility: 'public',
      ...data,
    },
  });
  return id;
}

const logRows = (runId: string) => prisma.emailLog.findMany({ where: { runId } });

describe('run emails, cancel and own runs', () => {
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
    await prisma.evalVersion.createMany({
      data: [
        { id: ids.version, evalId: ids.eval, version: '1', status: 'draft' },
        { id: ids.shardVersion, evalId: ids.eval, version: '2', status: 'draft' },
      ],
    });
    await prisma.user.createMany({
      data: [
        { id: ids.owner, name: 'Owner', email: ownerEmail },
        { id: ids.other, name: 'Other', email: `run-other-${ids.other}@example.org` },
      ],
    });
  });

  afterAll(async () => {
    await prisma.emailLog.deleteMany({ where: { runId: { in: runIds } } });
    await prisma.emailLog.deleteMany({ where: { to: ownerEmail } });
    await prisma.evalRun.deleteMany({ where: { id: { in: runIds } } });
    await prisma.evalVersion.deleteMany({ where: { id: { in: [ids.version, ids.shardVersion] } } });
    await prisma.eval.deleteMany({ where: { id: ids.eval } });
    await prisma.model.deleteMany({ where: { id: ids.model } });
    await prisma.organization.deleteMany({ where: { id: ids.organization } });
    await prisma.user.deleteMany({ where: { id: { in: [ids.owner, ids.other] } } });
    await prisma.$disconnect();
  });

  it('sends each type once per run, to the owner', async () => {
    const runId = await makeRun({ status: 'succeeded', ownerUserId: ids.owner, provenance: { costUsd: 0.5 } });
    expect(await sendRunEmail(runId, 'run_succeeded')).toBe('sent');
    expect(await sendRunEmail(runId, 'run_succeeded')).toBe('already_sent');
    expect(await sendRunEmail(runId, 'run_queued')).toBe('sent');
    const rows = await logRows(runId);
    expect(rows.map((r) => r.type).sort()).toEqual(['run_queued', 'run_succeeded']);
    expect(rows.every((r) => r.to === ownerEmail && r.error === null)).toBe(true);
  });

  it('sends nothing for a run with no owner, or no run', async () => {
    const runId = await makeRun({ status: 'failed' });
    expect(await sendRunEmail(runId, 'run_failed')).toBe('no_owner');
    expect(await sendRunEmail(newId(), 'run_failed')).toBe('no_run');
    expect(await logRows(runId)).toEqual([]);
  });

  it('stops at the daily cap for one inbox', async () => {
    const now = new Date();
    await prisma.emailLog.createMany({
      data: Array.from({ length: RUN_EMAILS_PER_DAY }, () => ({
        to: ownerEmail,
        toKey: ownerEmail,
        type: 'run_queued',
        subject: 'old',
        sentAt: now,
      })),
    });
    const runId = await makeRun({ status: 'failed', ownerUserId: ids.owner });
    expect(await sendRunEmail(runId, 'run_failed', now)).toBe('capped');
    expect(await sendRunEmail(runId, 'run_failed', new Date(now.getTime() + 25 * 3600 * 1000))).toBe('sent');
  });

  it('cancels an active run and its open shards, once', async () => {
    const runId = await makeRun({
      status: 'running',
      ownerUserId: ids.owner,
      leaseOwner: 'host:1',
      leaseExpiresAt: new Date(),
    });
    await prisma.evalRunShard.createMany({
      data: [
        {
          runId,
          ordinal: 1,
          sampleStart: 0,
          sampleEnd: 10,
          status: 'succeeded',
          connections: 16,
          capKey: 'openrouter',
        },
        { runId, ordinal: 2, sampleStart: 10, sampleEnd: 20, status: 'running', connections: 16, capKey: 'openrouter' },
        { runId, ordinal: 3, sampleStart: 20, sampleEnd: 30, status: 'queued', connections: 16, capKey: 'openrouter' },
      ],
    });
    expect(await cancelRun(runId)).toBe(true);
    expect(await cancelRun(runId)).toBe(false);
    const run = await prisma.evalRun.findUniqueOrThrow({ where: { id: runId }, include: { shards: true } });
    expect(run).toMatchObject({ status: 'cancelled', error: 'Cancelled by an admin.', leaseOwner: null });
    expect(run.finishedAt).not.toBeNull();
    expect(run.shards.map((s) => s.status).sort()).toEqual(['cancelled', 'cancelled', 'succeeded']);
  });

  it("lists only the user's own runs", async () => {
    const mine = await makeRun({ status: 'queued', ownerUserId: ids.other });
    await makeRun({ status: 'queued', ownerUserId: null });
    const runs = await ownRuns(ids.other);
    expect(runs.map((r) => r.run.id)).toEqual([mine]);
  });

  it('estimates from past runs of the version', async () => {
    const settings = { limit: 64 };
    expect(await estimateRun({ evalId: ids.eval, evalVersionId: ids.version, settings })).toBeNull();
    const startedAt = new Date('2026-09-01T00:00:00Z');
    // 160 samples on 16 calls in 220 s: 20 s startup, then 10 waves of 20 s.
    await makeRun({
      status: 'succeeded',
      startedAt,
      finishedAt: new Date(startedAt.getTime() + 220_000),
      attemptCount: 160,
      sampleCount: 160,
    });
    // 64 samples on 64 calls: one wave.
    expect(await estimateRun({ evalId: ids.eval, evalVersionId: ids.version, settings })).toBe(40);
    // No limit: the size of the last full run, 160 samples, in 3 waves.
    expect(await estimateRun({ evalId: ids.eval, evalVersionId: ids.version, settings: {} })).toBe(80);
  });

  it('times the shards, not the time the run waited for room', async () => {
    const startedAt = new Date('2026-09-01T00:00:00Z');
    const shardStart = new Date(startedAt.getTime() + 10 * 3600_000);
    const finishedAt = new Date(shardStart.getTime() + 220_000);
    // The run waited 10 h. Its shard did 160 samples on 16 calls in 220 s.
    const runId = await makeRun({
      evalVersionId: ids.shardVersion,
      status: 'succeeded',
      startedAt,
      finishedAt,
      attemptCount: 160,
      sampleCount: 160,
    });
    await prisma.evalRunShard.create({
      data: {
        runId,
        ordinal: 1,
        sampleStart: 0,
        sampleEnd: 160,
        status: 'succeeded',
        connections: 16,
        capKey: 'openrouter',
        attemptCount: 160,
        startedAt: shardStart,
        finishedAt,
      },
    });
    const settings = { limit: 64 };
    expect(await estimateRun({ evalId: ids.eval, evalVersionId: ids.shardVersion, settings })).toBe(40);
  });
});
