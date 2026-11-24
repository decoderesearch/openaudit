import { describe, expect, it, vi } from 'vitest';
import { ATTESTED_FLAG, checkClearance, CLEARANCE_COOKIE } from './clearance-token';
import { GATE_COOKIE, gateToken, safeNext, siteGate } from './site-gate';

const SITE = 'https://openaudit.com';
const env = { SITE_PASSWORD: 'hunter2' };
const get = (path: string, headers: Record<string, string> = {}) => new Request(SITE + path, { headers });
const post = (fields: Record<string, string>, headers: Record<string, string> = {}) =>
  new Request(`${SITE}/unlock`, { method: 'POST', body: new URLSearchParams(fields), headers });

describe('siteGate', () => {
  it('is off with no password', async () => {
    expect(await siteGate(get('/'), {})).toBeNull();
  });

  it('sends a visitor to the password page, and back after', async () => {
    const r = (await siteGate(get('/models?x=1'), env))!;
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe('/unlock?next=%2Fmodels%3Fx%3D1');
    const form = (await siteGate(get('/unlock?next=%2Fmodels%3Fx%3D1'), env))!;
    expect(form.status).toBe(200);
    expect(form.headers.get('x-robots-tag')).toContain('noindex');
    expect(await form.text()).toContain('value="/models?x=1"');
  });

  it('sets the cookie for the right password only', async () => {
    const bad = (await siteGate(post({ password: 'nope', next: '/models' }), env))!;
    expect(bad.status).toBe(401);
    expect(bad.headers.get('set-cookie')).toBeNull();
    const good = (await siteGate(post({ password: 'hunter2', next: '/models' }), env))!;
    expect(good.status).toBe(303);
    expect(good.headers.get('location')).toBe('/models');
    expect(good.headers.get('set-cookie')).toContain(`${GATE_COOKIE}=${await gateToken('hunter2')};`);
    expect(good.headers.get('set-cookie')).toContain('HttpOnly; Secure');
  });

  it('lets a request with the cookie through, and not one with an old cookie', async () => {
    const ok = `other=1; ${GATE_COOKIE}=${await gateToken('hunter2')}`;
    expect(await siteGate(get('/models', { cookie: ok }), env)).toBeNull();
    const old = `${GATE_COOKIE}=${await gateToken('old password')}`;
    expect((await siteGate(get('/models', { cookie: old }), env))!.status).toBe(303);
  });

  it('keeps the webhooks open, and gives 401 to other calls', async () => {
    const hook = new Request(`${SITE}/api/resend/webhook`, { method: 'POST', body: '{}' });
    expect(await siteGate(hook, env)).toBeNull();
    const api = new Request(`${SITE}/api/report`, { method: 'POST', body: '{}' });
    expect((await siteGate(api, env))!.status).toBe(401);
  });

  describe('the unlock link', () => {
    const linkEnv = { ...env, SITE_LINK_KEY: 'k3y-Long' };
    const setOf = (r: Response) => r.headers.get('set-cookie')?.match(new RegExp(`${GATE_COOKIE}=([^;]+)`))?.[1];

    it('sets a cookie for the right key, and sends the visitor on without it', async () => {
      const good = (await siteGate(get('/models?x=1&unlock=k3y-Long'), linkEnv))!;
      expect(good.status).toBe(303);
      expect(good.headers.get('location')).toBe('/models?x=1');
      const value = setOf(good)!;
      expect(value).not.toBe(await gateToken('hunter2'));
      expect(await siteGate(get('/models', { cookie: `${GATE_COOKIE}=${value}` }), linkEnv)).toBeNull();
      expect((await siteGate(get('//evil.com?unlock=k3y-Long'), linkEnv))!.headers.get('location')).toBe('/');
    });

    it('also sets the eval clearance and the statement flag, even for an unlocked visitor', async () => {
      const full = { ...linkEnv, BETTER_AUTH_SECRET: 'auth-secret' };
      const unlocked = `${GATE_COOKIE}=${await gateToken('hunter2')}`;
      for (const headers of [{}, { cookie: unlocked }] as Record<string, string>[]) {
        const cookies = (await siteGate(get('/models?unlock=k3y-Long', headers), full))!.headers.getSetCookie();
        const clearance = cookies.find((c) => c.startsWith(`${CLEARANCE_COOKIE}=`))!;
        expect(clearance).toContain('HttpOnly');
        const value = clearance.split(';')[0].slice(CLEARANCE_COOKIE.length + 1);
        expect(await checkClearance('auth-secret', value)).toBe(true);
        expect(await checkClearance('other', value)).toBe(false);
        const flag = cookies.find((c) => c.startsWith(`${ATTESTED_FLAG}=1;`))!;
        expect(flag).not.toContain('HttpOnly');
      }
      const noSecret = (await siteGate(get('/models?unlock=k3y-Long'), linkEnv))!.headers.getSetCookie();
      expect(noSecret).toHaveLength(1);
      const wrong = (await siteGate(get('/models?unlock=nope', { cookie: unlocked }), full))!;
      expect(wrong.headers.getSetCookie()).toEqual([]);
    });

    it('takes neither a wrong key nor the password', async () => {
      for (const key of ['nope', 'hunter2', 'K3Y-LONG']) {
        const bad = (await siteGate(get(`/models?unlock=${key}`), linkEnv))!;
        expect(bad.headers.get('location')).toBe('/models');
        expect(bad.headers.get('set-cookie')).toBeNull();
      }
    });

    it('is off with no key, and its cookie fails after a new key or password', async () => {
      expect((await siteGate(get('/models?unlock=hunter2'), env))!.headers.get('location')).toBe(
        '/unlock?next=%2Fmodels%3Funlock%3Dhunter2',
      );
      const value = setOf((await siteGate(get('/models?unlock=k3y-Long'), linkEnv))!)!;
      const cookie = `${GATE_COOKIE}=${value}`;
      expect((await siteGate(get('/models', { cookie }), { ...linkEnv, SITE_LINK_KEY: 'new' }))!.status).toBe(303);
      expect((await siteGate(get('/models', { cookie }), { ...linkEnv, SITE_PASSWORD: 'new' }))!.status).toBe(303);
      expect((await siteGate(get('/models', { cookie }), env))!.status).toBe(303);
      const form = `${GATE_COOKIE}=${await gateToken('hunter2')}`;
      expect(await siteGate(get('/models', { cookie: form }), { ...linkEnv, SITE_LINK_KEY: 'new' })).toBeNull();
    });

    it('stops after the rate limit, and lets a POST through to the form rule', async () => {
      const limit = vi.fn().mockResolvedValue({ success: false });
      const r = (await siteGate(get('/models?unlock=k3y-Long'), { ...linkEnv, RATE_LIMIT_STRICT: { limit } }))!;
      expect(r.status).toBe(429);
      expect(r.headers.get('set-cookie')).toBeNull();
      const api = new Request(`${SITE}/api/report?unlock=k3y-Long`, { method: 'POST', body: '{}' });
      expect((await siteGate(api, linkEnv))!.status).toBe(401);
    });
  });

  it('stops after the rate limit', async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    const r = (await siteGate(post({ password: 'hunter2' }, { 'cf-connecting-ip': '1.2.3.4' }), {
      ...env,
      RATE_LIMIT_STRICT: { limit },
    }))!;
    expect(r.status).toBe(429);
    expect(limit).toHaveBeenCalledWith({ key: 'gate:1.2.3.4' });
  });
});

describe('safeNext', () => {
  it('keeps paths on this site only', () => {
    expect(safeNext('/models?x=1')).toBe('/models?x=1');
    expect(safeNext('//evil.com')).toBe('/');
    expect(safeNext('/\\evil.com')).toBe('/');
    expect(safeNext('https://evil.com')).toBe('/');
    expect(safeNext('/unlock?next=/x')).toBe('/');
    expect(safeNext(null)).toBe('/');
  });
});
