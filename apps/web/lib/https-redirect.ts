// Sends plain http requests to https. The Worker entry (`worker.ts`) runs it first. Static assets
// do not reach the Worker, but pages link to them with relative URLs. Wrangler bundles this file
// outside Next, so it imports no `@/` paths.

const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Null: the request is on https, or on a local preview. Else a permanent redirect to https. */
export function httpsRedirect(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.protocol !== 'http:' || LOCAL.has(url.hostname)) return null;
  url.protocol = 'https:';
  return new Response(null, { status: 308, headers: { location: url.toString() } });
}
