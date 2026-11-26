import { IS_WORKERS } from '@/lib/platform';
import { getCloudflareContext } from '@opennextjs/cloudflare';

type Stamped<T> = { value: T; at: number };

/** The Cloudflare cache of the data center, for the values of a `ttlCache` with a name. The key has
 * the Worker version, so code after a deploy does not read the values of older code. A cache error
 * gives a miss: the database is then the source. */
function sharedStore<T>(name: string, ms: number) {
  const open = () => caches.open('ttl-cache');
  const key = () => {
    const env = getCloudflareContext().env as { CF_VERSION_METADATA?: { id: string } };
    return `https://ttl-cache.internal/${env.CF_VERSION_METADATA?.id ?? 'none'}/${encodeURIComponent(name)}`;
  };
  return {
    async get(): Promise<Stamped<T> | null> {
      try {
        const res = await (await open()).match(key());
        return res ? ((await res.json()) as Stamped<T>) : null;
      } catch (e) {
        console.error(`[ttl-cache] read ${name}`, e);
        return null;
      }
    },
    put(v: Stamped<T>) {
      try {
        const res = new Response(JSON.stringify(v), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${Math.ceil(ms / 1000)}` },
        });
        const url = key();
        getCloudflareContext().ctx.waitUntil(
          open()
            .then((c) => c.put(url, res))
            .catch((e) => console.error(`[ttl-cache] write ${name}`, e)),
        );
      } catch (e) {
        console.error(`[ttl-cache] write ${name}`, e);
      }
    },
  };
}

/**
 * Calls `load` at most once in `ms` in this process, and gives the last value in between. It keeps
 * only resolved values: a Worker request must not wait on another request's I/O. In local dev it
 * keeps no value, so a change in the database shows at once; calls at the same time share a load.
 * With `name`, on Workers, the value (as JSON) is also in the data center's cache, so a new isolate
 * does not load it again. A value is never older than `ms`, from either place.
 */
export function ttlCache<T>(load: () => Promise<T>, ms: number, name?: string): () => Promise<T> {
  let last: Stamped<T> | null = null;
  let loading: Promise<T> | null = null;
  const shared = name && IS_WORKERS ? sharedStore<T>(name, ms) : null;
  return async () => {
    if (process.env.NODE_ENV === 'development')
      return (loading ??= load().finally(() => {
        loading = null;
      }));
    if (last && Date.now() - last.at < ms) return last.value;
    const hit = await shared?.get();
    if (hit && Date.now() - hit.at < ms) return (last = hit).value;
    const value = await load();
    last = { value, at: Date.now() };
    shared?.put(last);
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
