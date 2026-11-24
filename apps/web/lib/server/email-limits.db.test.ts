import { prisma } from '@/lib/db';
import { inboxKey } from '@/lib/email/address';
import { SIGN_IN_EMAILS_PER_DAY } from '@/lib/env';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { SIGN_IN_EMAIL_LIMITS, signInEmailBlock } from './email-limits';

const MINUTE = 60 * 1000;
const now = new Date('2026-09-28T12:00:00Z');
const ago = (minutes: number) => new Date(now.getTime() - minutes * MINUTE);

async function logSignInEmails(to: string, times: Date[]) {
  await prisma.emailLog.createMany({
    data: times.map((sentAt) => ({ to, toKey: inboxKey(to), type: 'magic_link', subject: 'Sign in', sentAt })),
  });
}

describe('signInEmailBlock', () => {
  beforeEach(async () => {
    await prisma.emailLog.deleteMany();
  });

  afterAll(async () => {
    await prisma.emailLog.deleteMany();
    await prisma.$disconnect();
  });

  it('allows a new inbox', async () => {
    expect(await signInEmailBlock('new@example.org', now)).toBeNull();
  });

  it('blocks an inbox after the hourly limit, and counts Gmail dots and +tags as one inbox', async () => {
    const n = SIGN_IN_EMAIL_LIMITS.perInboxPerHour;
    await logSignInEmails(
      'j.a.n.e+a@gmail.com',
      Array.from({ length: n }, (_, i) => ago(10 + i)),
    );
    expect(await signInEmailBlock('jane@gmail.com', now)).toBe('inbox');
    expect(await signInEmailBlock('other@gmail.com', now)).toBeNull();
  });

  it('allows the inbox again after an hour, until the daily limit', async () => {
    const n = SIGN_IN_EMAIL_LIMITS.perInboxPerHour;
    await logSignInEmails(
      'jane@example.org',
      Array.from({ length: n }, (_, i) => ago(61 + i)),
    );
    expect(await signInEmailBlock('jane@example.org', now)).toBeNull();
    const rest = SIGN_IN_EMAIL_LIMITS.perInboxPerDay - n;
    await logSignInEmails(
      'jane@example.org',
      Array.from({ length: rest }, (_, i) => ago(120 + i)),
    );
    expect(await signInEmailBlock('jane@example.org', now)).toBe('inbox');
    expect(await signInEmailBlock('jane@example.org', new Date(now.getTime() + 24 * 60 * MINUTE))).toBeNull();
  });

  it('pauses all sign-in email at the daily site cap', async () => {
    await prisma.emailLog.createMany({
      data: Array.from({ length: SIGN_IN_EMAILS_PER_DAY }, (_, i) => ({
        to: `bot${i}@example.org`,
        toKey: `bot${i}@example.org`,
        type: 'magic_link',
        subject: 'Sign in',
        sentAt: ago(1 + (i % 600)),
      })),
    });
    expect(await signInEmailBlock('someone-new@example.org', now)).toBe('site');
  });
});
