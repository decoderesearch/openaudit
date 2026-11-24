import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ evalAttempt: { findUnique: vi.fn() } }));
vi.mock('@/lib/db', () => ({ prisma: db }));

import { fromUrlId } from '@/lib/ids';
import { attemptPath, attemptPathById, permanentAttemptPath, runPath, samplePath } from './runs';

const RUN = '01a14323-83ba-72ad-a22d-30736496bd2a';
const ATTEMPT = '01a14323-9000-7000-8000-000000000001';

describe('attempt and sample paths', () => {
  it('puts an attempt by its number under its run', () => {
    expect(attemptPath({ id: RUN }, 7)).toBe(`${runPath({ id: RUN })}/attempts/7`);
  });

  it('puts a sample at the top, or under a run for that run only', () => {
    const SAMPLE = '01a14323-9000-7000-8000-000000000002';
    const path = samplePath({ id: SAMPLE });
    expect(path).toMatch(/^\/samples\/\w{22}$/);
    expect(fromUrlId(path.split('/')[2]!)).toBe(SAMPLE);
    expect(samplePath({ id: SAMPLE }, { id: RUN })).toBe(`${runPath({ id: RUN })}${path}`);
  });
});

describe('permanent attempt links', () => {
  beforeEach(() => db.evalAttempt.findUnique.mockReset());

  it('links an attempt by its own id', () => {
    const path = permanentAttemptPath({ id: ATTEMPT });
    expect(path).toMatch(/^\/attempts\/\w+$/);
    expect(fromUrlId(path.split('/')[2])).toBe(ATTEMPT);
  });

  it('finds the run path of a shown run', async () => {
    db.evalAttempt.findUnique.mockResolvedValue({
      ordinal: 49,
      run: { id: RUN, visibility: 'unlisted', model: { hidden: false } },
    });
    expect(await attemptPathById(ATTEMPT)).toBe(attemptPath({ id: RUN }, 49));
  });

  it('finds nothing for a private run, a hidden model or a missing attempt', async () => {
    db.evalAttempt.findUnique.mockResolvedValueOnce({
      ordinal: 1,
      run: { id: RUN, visibility: 'private', model: { hidden: false } },
    });
    expect(await attemptPathById(ATTEMPT)).toBeNull();
    db.evalAttempt.findUnique.mockResolvedValueOnce({
      ordinal: 1,
      run: { id: RUN, visibility: 'public', model: { hidden: true } },
    });
    expect(await attemptPathById(ATTEMPT)).toBeNull();
    db.evalAttempt.findUnique.mockResolvedValueOnce(null);
    expect(await attemptPathById(ATTEMPT)).toBeNull();
  });
});
