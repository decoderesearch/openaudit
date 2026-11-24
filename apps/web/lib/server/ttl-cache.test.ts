import { afterEach, describe, expect, it, vi } from 'vitest';
import { ttlCache, ttlCacheBy } from './ttl-cache';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

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
