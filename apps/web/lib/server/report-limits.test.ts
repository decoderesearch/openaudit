import { beforeEach, describe, expect, it, vi } from 'vitest';

const count = vi.fn();
vi.mock('@/lib/db', () => ({ prisma: { submission: { count: (...a: unknown[]) => count(...a) } } }));

const { reportLimitError, REPORTS_PER_HOUR } = await import('./report-limits');

describe('reportLimitError', () => {
  beforeEach(() => count.mockReset());

  it('counts the submissions of the last hour', async () => {
    count.mockResolvedValue(REPORTS_PER_HOUR - 1);
    expect(await reportLimitError()).toBeNull();
    const where = count.mock.calls[0][0].where;
    expect(Date.now() - where.createdAt.gt.getTime()).toBeCloseTo(60 * 60 * 1000, -3);
  });

  it('refuses at the hourly total', async () => {
    count.mockResolvedValue(REPORTS_PER_HOUR);
    expect(await reportLimitError()).toMatch(/last hour/);
  });
});
