import type { SyncDiff } from '@/lib/server/prod-sync';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const sync = vi.hoisted(() => ({ prodSyncOff: vi.fn(), prodSyncDiff: vi.fn() }));
vi.mock('@/lib/server/prod-sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/server/prod-sync')>()),
  ...sync,
}));
vi.mock('@/lib/server/viewer', () => ({ getViewer: vi.fn(), isAdmin: () => true }));
vi.mock('./actions', () => ({ syncToProdAction: vi.fn() }));

import AdminSyncPage from './page';

const counts = (attempts: number) => ({ shards: 1, attempts, results: 2, snippets: 0 });
const DIFF: SyncDiff = {
  source: 'ep-dev/neondb',
  target: 'Neon branch "production", database "neondb"',
  blockers: [],
  runs: [
    {
      id: 'r1',
      model: 'Qwen3.6 27B',
      eval: 'gpqa@2024',
      status: 'succeeded',
      visibility: 'public',
      finishedAt: null,
      state: 'new',
      dev: counts(1200),
    },
    {
      id: 'r2',
      model: 'Qwen3.6 27B',
      eval: 'mmlu@1',
      status: 'succeeded',
      visibility: 'public',
      finishedAt: null,
      state: 'changed',
      dev: counts(10),
      prod: counts(9),
    },
    {
      id: 'r3',
      model: 'Qwen3.6 27B',
      eval: 'mmlu@2',
      status: 'succeeded',
      visibility: 'public',
      finishedAt: null,
      state: 'same',
      dev: counts(5),
      prod: counts(5),
    },
    {
      id: 'r4',
      model: 'New Model',
      eval: 'mmlu@2',
      status: 'succeeded',
      visibility: 'private',
      finishedAt: null,
      state: 'blocked',
      reason: 'User new@example.com is not on production.',
      dev: counts(5),
    },
  ],
  cards: [{ model: 'Qwen3.6 27B', state: 'newer', dev: [1, 2, 3], prod: [1] }],
  panels: [
    { model: 'Qwen3.6 27B', state: 'new', dev: [4], prod: [] },
    { model: 'Grok 4.3', state: 'prod-built', reason: 'Production made its own panels.', dev: [2], prod: [1] },
  ],
};

describe('AdminSyncPage', () => {
  afterEach(() => vi.clearAllMocks());

  it('shows what syncs, what does not, and why', async () => {
    sync.prodSyncOff.mockReturnValue(null);
    sync.prodSyncDiff.mockResolvedValue(DIFF);
    render(await AdminSyncPage());
    expect(
      screen.getByText(
        /2 runs to sync · 2 card versions to sync · 1 Deploymeter panels to sync · 1 runs the same · 1 not synced/,
      ),
    ).toBeTruthy();
    expect(screen.getByText('Deploymeters that differ (2)')).toBeTruthy();
    expect(screen.getByText('Production made its own panels.')).toBeTruthy();
    expect(screen.getByText('Runs to sync (2)')).toBeTruthy();
    expect(screen.getByText('1,200 / 2')).toBeTruthy();
    expect(screen.getByText('Changed on dev')).toBeTruthy();
    expect(screen.getByText('User new@example.com is not on production.')).toBeTruthy();
    expect(screen.getByText('v1–v3 (3)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sync to production' })).toBeTruthy();
  });

  it('hides the button when a blocker stops the sync', async () => {
    sync.prodSyncOff.mockReturnValue(null);
    sync.prodSyncDiff.mockResolvedValue({ ...DIFF, blockers: ['eval_run: columns differ. Migrate first.'] });
    render(await AdminSyncPage());
    expect(screen.getByText('eval_run: columns differ. Migrate first.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sync to production' })).toBeNull();
  });

  it('says why the sync is off, and reads no database', async () => {
    sync.prodSyncOff.mockReturnValue('The sync runs only on a local server.');
    render(await AdminSyncPage());
    expect(screen.getByText('The sync runs only on a local server.')).toBeTruthy();
    expect(sync.prodSyncDiff).not.toHaveBeenCalled();
  });
});
