import { beforeEach, describe, expect, it, vi } from 'vitest';

const ctx = vi.hoisted(() => ({
  viewer: null as { role: string; banned: boolean } | null,
  headers: new Headers(),
  cookie: undefined as string | undefined,
  turnstile: true,
  allow: true,
}));
vi.mock('@/lib/env', async (actual) => ({ ...(await actual()), BETTER_AUTH_SECRET: 'test-secret' }));
vi.mock('@/lib/server/viewer', () => ({ getViewer: async () => ctx.viewer }));
vi.mock('next/headers', () => ({
  headers: async () => ctx.headers,
  cookies: async () => ({ get: () => (ctx.cookie ? { value: ctx.cookie } : undefined) }),
}));
vi.mock('@/lib/server/turnstile', () => ({ verifyTurnstile: async () => ctx.turnstile }));
vi.mock('@/lib/server/limits', () => ({
  allow: async () => ctx.allow,
  tooMany: () => new Response(null, { status: 429 }),
}));

import { POST } from '@/app/api/eval-access/route';
import { attestationHeaders, NO_TRAINING_HEADER } from '@/lib/eval-attestation';
import { CLEARANCE_COOKIE, clearanceOk, clearanceToken, hasEvalClearance } from './eval-clearance';

beforeEach(() => {
  Object.assign(ctx, { viewer: null, headers: new Headers(), cookie: undefined, turnstile: true, allow: true });
});

describe('clearance token', () => {
  it('passes until it expires', async () => {
    const token = await clearanceToken(0);
    expect(await clearanceOk(token, 29 * 864e5)).toBe(true);
    expect(await clearanceOk(token, 31 * 864e5)).toBe(false);
  });

  it('fails when changed or empty', async () => {
    const [body, sig] = (await clearanceToken()).split('.');
    const other = btoa(JSON.stringify({ c: 'human', x: Date.now() + 1e12 })).replace(/=+$/, '');
    expect(await clearanceOk(`${other}.${sig}`)).toBe(false);
    expect(await clearanceOk(`${body}.${sig.slice(0, -2)}`)).toBe(false);
    expect(await clearanceOk(undefined)).toBe(false);
    expect(await clearanceOk('junk')).toBe(false);
  });

  it('fails for an older statement, even when signed', async () => {
    const b64 = (b: Uint8Array) =>
      btoa(String.fromCharCode(...b))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    const body = b64(new TextEncoder().encode(JSON.stringify({ c: 'human', x: Date.now() + 1e9 })));
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode('test-secret'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = new Uint8Array(
      await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`eval-clearance:${body}`)),
    );
    expect(await clearanceOk(`${body}.${b64(sig)}`)).toBe(false);
  });
});

describe('hasEvalClearance', () => {
  it('lets staff in with any client', async () => {
    ctx.viewer = { role: 'moderator', banned: false };
    ctx.headers = new Headers({ 'x-api-key': 'k' });
    expect(await hasEvalClearance()).toBe(true);
  });

  it('needs the cookie for other readers', async () => {
    expect(await hasEvalClearance()).toBe(false);
    ctx.cookie = await clearanceToken();
    expect(await hasEvalClearance()).toBe(true);
  });

  it('refuses an API key that is not staff, even with the cookie', async () => {
    ctx.viewer = { role: 'user', banned: false };
    ctx.headers = new Headers({ 'x-api-key': 'k' });
    ctx.cookie = await clearanceToken();
    expect(await hasEvalClearance()).toBe(false);
  });

  it('refuses banned staff', async () => {
    ctx.viewer = { role: 'admin', banned: true };
    expect(await hasEvalClearance()).toBe(false);
  });
});

describe('POST /api/eval-access', () => {
  const post = (headers: Record<string, string>) =>
    POST(
      new Request('https://openaudit.test/api/eval-access', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify({ turnstileToken: 't' }),
      }),
    );

  it('sets a signed cookie for a person', async () => {
    const res = await post(attestationHeaders({ client: 'human' }));
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(new RegExp(`^${CLEARANCE_COOKIE.replace('.', '\\.')}=`));
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain(`Max-Age=${30 * 86400}`);
    expect(await clearanceOk(cookie.split(';')[0].split('=')[1])).toBe(true);
  });

  it('refuses AI agents', async () => {
    const res = await post(attestationHeaders({ client: 'ai', agent: 'Bot (model) for Lab' }));
    expect(res.status).toBe(403);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('refuses without the promise', async () => {
    const { [NO_TRAINING_HEADER]: _, ...rest } = attestationHeaders({ client: 'human' });
    expect((await post(rest)).status).toBe(400);
  });

  it('refuses a failed browser check', async () => {
    ctx.turnstile = false;
    expect((await post(attestationHeaders({ client: 'human' }))).status).toBe(403);
  });

  it('refuses when rate limited', async () => {
    ctx.allow = false;
    expect((await post(attestationHeaders({ client: 'human' }))).status).toBe(429);
  });
});
