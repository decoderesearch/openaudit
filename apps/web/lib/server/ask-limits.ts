import { prisma } from '@/lib/db';
import { ASK_DAILY_PER_IP, ASK_GLOBAL_DAILY } from '@/lib/env';
import { ipBucket } from '@/lib/rate-limit';
import { allow } from '@/lib/server/limits';

// Limits for /api/ask, which spends our Anthropic key. Per IP: Cloudflare's `strict` binding (10 a
// minute), and a daily count. For all: a daily count, which is the limit that caps the bill. The
// daily counts are in Postgres (`AskCount`); if Postgres fails, the route refuses.

/** Longest question, in characters. */
export const MAX_MESSAGE_CHARS = 4000;
/** Messages kept from the end of the thread. */
export const MAX_MESSAGES = 12;
export const MAX_OUTPUT_TOKENS = 1500;

export type LimitVerdict = { ok: true } | { ok: false; reason: string; retryAfter: number };

const BUSY: LimitVerdict = {
  ok: false,
  reason: 'The assistant cannot count questions now. Try again in a minute.',
  retryAfter: 60,
};

/** A hash of the IP bucket and the day: the table keeps no address, and a hash is not the same
 * on two days. */
async function ipKey(ip: string, day: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`ask:${day}:${ipBucket(ip)}`));
  return [...new Uint8Array(bytes).slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Adds one to the count of `bucket` today, and returns the new count. */
async function count(day: string, bucket: string): Promise<number> {
  const [row] = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO ask_count (day, bucket, count) VALUES (${day}::date, ${bucket}, 1)
    ON CONFLICT (day, bucket) DO UPDATE SET count = ask_count.count + 1
    RETURNING count`;
  return row.count;
}

/** Seconds to the next UTC midnight. */
const toMidnight = (now: Date) =>
  Math.max(
    1,
    Math.ceil((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime()) / 1000),
  );

export async function checkAskLimit(ip: string, now = new Date()): Promise<LimitVerdict> {
  if (!(await allow('strict', 'ask', ipBucket(ip)))) {
    return {
      ok: false,
      reason: 'That is many questions in one minute. Wait a minute, then ask again.',
      retryAfter: 60,
    };
  }
  const day = now.toISOString().slice(0, 10);
  const retryAfter = toMidnight(now);
  try {
    if ((await count(day, await ipKey(ip, day))) > ASK_DAILY_PER_IP) {
      return { ok: false, reason: `That is ${ASK_DAILY_PER_IP} questions today. Try again tomorrow.`, retryAfter };
    }
    // Only after the per-IP check passes: a refused request must not spend the shared budget.
    if ((await count(day, 'all')) > ASK_GLOBAL_DAILY) {
      console.warn(`[ask] global daily budget of ${ASK_GLOBAL_DAILY} used`);
      return {
        ok: false,
        reason: 'The assistant has answered all the questions it can today. Try again tomorrow.',
        retryAfter,
      };
    }
    // About one question in 50 deletes the rows of past days.
    if (Math.random() < 0.02) await prisma.$executeRaw`DELETE FROM ask_count WHERE day < ${day}::date - 1`;
  } catch (error) {
    console.error('[ask] daily count failed', error);
    return BUSY;
  }
  return { ok: true };
}
