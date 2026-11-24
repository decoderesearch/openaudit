import { describe, expect, it } from 'vitest';
import { afterStop, beginLaunch, MAX_RESTARTS, newJob, RESTART_DELAY_MS, restartDue, type Job } from './restarts';

const RUN = '0199a3b2-1c2d-7e3f-8a9b-0c1d2e3f4a5b';

/** Runs a container that always exits 1. `stopCalls` is how many times onStop runs per stop. */
function failingContainer(stopCalls: number) {
  let now = 0;
  let job: Job | null = newJob({ runId: RUN, containers: 1 }, `${RUN}:0`, 'msg-1', now);
  let starts = 0;
  for (let step = 0; step < 20 && job; step++) {
    const launched = beginLaunch(job);
    if (!launched) break;
    job = launched;
    starts++;
    now += 5_000;
    for (let i = 0; i < stopCalls; i++) job = afterStop(job, 1, now).job;
    if (restartDue(job, now) === 'no') break;
    expect(restartDue(job, now)).toBe('wait');
    now += RESTART_DELAY_MS;
    expect(restartDue(job, now)).toBe('now');
  }
  return { starts, job: job! };
}

describe('restarts', () => {
  it('starts a failing container 1 + MAX_RESTARTS times', () => {
    const { starts, job } = failingContainer(1);
    expect(starts).toBe(1 + MAX_RESTARTS);
    expect(job.done).toBe(true);
  });

  it('keeps the limit when onStop runs two or three times for one stop', () => {
    expect(failingContainer(2).starts).toBe(1 + MAX_RESTARTS);
    expect(failingContainer(3).starts).toBe(1 + MAX_RESTARTS);
  });

  it('marks a second onStop as a duplicate and does not change the job', () => {
    const job = beginLaunch(newJob({ runId: RUN, containers: 1 }, 'n', 'm', 0))!;
    const first = afterStop(job, 1, 1000);
    expect(first).toMatchObject({ duplicate: false, restart: true });
    const second = afterStop(first.job, 1, 2000);
    expect(second.duplicate).toBe(true);
    expect(second.job).toBe(first.job);
  });

  it('does not start again while a start has no stop', () => {
    const job = beginLaunch(newJob({ runId: RUN, containers: 1 }, 'n', 'm', 0))!;
    expect(beginLaunch(job)).toBeNull();
  });

  it('stops for good after a clean exit, or after the lifetime', () => {
    const job = beginLaunch(newJob({ runId: RUN, containers: 1 }, 'n', 'm', 0))!;
    expect(afterStop(job, 0, 1000)).toMatchObject({ restart: false, job: { done: true } });
    expect(afterStop(job, 1, 7 * 60 * 60 * 1000)).toMatchObject({ restart: false, job: { done: true } });
    expect(beginLaunch(afterStop(job, 0, 1000).job)).toBeNull();
    expect(restartDue(afterStop(job, 0, 1000).job, 1e9)).toBe('no');
  });
});
