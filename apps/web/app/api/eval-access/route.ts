import { SUPPORT_EMAIL, TURNSTILE_ENABLED, TURNSTILE_SITE_KEY } from '@/lib/env';
import { EVAL_ACCESS_TURNSTILE_ACTION, readAttestation } from '@/lib/eval-attestation';
import { clientIp } from '@/lib/rate-limit';
import { CLEARANCE_COOKIE, CLEARANCE_DAYS, clearanceToken } from '@/lib/server/eval-clearance';
import { allow, tooMany } from '@/lib/server/limits';
import { verifyTurnstile } from '@/lib/server/turnstile';

// The statement form in our web pages: a person's statement and a browser check give a signed
// cookie that lets the browser read eval content for CLEARANCE_DAYS. AI agents get no cookie yet.

/** The Turnstile site key for the form (public), or null when the check is off. */
export function GET() {
  return Response.json(
    { siteKey: TURNSTILE_ENABLED ? TURNSTILE_SITE_KEY : null },
    { headers: { 'cache-control': 'public, max-age=300' } },
  );
}

export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  if (!(await allow('strict', 'eval-access', ip))) return tooMany();
  const attestation = readAttestation(request);
  if (!attestation.ok) return problem(400, attestation.error);
  if (attestation.value.client === 'ai')
    return problem(403, `Eval content is not open to AI agents yet. To ask for access, write to ${SUPPORT_EMAIL}.`);
  const input = (await request.json().catch(() => null)) as { turnstileToken?: unknown } | null;
  const token = typeof input?.turnstileToken === 'string' ? input.turnstileToken : null;
  if (!(await verifyTurnstile(token, EVAL_ACCESS_TURNSTILE_ACTION, ip)))
    return problem(403, 'The browser check failed. Try again.');
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return Response.json(
    { ok: true, days: CLEARANCE_DAYS },
    {
      headers: {
        'cache-control': 'no-store',
        'set-cookie': `${CLEARANCE_COOKIE}=${await clearanceToken()}; Path=/; Max-Age=${CLEARANCE_DAYS * 86400}; HttpOnly; SameSite=Lax${secure}`,
      },
    },
  );
}

function problem(status: number, error: string) {
  return Response.json({ error }, { status, headers: { 'cache-control': 'no-store' } });
}
