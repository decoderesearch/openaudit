// True in a Cloudflare Worker (and in `wrangler dev`), false on Node.
export const IS_WORKERS = typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';

// Cloudflare sets `cf-connecting-ip` to the client. It appends to a client-sent
// `x-forwarded-for`, so there the first entry is not to be trusted.
export const IP_ADDRESS_HEADERS = IS_WORKERS ? ['cf-connecting-ip'] : ['x-forwarded-for', 'x-real-ip'];
