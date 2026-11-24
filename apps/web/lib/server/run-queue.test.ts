import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_CONTAINERS, containersFor, enqueueCards, enqueueRun } from './run-queue';

const RUN = '0199a3b2-1c2d-7e3f-8a9b-0c1d2e3f4a5b';

describe('containersFor', () => {
  it('gives one container for each shard, up to the cap', () => {
    expect(containersFor(3)).toBe(1);
    expect(containersFor(50)).toBe(1);
    expect(containersFor(51)).toBe(2);
    expect(containersFor(10_000)).toBe(MAX_CONTAINERS);
    expect(containersFor(undefined)).toBe(MAX_CONTAINERS);
  });
});

describe('enqueueRun', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('R2_ACCOUNT_ID', 'acct');
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '');
    vi.stubEnv('RUN_QUEUE_ID', 'queue1');
    vi.stubEnv('CLOUDFLARE_RUN_QUEUE_WRITE_TOKEN', 'queue-token');
    vi.stubEnv('CLOUDFLARE_API_TOKEN', 'cf-token');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it('posts the run to the queue', async () => {
    fetchMock.mockResolvedValue(new Response('{"success":true}', { status: 200 }));
    expect(await enqueueRun(RUN, 3)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acct/queues/queue1/messages');
    expect(init.method).toBe('POST');
    expect(init.headers.authorization).toBe('Bearer queue-token');
    expect(JSON.parse(init.body)).toEqual({ body: { runId: RUN, containers: 3 }, content_type: 'json' });
  });

  it('takes the Cloudflare account id', async () => {
    vi.stubEnv('R2_ACCOUNT_ID', '');
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'acct2');
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    expect(await enqueueRun(RUN, 0)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain('/accounts/acct2/queues/queue1/');
    expect(init.headers.authorization).toBe('Bearer queue-token');
    expect(JSON.parse(init.body).body.containers).toBe(1);
  });

  it('returns false without config, and does not call fetch', async () => {
    vi.stubEnv('RUN_QUEUE_ID', '');
    expect(await enqueueRun(RUN, 2)).toBe(false);
    vi.stubEnv('RUN_QUEUE_ID', 'queue1');
    vi.stubEnv('CLOUDFLARE_RUN_QUEUE_WRITE_TOKEN', '');
    expect(await enqueueRun(RUN, 2)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(2);
  });

  it('returns false when Cloudflare refuses or the call fails', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"errors":[{"code":10000}]}', { status: 403 }));
    expect(await enqueueRun(RUN, 2)).toBe(false);
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    expect(await enqueueRun(RUN, 2)).toBe(false);
    const logged = vi.mocked(console.error).mock.calls.map((c) => String(c[0]));
    expect(logged[0]).toContain('403');
    expect(logged[1]).toContain('network down');
    expect(logged.join(' ')).not.toContain('cf-token');
  });

  it('posts a cards message to the same queue', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    expect(await enqueueCards()).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain('/queues/queue1/messages');
    expect(JSON.parse(init.body)).toEqual({ body: { kind: 'cards' }, content_type: 'json' });
  });
});
