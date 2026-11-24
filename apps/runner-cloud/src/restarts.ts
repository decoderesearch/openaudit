import type { QueueMessage } from './queue';

// The restart rules of one container. Pure, so that tests can check them. The counts are in
// storage, so a second onStop for one stop, or a second delivery of one message, does nothing.

// A container that runs longer than this is stopped.
export const MAX_LIFETIME_MS = 6 * 60 * 60 * 1000;
// Starts again after a stop with an error, at most this many times.
export const MAX_RESTARTS = 2;
export const RESTART_DELAY_MS = 30_000;

export type Job = QueueMessage & {
  name: string;
  messageId: string;
  startedAt: number;
  // Starts so far, and stops handled so far.
  launches: number;
  stops: number;
  restartAt?: number;
  done?: boolean;
};

export function newJob(message: QueueMessage, name: string, messageId: string, now: number): Job {
  return { ...message, name, messageId, startedAt: now, launches: 0, stops: 0 };
}

/** The job with one more start, or null when it may not start again. */
export function beginLaunch(job: Job): Job | null {
  if (job.done || job.launches > job.stops || job.launches >= 1 + MAX_RESTARTS) return null;
  return { ...job, launches: job.launches + 1, restartAt: undefined };
}

/** The job after a stop. A stop that is already handled changes nothing. */
export function afterStop(job: Job, exitCode: number, now: number): { job: Job; duplicate: boolean; restart: boolean } {
  if (job.done || job.stops >= job.launches) return { job, duplicate: true, restart: false };
  const restart = exitCode !== 0 && job.launches < 1 + MAX_RESTARTS && now - job.startedAt < MAX_LIFETIME_MS;
  const next: Job = restart
    ? { ...job, stops: job.launches, restartAt: now + RESTART_DELAY_MS }
    : { ...job, stops: job.launches, restartAt: undefined, done: true };
  return { job: next, duplicate: false, restart };
}

/** 'now' when a restart is due, 'wait' when it is later, 'no' when there is none. */
export function restartDue(job: Job | undefined, now: number): 'now' | 'wait' | 'no' {
  if (!job?.restartAt || job.done) return 'no';
  return now < job.restartAt ? 'wait' : 'now';
}
