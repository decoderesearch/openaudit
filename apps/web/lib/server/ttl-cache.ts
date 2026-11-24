/**
 * Calls `load` at most once in `ms` in this process, and gives the last value in between. It keeps
 * only resolved values: a Worker request must not wait on another request's I/O. In local dev it
 * keeps no value, so a change in the database shows at once; calls at the same time share a load.
 */
export function ttlCache<T>(load: () => Promise<T>, ms: number): () => Promise<T> {
  let last: { value: T; at: number } | null = null;
  let loading: Promise<T> | null = null;
  return async () => {
    if (process.env.NODE_ENV === 'development')
      return (loading ??= load().finally(() => {
        loading = null;
      }));
    if (last && Date.now() - last.at < ms) return last.value;
    const value = await load();
    last = { value, at: Date.now() };
    return value;
  };
}

/** A browser keeps a public response for 5 minutes. Not in local dev, as with `ttlCache`. */
export const PUBLIC_CACHE = {
  'Cache-Control': process.env.NODE_ENV === 'development' ? 'no-store' : 'public, max-age=300',
};

/** `ttlCache` with one value for each key. Use it only for a small set of keys. */
export function ttlCacheBy<T>(load: (key: string) => Promise<T>, ms: number): (key: string) => Promise<T> {
  const caches = new Map<string, () => Promise<T>>();
  return (key) => {
    let cached = caches.get(key);
    if (!cached) caches.set(key, (cached = ttlCache(() => load(key), ms)));
    return cached();
  };
}
