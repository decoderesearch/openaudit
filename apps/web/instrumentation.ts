import * as Sentry from '@sentry/nextjs';

// Next calls this for errors in Server Components, route handlers and the proxy. Only the Worker
// (worker.ts) starts a Sentry client; with no client, nothing is sent.
export const onRequestError = Sentry.captureRequestError;
