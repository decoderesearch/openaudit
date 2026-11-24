// The signed eval clearance token. The server (`lib/server/eval-clearance.ts`) and the site gate
// (`lib/site-gate.ts`) both use it. No imports: wrangler bundles the gate outside Next.

export const CLEARANCE_COOKIE = 'openaudit.eval_clearance';
export const CLEARANCE_DAYS = 30;
/** Increase it when the statement changes, so that readers make the new one. */
const STATEMENT = 2;

/** A cookie that scripts can read. The browser then saves its copy of the statement. */
export const ATTESTED_FLAG = 'openaudit.attested';

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

function fromB64url(s: string): Uint8Array {
  return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
}

async function hmac(secret: string, body: string): Promise<Uint8Array> {
  if (!secret) throw new Error('BETTER_AUTH_SECRET is not set.');
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`eval-clearance:${body}`)));
}

/** A signed token for a person who made the statement. */
export async function signClearance(secret: string, now = Date.now()): Promise<string> {
  const body = b64url(
    new TextEncoder().encode(JSON.stringify({ c: 'human', s: STATEMENT, x: now + CLEARANCE_DAYS * 864e5 })),
  );
  return `${body}.${b64url(await hmac(secret, body))}`;
}

/** True when the token is ours, for the current statement, and not expired. */
export async function checkClearance(secret: string, token: string | undefined, now = Date.now()): Promise<boolean> {
  const [body, sig] = token?.split('.') ?? [];
  if (!body || !sig) return false;
  try {
    const want = await hmac(secret, body);
    const got = fromB64url(sig);
    let diff = want.length ^ got.length;
    for (let i = 0; i < want.length; i++) diff |= want[i] ^ (got[i] ?? 0);
    if (diff) return false;
    const { c, s, x } = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    return c === 'human' && s === STATEMENT && typeof x === 'number' && x > now;
  } catch {
    return false;
  }
}
