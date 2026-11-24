import { modelUpdates } from '@/lib/server/model-feed';
import { describe, expect, it, vi } from 'vitest';

const entry = (key: string, date: string) => ({
  key,
  date,
  meter: null,
  counts: { high: 0, medium: 0, low: 0 },
  snippets: [],
});
const ENTRIES = [entry('b', '2026-10-01'), entry('a', '2026-10-03'), entry('c', '2026-10-02')];

vi.mock('@/lib/db', () => ({ prisma: {} }));
vi.mock('@/lib/server/snippet-feed', () => ({ snippetFeed: vi.fn(async () => ENTRIES) }));

describe('modelUpdates', () => {
  it('gives all the models, newest first', async () => {
    expect((await modelUpdates()).map((e) => e.key)).toEqual(['a', 'c', 'b']);
  });
});
