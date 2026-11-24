import { RUNNER_NOTIFY_TOKEN } from '@/lib/env';

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

/**
 * True when the header is `Bearer <RUNNER_NOTIFY_TOKEN>`. Compares the hashes, so the time does
 * not depend on where the strings differ.
 */
export async function runnerTokenOk(header: string | null): Promise<boolean> {
  if (!RUNNER_NOTIFY_TOKEN || !header?.startsWith('Bearer ')) return false;
  const [a, b] = await Promise.all([digest(header.slice(7)), digest(RUNNER_NOTIFY_TOKEN)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
