import { APIError } from 'better-auth/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }));
vi.mock('@/lib/db', () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock('@/lib/env', async (actual) => ({ ...(await actual()), SIGN_IN_ENABLED: true }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-api-key': 'bad' }) }));

import { getViewer } from './viewer';

beforeEach(() => {
  getSession.mockReset();
});

describe('getViewer', () => {
  it('gives null for a bad API key', async () => {
    getSession.mockRejectedValue(
      APIError.from('UNAUTHORIZED', { message: 'Invalid API key', code: 'INVALID_API_KEY' }),
    );
    expect(await getViewer()).toBeNull();
  });

  it('does not hide other errors', async () => {
    getSession.mockRejectedValue(new Error('database down'));
    await expect(getViewer()).rejects.toThrow('database down');
  });
});
