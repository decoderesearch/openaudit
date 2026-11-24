import { prisma } from '@/lib/db';
import { inboxKey } from '@/lib/email/address';
import { sendEmail } from '@/lib/email/send';
import { updatesConfirmEmail } from '@/lib/email/templates';
import { NEXT_PUBLIC_URL, TURNSTILE_ENABLED, TURNSTILE_SITE_KEY } from '@/lib/env';
import { clientIp } from '@/lib/rate-limit';
import { allow, tooMany } from '@/lib/server/limits';
import { verifyTurnstile } from '@/lib/server/turnstile';
import { confirmToken, unsubscribeToken, updatesBlocked, updatesOff } from '@/lib/server/updates';
import {
  parseEmail,
  parseLists,
  SUBSCRIBE_TURNSTILE_ACTION,
  UNSUBSCRIBE_API,
  UNSUBSCRIBE_PATH,
  UPDATE_LISTS,
} from '@/lib/updates';

// The navbar's Subscribe form, for visitors who are not signed in: 1 a minute per IP, a Turnstile
// check and a per-inbox limit, then an email with a confirm link (double opt-in). Nothing changes
// in Resend until the person confirms. An address that unsubscribed gets no email.

const PER_HOUR = 3;
const PER_DAY = 10;

/** The Turnstile site key for the form (public), or null when the check is off. */
export function GET() {
  return Response.json(
    { siteKey: TURNSTILE_ENABLED ? TURNSTILE_SITE_KEY : null },
    { headers: { 'cache-control': 'public, max-age=300' } },
  );
}

export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  if (!(await allow('once', 'subscribe', ip))) return tooMany();
  const off = updatesOff();
  if (off) return problem(503, off);
  const input = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = parseEmail(input?.email);
  if (!email) return problem(400, 'Give a valid email address.');
  const lists = parseLists(input?.lists);
  if (!lists.length) return problem(400, 'Pick at least one list.');
  const token = typeof input?.turnstileToken === 'string' ? input.turnstileToken : null;
  if (!(await verifyTurnstile(token, SUBSCRIBE_TURNSTILE_ACTION, ip)))
    return problem(403, 'The browser check failed. Try again.');
  const now = Date.now();
  const [day, hour] = await Promise.all(
    [864e5, 36e5].map((ms) =>
      prisma.emailLog.count({
        where: { type: 'updates_confirm', toKey: inboxKey(email), sentAt: { gte: new Date(now - ms) } },
      }),
    ),
  );
  if (hour >= PER_HOUR || day >= PER_DAY)
    return problem(429, 'We sent several emails to this address. Look for them, or try again later.');
  const url = `${NEXT_PUBLIC_URL}/updates/confirm?t=${await confirmToken({ email, lists })}`;
  const labels = UPDATE_LISTS.filter((l) => lists.includes(l.id)).map((l) => l.label);
  try {
    // The same reply as a sent email, so that the form does not tell who unsubscribed.
    if (await updatesBlocked(email)) return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
    const t = await unsubscribeToken(email);
    await sendEmail(
      email,
      'updates_confirm',
      updatesConfirmEmail(url, labels, {
        unsubscribe: `${NEXT_PUBLIC_URL}${UNSUBSCRIBE_PATH}?t=${t}`,
        oneClick: `${NEXT_PUBLIC_URL}${UNSUBSCRIBE_API}?t=${t}`,
      }),
    );
  } catch (e) {
    console.error('[updates] confirm email failed', e);
    return problem(502, 'We could not send the email. Try again later.');
  }
  return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}

function problem(status: number, error: string) {
  return Response.json({ error }, { status, headers: { 'cache-control': 'no-store' } });
}
