import * as Sentry from '@sentry/nextjs/cloudflare';
import { httpsRedirect } from './lib/https-redirect';
import { sentryOptions, type SentryEnv } from './lib/sentry-options';
import { siteGate, type GateEnv } from './lib/site-gate';
// `opennextjs-cloudflare build` makes this file, so it is missing before a build.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import next from './.open-next/worker.js';

type Env = GateEnv & SentryEnv;
type Handler = { fetch(request: Request, env: Env, ctx: unknown): Promise<Response> };

// The Worker entry: Sentry (lib/sentry-options.ts), the https redirect (lib/https-redirect.ts), the
// password gate (lib/site-gate.ts), then Next.
const worker: Handler = {
  async fetch(request, env, ctx) {
    return httpsRedirect(request) ?? (await siteGate(request, env)) ?? (next as Handler).fetch(request, env, ctx);
  },
};

type Exported = Parameters<typeof Sentry.withSentry<Env>>[1];

export default Sentry.withSentry((env: Env) => sentryOptions(env), worker as unknown as Exported);
