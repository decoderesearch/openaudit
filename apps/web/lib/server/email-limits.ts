import { prisma } from '@/lib/db';
import { inboxKey } from '@/lib/email/address';
import { sendEmail } from '@/lib/email/send';
import { adminAlertEmail } from '@/lib/email/templates';
import { SIGN_IN_EMAILS_PER_DAY } from '@/lib/env';
import { adminEmails } from '@/lib/server/admins';

// Limits on sign-in email, so a bot cannot use the sign-in form to fill someone's inbox.
// The CAPTCHA stops most bots; these stop the rest. Counts come from `EmailLog`.
export const SIGN_IN_EMAIL_LIMITS = {
  perInboxPerHour: 3,
  perInboxPerDay: 10,
} as const;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type SignInEmailBlock = 'inbox' | 'site';

/** Why a sign-in email to `email` must not be sent now, or null when it may be. */
export async function signInEmailBlock(email: string, now = new Date()): Promise<SignInEmailBlock | null> {
  const dayAgo = new Date(now.getTime() - DAY);
  const hourAgo = new Date(now.getTime() - HOUR);
  const toKey = inboxKey(email);
  const [site, inboxDay, inboxHour] = await Promise.all([
    prisma.emailLog.count({ where: { type: 'magic_link', sentAt: { gte: dayAgo } } }),
    prisma.emailLog.count({ where: { type: 'magic_link', toKey, sentAt: { gte: dayAgo } } }),
    prisma.emailLog.count({ where: { type: 'magic_link', toKey, sentAt: { gte: hourAgo } } }),
  ]);
  if (site >= SIGN_IN_EMAILS_PER_DAY) {
    await alertAdminsOnce(site, dayAgo);
    return 'site';
  }
  if (inboxHour >= SIGN_IN_EMAIL_LIMITS.perInboxPerHour || inboxDay >= SIGN_IN_EMAIL_LIMITS.perInboxPerDay) {
    return 'inbox';
  }
  return null;
}

// One alert per day at most, to every admin.
async function alertAdminsOnce(count: number, dayAgo: Date) {
  console.error(`[email] sign-in email paused: ${count} sent in 24 hours (cap ${SIGN_IN_EMAILS_PER_DAY})`);
  const already = await prisma.emailLog.count({ where: { type: 'admin_alert', sentAt: { gte: dayAgo } } });
  if (already) return;
  const to = await adminEmails();
  const content = adminAlertEmail({
    subject: 'Sign-in email is paused',
    lines: [
      `The site sent ${count} sign-in emails in the last 24 hours. The cap is ${SIGN_IN_EMAILS_PER_DAY}, so sign-in email is paused until the count falls.`,
      'This can be a bot that uses the sign-in form to send email to other people. Look at EmailLog for the addresses and times.',
      'If the traffic is real, raise SIGN_IN_EMAILS_PER_DAY.',
    ],
  });
  for (const address of to) {
    await sendEmail(address, 'admin_alert', content).catch((e) => console.error('[email] alert failed', e));
  }
}
