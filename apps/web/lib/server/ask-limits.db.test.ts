import { prisma } from '@/lib/db';
import { ASK_DAILY_PER_IP } from '@/lib/env';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { checkAskLimit } from './ask-limits';

const DAY = new Date('2026-01-02T12:00:00Z');
const clear = () => prisma.$executeRaw`DELETE FROM ask_count WHERE day = '2026-01-02'::date`;

describe('checkAskLimit', () => {
  beforeEach(clear);
  afterAll(clear);

  it('counts each IP on its own, and stops one at its daily cap', async () => {
    for (let i = 0; i < ASK_DAILY_PER_IP; i++) expect((await checkAskLimit('203.0.113.7', DAY)).ok).toBe(true);
    const over = await checkAskLimit('203.0.113.7', DAY);
    expect(over).toMatchObject({ ok: false, retryAfter: 12 * 3600 });
    expect((await checkAskLimit('203.0.113.8', DAY)).ok).toBe(true);
  });

  it('keeps no address, and counts all IPs together', async () => {
    await checkAskLimit('2001:db8:1:2:3:4:5:6', DAY);
    await checkAskLimit('2001:db8:1:2:ffff::1', DAY);
    const rows = await prisma.askCount.findMany({ where: { day: new Date('2026-01-02') } });
    expect(rows.find((r) => r.bucket === 'all')?.count).toBe(2);
    // The same /64: one row, with no part of the address.
    const ips = rows.filter((r) => r.bucket !== 'all');
    expect(ips).toHaveLength(1);
    expect(ips[0]).toMatchObject({ count: 2 });
    expect(ips[0].bucket).not.toContain('2001');
  });
});
