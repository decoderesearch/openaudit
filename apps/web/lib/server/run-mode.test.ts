import { beforeEach, describe, expect, it, vi } from 'vitest';

const flags = vi.hoisted(() => ({ RUNS_ENABLED: true, PUBLIC_RUNS_ENABLED: true, SIGN_IN_ENABLED: true }));

vi.mock('@/lib/env', () => flags);
vi.mock('@/lib/server/viewer', () => ({
  canSpend: (v: { role: string } | null) => v?.role === 'moderator',
}));

import type { Viewer } from '@/lib/server/viewer';
import { runMode } from './run-mode';

const user = { id: 'u', role: 'user', banned: false } as Viewer;
const moderator = { ...user, role: 'moderator' } as Viewer;

beforeEach(() => {
  flags.RUNS_ENABLED = true;
  flags.PUBLIC_RUNS_ENABLED = true;
  flags.SIGN_IN_ENABLED = true;
});

describe('runMode', () => {
  it('lets moderators run, and others request', () => {
    expect(runMode(moderator)).toBe('run');
    expect(runMode(user)).toBe('request');
    expect(runMode(null)).toBe('request');
    expect(runMode({ ...user, banned: true })).toBeNull();
  });

  it('is off with runs off, and has no requests with sign-in off', () => {
    flags.SIGN_IN_ENABLED = false;
    expect(runMode(user)).toBeNull();
    flags.RUNS_ENABLED = false;
    expect(runMode(moderator)).toBeNull();
  });

  it('with public runs off, has no requests: only canSpend viewers run', () => {
    flags.PUBLIC_RUNS_ENABLED = false;
    expect(runMode(moderator)).toBe('run');
    expect(runMode(user)).toBeNull();
    expect(runMode(null)).toBeNull();
  });
});
