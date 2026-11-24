import { R2 } from '@/lib/env';
import { AwsClient } from 'aws4fetch';

// A small client for our private R2 bucket. aws4fetch signs S3 requests with `fetch`, so it runs
// on Node and on Cloudflare Workers.

let client: AwsClient | undefined;

function r2() {
  if (!R2) throw new Error('R2 is not set up: set R2_S3_ENDPOINT, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY');
  const { endpoint, bucket, accessKeyId, secretAccessKey } = R2;
  client ??= new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
  return {
    client,
    url: (key: string) => `${endpoint}/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`,
  };
}

/** Gets an object. Pass `range` to get part of it (the response is then 206). */
export async function r2Get(key: string, range?: string | null) {
  const { client, url } = r2();
  return client.fetch(url(key), { headers: range ? { range } : {} });
}

export async function r2Put(key: string, body: Uint8Array, contentType: string) {
  const { client, url } = r2();
  const res = await client.fetch(url(key), {
    method: 'PUT',
    body: body as BodyInit,
    headers: { 'content-type': contentType },
  });
  if (!res.ok) throw new Error(`R2 PUT ${key}: ${res.status} ${await res.text()}`);
}

/** The object's size in bytes, or null when there is no object. */
export async function r2Size(key: string) {
  const { client, url } = r2();
  const res = await client.fetch(url(key), { method: 'HEAD' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 HEAD ${key}: ${res.status}`);
  return Number(res.headers.get('content-length'));
}

export async function r2Delete(key: string) {
  // Dev and production share run files. Only `openaudit-runner delete-run-files` deletes them.
  if (key.startsWith('runs/') || 'runs/'.startsWith(key)) throw new Error(`Will not delete run file ${key}.`);
  const { client, url } = r2();
  const res = await client.fetch(url(key), { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`R2 DELETE ${key}: ${res.status}`);
}
