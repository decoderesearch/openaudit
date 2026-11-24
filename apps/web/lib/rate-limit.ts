// The client address that the per-IP limits (`lib/server/limits.ts`) count by.

import { IP_ADDRESS_HEADERS } from '@/lib/platform';

// The client IP from the first of `names` that is set (see `lib/platform.ts`). The first
// `x-forwarded-for` entry is the client. A bare deployment has no header.
export function clientIp(headers: Headers, names: readonly string[] = IP_ADDRESS_HEADERS): string {
  for (const name of names) {
    const value = headers.get(name);
    if (value) {
      return value.split(',')[0].trim();
    }
  }
  return '127.0.0.1';
}

/** One IPv4 host, or the /64 of an IPv6 address (one subscriber line). */
export function ipBucket(address: string): string {
  if (!address.includes(':')) return address;
  const [head, tail = ''] = address.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = address.includes('::')
    ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right]
    : left;
  return `${groups.slice(0, 4).join(':')}::/64`;
}
