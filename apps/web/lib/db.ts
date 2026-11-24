import { PrismaClient } from '#prisma';
import { IS_WORKERS } from '@/lib/platform';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { PrismaPg } from '@prisma/adapter-pg';

// On Node: one client per process, kept on `globalThis` so dev reloads reuse the pool.
// On Cloudflare Workers: one client per request (a Worker cannot reuse a socket across
// requests), connected through Hyperdrive, which pools for us.

function makeClient(connectionString: string | undefined): PrismaClient {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    // Some kB on each attempt; only the attempt page reads them.
    omit: { evalAttempt: { settings: true } },
  });
}

const perRequest = new WeakMap<object, PrismaClient>();

function requestClient(): PrismaClient {
  const { env, ctx } = getCloudflareContext();
  let client = perRequest.get(ctx);
  if (!client) {
    const hyperdrive = (env as { HYPERDRIVE?: { connectionString: string } }).HYPERDRIVE;
    client = makeClient(hyperdrive?.connectionString ?? process.env.DATABASE_URL);
    perRequest.set(ctx, client);
  }
  return client;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function nodeClient(): PrismaClient {
  globalForPrisma.prisma ??= makeClient(process.env.DATABASE_URL);
  return globalForPrisma.prisma;
}

export const prisma: PrismaClient = IS_WORKERS
  ? new Proxy({} as PrismaClient, {
      get(_, prop) {
        const client = requestClient();
        const value = Reflect.get(client, prop);
        return typeof value === 'function' ? value.bind(client) : value;
      },
    })
  : nodeClient();
