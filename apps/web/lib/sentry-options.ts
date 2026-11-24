import type { CloudflareOptions } from '@sentry/nextjs/cloudflare';

// Sentry options for the Worker entry (worker.ts). Wrangler bundles this file outside Next, so it imports no `@/` paths.

export type SentryEnv = { SENTRY_DSN?: string; SENTRY_ENVIRONMENT?: string };

/** No personal data or page content: no user, cookies, headers, bodies, query values, queries, ask chats or locals. */
export const DATA_COLLECTION: NonNullable<CloudflareOptions['dataCollection']> = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
  queues: false,
  genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false },
  stackFrameVariables: false,
};

/** Sentry is on only where `SENTRY_DSN` is set (the production Worker). */
export function sentryOptions(env: SentryEnv): CloudflareOptions | undefined {
  if (!env.SENTRY_DSN) return undefined;
  return {
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT || 'production',
    tracesSampleRate: 0.05,
    dataCollection: DATA_COLLECTION,
  };
}
