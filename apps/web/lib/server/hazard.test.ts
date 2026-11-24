import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  evalAttempt: { findMany: vi.fn() },
  openAuditSnippet: { findMany: vi.fn() },
  replySummary: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ prisma: db }));

import type { Hazard, SampleTerms } from '@openaudit/spec';
import cases from '../../../../spec/fixtures/hazard-levels.json';
import { attemptHazard, attemptHazards, lockedForPublic, publicLocked, runHazard } from './hazard';

describe('attemptHazards', () => {
  beforeEach(() => {
    db.openAuditSnippet.findMany.mockResolvedValue([
      { attemptId: 'a', category: 'harmful_requests', severity: 'high' },
      { attemptId: 'b', category: 'harmful_requests', severity: 'high' },
      { attemptId: 'c', category: 'child_safety', severity: 'medium' },
    ]);
    db.replySummary.findMany.mockResolvedValue([
      { attemptId: 'b', hazard: 'gated' },
      { attemptId: 'c', hazard: 'gated' },
      { attemptId: 'd', hazard: null },
    ]);
  });

  it("uses a summary's level in place of the computed one", async () => {
    const levels = await attemptHazards([
      { id: 'a', hazard: null },
      { id: 'b', hazard: null },
      { id: 'd', hazard: 'restricted' },
    ]);
    expect(levels.get('a')).toBe('restricted');
    expect(levels.get('b')).toBe('gated');
    expect(levels.get('d')).toBeNull();
  });

  it('still withholds a child safety snippet', async () => {
    expect((await attemptHazards([{ id: 'c', hazard: null }])).get('c')).toBe('withheld');
  });

  it('reads only summaries with an uplift label', async () => {
    await attemptHazards([{ id: 'a' }]);
    expect(db.replySummary.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { attemptId: { in: ['a'] }, uplift: { not: null } } }),
    );
  });
});

describe('runHazard', () => {
  it("uses each attempt's level, as attemptHazards gives it", async () => {
    db.evalAttempt.findMany.mockResolvedValueOnce([{ id: 'own', hazard: 'restricted' }]).mockResolvedValueOnce([
      { id: 'own', ordinal: 7 },
      { id: 'child', ordinal: 3 },
    ]);
    db.openAuditSnippet.findMany.mockResolvedValue([
      { attemptId: 'judged', category: 'bio_chem', severity: 'high' },
      { attemptId: 'child', category: 'child_safety', severity: 'medium' },
      { attemptId: 'open', category: 'manipulation', severity: 'medium' },
    ]);
    db.$queryRaw.mockResolvedValue([{ attemptId: 'judged', hazard: 'gated' }]);
    expect(await runHazard('run')).toEqual({
      level: 'withheld',
      attempts: [
        { id: 'child', ordinal: 3, level: 'withheld' },
        { id: 'own', ordinal: 7, level: 'restricted' },
      ],
    });
  });

  it('is open with no levels', async () => {
    db.evalAttempt.findMany.mockReset().mockResolvedValue([]);
    db.openAuditSnippet.findMany.mockResolvedValue([]);
    db.$queryRaw.mockResolvedValue([]);
    expect(await runHazard('run')).toEqual({ level: null, attempts: [] });
    expect(db.evalAttempt.findMany).toHaveBeenCalledTimes(1);
  });
});

describe('lockedForPublic', () => {
  const scoresOnly = { display: 'scores_only' } as SampleTerms;

  it('locks a level that only staff can read', () => {
    expect(lockedForPublic(null, null, null)).toBe(false);
    expect(lockedForPublic('gated', null, null)).toBe(false);
    expect(lockedForPublic('restricted', null, null)).toBe(true);
    expect(lockedForPublic('withheld', null, null)).toBe(true);
  });

  it('locks a reply that the terms show only as scores', () => {
    expect(lockedForPublic(null, scoresOnly, null)).toBe(true);
    expect(lockedForPublic(null, null, 'scores_only')).toBe(true);
    expect(lockedForPublic(null, scoresOnly, 'open')).toBe(false);
  });
});

type Case = (typeof cases.cases)[number] & { judged?: Hazard | null; display?: string; versionDisplay?: string };

describe('the levels that the runner also uses', () => {
  it.each(cases.cases.map((c) => [c.name, c as Case]))('%s', (_, c) => {
    const snippets = c.snippets.map(([category, severity]) => ({ category, severity }));
    const level = attemptHazard(c.own as Hazard | null, 'judged' in c ? c.judged : undefined, snippets);
    expect(level).toBe(c.level);
    const terms = c.versionDisplay ? ({ display: c.versionDisplay } as SampleTerms) : null;
    expect(lockedForPublic(level, terms, c.display ?? null)).toBe(c.locked);
  });
});

describe('publicLocked', () => {
  const hazard = { level: 'restricted' as const, attempts: [{ id: 'h', ordinal: 2, level: 'restricted' as const }] };

  it('adds the scores-only attempts', async () => {
    db.evalAttempt.findMany.mockResolvedValue([{ id: 's' }]);
    expect(await publicLocked('run', hazard, null)).toEqual(new Set(['h', 's']));
    expect(db.evalAttempt.findMany.mock.lastCall?.[0].where.OR).toEqual([{ display: 'scores_only' }]);
  });

  it("adds the attempts with no rule of their own when the version's rule is scores only", async () => {
    db.evalAttempt.findMany.mockResolvedValue([]);
    await publicLocked('run', hazard, { display: 'scores_only' } as SampleTerms);
    expect(db.evalAttempt.findMany.mock.lastCall?.[0].where.OR).toEqual([
      { display: 'scores_only' },
      { display: null },
    ]);
  });
});
