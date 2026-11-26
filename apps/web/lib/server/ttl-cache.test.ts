import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ttlCache, ttlCacheBy } from './ttl-cache';

const cf = vi.hoisted(() => ({ version: 'v1', writes: [] as Promise<unknown>[] }));
vi.mock('@/lib/platform', () => ({ IS_WORKERS: true }));
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => ({
    env: { CF_VERSION_METADATA: { id: cf.version } },
    ctx: { waitUntil: (p: Promise<unknown>) => cf.writes.push(p) },
  }),
}));

/** The Cache API of one data center: one store for all isolates. */
let stored: Map<string, string>;
let broken: boolean;
beforeEach(() => {
  stored = new Map();
  broken = false;
  cf.version = 'v1';
  cf.writes = [];
  vi.stubGlobal('caches', {
    open: async () => ({
      match: async (url: string) => {
        if (broken) throw new Error('cache down');
        const body = stored.get(url);
        return body === undefined ? undefined : new Response(body);
      },
      put: async (url: string, res: Response) => void stored.set(url, await res.text()),
    }),
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const written = () => Promise.all(cf.writes);

describe('ttlCache', () => {
  it('loads once in the window, and again after it', async () => {
    vi.useFakeTimers();
    let n = 0;
    const get = ttlCache(async () => ++n, 1000);
    expect(await get()).toBe(1);
    expect(await get()).toBe(1);
    vi.advanceTimersByTime(1001);
    expect(await get()).toBe(2);
  });

  it('loads each time in local dev', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    let n = 0;
    const get = ttlCache(async () => ++n, 60_000);
    expect(await get()).toBe(1);
    expect(await get()).toBe(2);
  });

  it('shares one load between calls at the same time in local dev', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    let n = 0;
    const get = ttlCache(async () => ++n, 60_000);
    expect(await Promise.all([get(), get(), get()])).toEqual([1, 1, 1]);
    expect(await get()).toBe(2);
  });

  it('keeps no value when the load fails', async () => {
    let fail = true;
    const get = ttlCache(async () => {
      if (fail) throw new Error('down');
      return 'ok';
    }, 1000);
    await expect(get()).rejects.toThrow('down');
    fail = false;
    expect(await get()).toBe('ok');
  });
});

describe('ttlCache with a name, on Workers', () => {
  it('gives a new isolate the value that another isolate loaded', async () => {
    let n = 0;
    const load = async () => ({ n: ++n });
    expect(await ttlCache(load, 60_000, 'x')()).toEqual({ n: 1 });
    await written();
    expect(await ttlCache(load, 60_000, 'x')()).toEqual({ n: 1 });
    expect(n).toBe(1);
  });

  it('keeps the time of the first load, so a value is never older than the window', async () => {
    vi.useFakeTimers();
    let n = 0;
    const load = async () => ++n;
    await ttlCache(load, 1000, 'x')();
    await written();
    vi.advanceTimersByTime(600);
    const other = ttlCache(load, 1000, 'x');
    expect(await other()).toBe(1);
    vi.advanceTimersByTime(500);
    expect(await other()).toBe(2);
  });

  it('does not give the values of another Worker version', async () => {
    let n = 0;
    await ttlCache(async () => ++n, 60_000, 'x')();
    await written();
    cf.version = 'v2';
    expect(await ttlCache(async () => ++n, 60_000, 'x')()).toBe(2);
  });

  it('loads from the source when the cache fails', async () => {
    broken = true;
    expect(await ttlCache(async () => 'db', 60_000, 'x')()).toBe('db');
  });

  it('uses only this process without a name', async () => {
    await ttlCache(async () => 1, 60_000)();
    await written();
    expect(stored.size).toBe(0);
  });
});

describe('ttlCacheBy', () => {
  it('keeps one value for each key', async () => {
    vi.useFakeTimers();
    const loads: string[] = [];
    const get = ttlCacheBy(async (k) => (loads.push(k), `${k}${loads.length}`), 1000);
    expect(await get('a')).toBe('a1');
    expect(await get('b')).toBe('b2');
    expect(await get('a')).toBe('a1');
    vi.advanceTimersByTime(1001);
    expect(await get('a')).toBe('a3');
    expect(loads).toEqual(['a', 'b', 'a']);
  });
});
