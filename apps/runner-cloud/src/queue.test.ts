import { describe, expect, it } from 'vitest';
import { instanceName, isStandby, START_RETRIES, startRetryDelay } from './queue';

const RUN = '0199a3b2-1c2d-7e3f-8a9b-0c1d2e3f4a5b';

describe('queue', () => {
  it('makes only the first container of a run its standby', () => {
    expect(isStandby(instanceName(RUN, 0))).toBe(true);
    expect([1, 2, 3, 10].map((i) => isStandby(instanceName(RUN, i)))).toEqual([false, false, false, false]);
  });

  it('waits longer after each failed start, at most 10 minutes', () => {
    expect([1, 2, 3, 4, 5, 6, 50].map(startRetryDelay)).toEqual([30, 60, 120, 240, 480, 600, 600]);
  });

  it('keeps a run message for many hours of full instances', () => {
    let seconds = 0;
    for (let attempt = 1; attempt <= START_RETRIES; attempt++) seconds += startRetryDelay(attempt);
    expect(seconds / 3600).toBeGreaterThan(12);
  });
});
