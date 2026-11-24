import { TURNSTILE_ENABLED, TURNSTILE_SECRET_KEY, TURNSTILE_TEST_SECRET } from '@/lib/env';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Checks a Turnstile token with Cloudflare. True when Turnstile is off. A token works once. */
export async function verifyTurnstile(token: string | null | undefined, action: string, ip: string): Promise<boolean> {
  if (!TURNSTILE_ENABLED) return true;
  if (!token) return false;
  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      body: new URLSearchParams({ secret: TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
    });
    const data = (await res.json()) as { success?: boolean; action?: string };
    return data.success === true && (TURNSTILE_TEST_SECRET || data.action === action);
  } catch (e) {
    console.error('[turnstile] verify failed', e);
    return false;
  }
}
