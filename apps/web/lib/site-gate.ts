// The password gate in front of the whole site, until launch. The Worker entry (`worker.ts`) runs
// it before Next. Off when SITE_PASSWORD is not set. Static assets do not reach the Worker, so
// they stay public. Wrangler bundles this file outside Next, so it imports no `@/` paths.

import { ATTESTED_FLAG, CLEARANCE_COOKIE, CLEARANCE_DAYS, signClearance } from './clearance-token';

type Limiter = { limit(options: { key: string }): Promise<{ success: boolean }> };
/** `SITE_LINK_KEY`: the key of the unlock link. Off when not set. */
export type GateEnv = {
  SITE_PASSWORD?: string;
  SITE_LINK_KEY?: string;
  BETTER_AUTH_SECRET?: string;
  RATE_LIMIT_STRICT?: Limiter;
};

export const UNLOCK_PATH = '/unlock';
/** `?unlock=<SITE_LINK_KEY>` on any page sets a cookie, then sends the visitor to the page without
 * it. That cookie fails when the key or the password changes. We give the link only to people, so
 * it also sets the eval clearance and the statement. */
export const UNLOCK_PARAM = 'unlock';
export const GATE_COOKIE = 'oa_gate';
const MAX_AGE = 60 * 60 * 24 * 30;

/** Other services call these, and each checks its own secret. The unsubscribe links in emails
 * (`UNSUBSCRIBE_PATH`, `UNSUBSCRIBE_API` in lib/updates.ts) check their signed token. */
const OPEN_PATHS = new Set([
  '/api/runner/notify',
  '/api/runner/digest',
  '/api/resend/webhook',
  '/updates/unsubscribe',
  '/api/updates/unsubscribe',
]);

/** The cookie value for `password`. A new password makes old cookies fail. */
export async function gateToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode('openaudit-site-gate')));
  return btoa(String.fromCharCode(...mac))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function cookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

/** A path on this site only, so the form cannot send people to another site. */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  return next.startsWith(UNLOCK_PATH) ? '/' : next;
}

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const NO_STORE = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' };

function page(next: string, error: string | null, status: number): Response {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>OpenAudit</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;font:14px/1.5 system-ui,-apple-system,sans-serif;color:#0f172a}
form{width:min(20rem,calc(100vw - 2rem));padding:1.5rem;border:1px solid #e2e8f0;border-radius:.75rem;background:#fff;box-shadow:0 1px 2px rgb(0 0 0/.05)}
h1{margin:0 0 .25rem;font-size:1.125rem}p{margin:0 0 1rem;color:#64748b}
input,button{box-sizing:border-box;width:100%;padding:.5rem .75rem;border-radius:.5rem;font:inherit}
input{border:1px solid #cbd5e1;margin-bottom:.75rem}input:focus{outline:2px solid #0369a1;outline-offset:1px}
button{border:0;background:#0369a1;color:#fff;font-weight:600;cursor:pointer}button:hover{background:#075985}
.error{color:#b91c1c;margin:-.25rem 0 .75rem}
</style></head><body>
<form method="post" action="${UNLOCK_PATH}">
<h1>OpenAudit</h1><p>This site is not public yet. Enter the password to continue.</p>
<input type="hidden" name="next" value="${escape(next)}">
<label for="password" style="position:absolute;left:-9999px">Password</label>
<input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
${error ? `<p class="error" role="alert">${escape(error)}</p>` : ''}<button type="submit">Continue</button>
</form></body></html>`;
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', ...NO_STORE } });
}

function redirect(to: string, cookies: string[] = []): Response {
  const headers = new Headers({ location: to, ...NO_STORE });
  for (const c of cookies) headers.append('set-cookie', c);
  return new Response(null, { status: 303, headers });
}

/** No `Secure` on http, so that a local preview can set cookies too. */
const attrs = (url: URL, maxAge: number, httpOnly = true) =>
  `Path=/; Max-Age=${maxAge}${httpOnly ? '; HttpOnly' : ''}${url.protocol === 'https:' ? '; Secure' : ''}; SameSite=Lax`;

const setCookie = (url: URL, token: string) => `${GATE_COOKIE}=${token}; ${attrs(url, MAX_AGE)}`;

/** The gate cookie, and the eval clearance when the secret is set. */
async function linkCookies(url: URL, linkToken: string, env: GateEnv): Promise<string[]> {
  const out = [setCookie(url, linkToken)];
  if (!env.BETTER_AUTH_SECRET) return out;
  const clearance = await signClearance(env.BETTER_AUTH_SECRET);
  out.push(
    `${CLEARANCE_COOKIE}=${clearance}; ${attrs(url, CLEARANCE_DAYS * 86400)}`,
    `${ATTESTED_FLAG}=1; ${attrs(url, 86400, false)}`,
  );
  return out;
}

/** False when this IP made too many password tries. */
const allowed = async (request: Request, env: GateEnv) =>
  (await env.RATE_LIMIT_STRICT?.limit({ key: `gate:${request.headers.get('cf-connecting-ip') ?? 'unknown'}` }).then(
    (r) => r.success,
    () => true,
  )) !== false;

/**
 * Null: let the request through. Else the response: the password page, the result of the form,
 * or a redirect to the page.
 */
export async function siteGate(request: Request, env: GateEnv): Promise<Response | null> {
  const password = env.SITE_PASSWORD;
  if (!password) return null;
  const url = new URL(request.url);
  if (OPEN_PATHS.has(url.pathname)) return null;
  const token = await gateToken(password);
  const linkKey = env.SITE_LINK_KEY;
  const linkToken = linkKey ? await gateToken(`${password}\n${linkKey}`) : null;
  const given = cookie(request, GATE_COOKIE) ?? '';
  const unlocked = same(given, token) || (!!linkToken && same(given, linkToken));
  const read = request.method === 'GET' || request.method === 'HEAD';

  const param = url.searchParams.get(UNLOCK_PARAM);
  if (linkKey && linkToken && param !== null && read) {
    url.searchParams.delete(UNLOCK_PARAM);
    const clean = safeNext(url.pathname + url.search);
    if (!(await allowed(request, env))) {
      return unlocked ? redirect(clean) : page(clean, 'Too many tries. Wait a minute, then try again.', 429);
    }
    const right = same(await gateToken(param), await gateToken(linkKey));
    return right ? redirect(clean, await linkCookies(url, linkToken, env)) : redirect(clean);
  }

  if (url.pathname === UNLOCK_PATH) {
    if (request.method === 'POST') {
      const form = await request.formData().catch(() => null);
      const next = safeNext(form?.get('next')?.toString() ?? null);
      if (!(await allowed(request, env))) return page(next, 'Too many tries. Wait a minute, then try again.', 429);
      const given = form?.get('password')?.toString() ?? '';
      if (!same(await gateToken(given), token)) return page(next, 'That password is not correct.', 401);
      return redirect(next, [setCookie(url, token)]);
    }
    const next = safeNext(url.searchParams.get('next'));
    return unlocked ? redirect(next) : page(next, null, 200);
  }

  if (unlocked) return null;
  if (read) return redirect(`${UNLOCK_PATH}?next=${encodeURIComponent(url.pathname + url.search)}`);
  return new Response('This site is not public yet.', { status: 401, headers: NO_STORE });
}
