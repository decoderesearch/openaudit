import { afterEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  openAuditCard: { findUnique: vi.fn() },
  openAuditCardVersion: { findUniqueOrThrow: vi.fn() },
  openAuditSnippet: { findMany: vi.fn() },
  evalAttempt: { findMany: vi.fn(async () => []) },
  model: { findMany: vi.fn() },
}));
vi.mock('@/lib/db', () => ({ prisma: db }));
vi.mock('@/lib/server/catalog', () => ({ modelPath: (m: { name: string }) => `/${m.name}` }));
vi.mock('@/lib/server/latest-runs', () => ({ cardVersionRuns: async () => [] }));

import { getOpenAuditCard } from './openaudit-cards';

const row = (number: number, status: string) => ({
  id: `v${number}`,
  number,
  status,
  createdAt: new Date(),
  _count: { runs: 3 },
});

/** Returns the rows that the `where` of the versions query keeps, as the database does. */
function card(versions: ReturnType<typeof row>[]) {
  db.openAuditCard.findUnique.mockImplementation(async (q) => ({
    versions: versions.filter((v) => !q.include.versions.where || v.status === q.include.versions.where.status),
  }));
  db.openAuditCardVersion.findUniqueOrThrow.mockImplementation(async ({ where }) => {
    const v = versions.find((x) => x.id === where.id)!;
    return {
      ...v,
      aggregator: 'a',
      flagger: 'f',
      promptVersion: 'p',
      costUsd: 0.3,
      findings: [],
      verdicts: [],
      topics: [],
      gaps: [],
    };
  });
  db.openAuditSnippet.findMany.mockResolvedValue([]);
  db.model.findMany.mockResolvedValue([{ name: 'a', displayName: 'Model A' }]);
}

describe('getOpenAuditCard', () => {
  afterEach(() => vi.clearAllMocks());

  it('shows the public only published versions', async () => {
    card([row(14, 'draft'), row(13, 'discarded'), row(12, 'published')]);
    const c = await getOpenAuditCard('m');
    expect(c?.version.number).toBe(12);
    expect(c?.version).toMatchObject({ builtBy: 'Model A', flaggedBy: 'f' });
    expect(c?.latest).toBe(12);
    expect(c?.versions.map((v) => v.number)).toEqual([12]);
    expect(await getOpenAuditCard('m', 14)).toBeNull();
  });

  it('shows the public no card before the first publish', async () => {
    card([row(1, 'draft')]);
    expect(await getOpenAuditCard('m')).toBeNull();
  });

  it('gives an admin the published version first, drafts in the list, and a discarded one by number', async () => {
    card([row(14, 'draft'), row(13, 'discarded'), row(12, 'published')]);
    const c = await getOpenAuditCard('m', undefined, { drafts: true });
    expect(c?.version.number).toBe(12);
    expect(c?.versions.map((v) => [v.number, v.status])).toEqual([
      [14, 'draft'],
      [12, 'published'],
    ]);
    const old = await getOpenAuditCard('m', 13, { drafts: true });
    expect(old?.version.status).toBe('discarded');
    expect(old?.versions.map((v) => v.number)).toEqual([14, 13, 12]);
  });

  it('names the fallback flaggers that read blocked attempts', async () => {
    card([row(12, 'published')]);
    const base = db.openAuditCardVersion.findUniqueOrThrow.getMockImplementation()!;
    db.openAuditCardVersion.findUniqueOrThrow.mockImplementation(async (q) => ({
      ...(await base(q)),
      tokens: { flagger: { byFlagger: { f: 40, g: 2 } } },
    }));
    db.model.findMany.mockResolvedValue([{ name: 'g', displayName: 'Model G' }]);
    const c = await getOpenAuditCard('m');
    expect(c?.version.flaggedBy).toBe('f, Model G');
  });

  it('gives an admin the draft when nothing is published', async () => {
    card([row(1, 'draft')]);
    const c = await getOpenAuditCard('m', undefined, { drafts: true });
    expect(c?.version).toMatchObject({ number: 1, status: 'draft' });
    expect(c?.latest).toBeNull();
  });
});
