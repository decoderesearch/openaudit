import { describe, expect, it, vi } from 'vitest';
import { postDigest } from './digest';

describe('postDigest', () => {
  it('skips with no web URL or token', async () => {
    const fetcher = vi.fn();
    expect(await postDigest({ RUNNER_NOTIFY_TOKEN: 't' }, fetcher)).toBe('skipped');
    expect(await postDigest({ OPENAUDIT_URL: 'https://x.test' }, fetcher)).toBe('skipped');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('posts to the digest route with the token', async () => {
    const fetcher = vi.fn(async () => new Response('{"outcome":"sent"}', { status: 200 }));
    const r = await postDigest({ OPENAUDIT_URL: 'https://x.test/', RUNNER_NOTIFY_TOKEN: 'tok' }, fetcher);
    expect(r).toEqual({ status: 200, body: '{"outcome":"sent"}' });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://x.test/api/runner/digest');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok');
  });
});
