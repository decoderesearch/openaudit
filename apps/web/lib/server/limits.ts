import { IS_WORKERS } from '@/lib/platform';
import { clientIp } from '@/lib/rate-limit';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { headers } from 'next/headers';

// Per-IP limits from Cloudflare's rate-limiting bindings (`ratelimits` in wrangler.jsonc). Counts
// are per Cloudflare location and approximate. Off on Node. A missing or failing binding lets the
// request through, so a limiter outage cannot take the site down.

type Binding = { limit(options: { key: string }): Promise<{ success: boolean }> };

/** `strict`: requests that send an email. `once`: 1 a minute, for the Report and
 * Subscribe forms (each scope counts on its own). `eval`: eval content (excerpts, logs).
 * `general`: other calls. */
const BINDINGS = {
  strict: 'RATE_LIMIT_STRICT',
  once: 'RATE_LIMIT_ONCE',
  eval: 'RATE_LIMIT_EVAL',
  general: 'RATE_LIMIT_GENERAL',
} as const;
export type Limit = keyof typeof BINDINGS;

export const TOO_MANY = 'Too many requests. Wait a minute, then try again.';

/** True when `ip` is under `limit` for `scope`. Each scope counts on its own. */
export async function allow(limit: Limit, scope: string, ip: string): Promise<boolean> {
  if (!IS_WORKERS) return true;
  const binding = (getCloudflareContext().env as Record<string, Binding | undefined>)[BINDINGS[limit]];
  if (!binding) return true;
  try {
    return (await binding.limit({ key: `${scope}:${ip}` })).success;
  } catch (e) {
    console.error('[limits] rate limiter failed', e);
    return true;
  }
}

/** For server actions that read data: throws when the caller is over the `general` limit for
 * `scope`. The client shows its error state. */
export async function limitRead(scope: string): Promise<void> {
  if (IS_WORKERS && !(await allow('general', scope, await callerIp()))) throw new Error(TOO_MANY);
}

/** The caller's IP, for server actions. */
export async function callerIp(): Promise<string> {
  return clientIp(await headers());
}

export function tooMany(): Response {
  return Response.json({ error: TOO_MANY }, { status: 429, headers: { 'retry-after': '60' } });
}
