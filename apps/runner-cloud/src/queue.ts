import { isRunId } from './sign';

// The queue messages. A run message starts `containers` instances that run its shards. A cards
// message starts the one cards container, which builds stale OpenAudit Cards and stops.

export type RunMessage = { runId: string; containers: number; args?: string[] };
export type CardsMessage = { kind: 'cards' };
export type QueueMessage = RunMessage | CardsMessage;

export const MAX_CONTAINERS = 20;
/** The Durable Object name of the cards container. */
export const CARDS_NAME = 'cards';
/** A finished run sends a cards message this late: after the cards debounce (3 minutes). */
export const CARDS_DELAY_SECONDS = 200;

export function isCards(message: QueueMessage): message is CardsMessage {
  return 'kind' in message && message.kind === 'cards';
}

/** The message, or null when it is not valid. `args` replaces the runner command (smoke tests). */
export function parseMessage(body: unknown): QueueMessage | null {
  if (!body || typeof body !== 'object') return null;
  const { kind, runId, containers, args } = body as Record<string, unknown>;
  if (kind === 'cards') return { kind };
  if (kind !== undefined) return null;
  if (!isRunId(runId)) return null;
  if (!Number.isInteger(containers) || (containers as number) < 1) return null;
  if (args !== undefined && !(Array.isArray(args) && args.every((a) => typeof a === 'string'))) return null;
  return {
    runId,
    containers: Math.min(containers as number, MAX_CONTAINERS),
    ...(args ? { args: args as string[] } : {}),
  };
}

/** The Durable Object name of one container of a run. */
export function instanceName(runId: string, i: number): string {
  return `${runId}:${i}`;
}

/** The first container of a run stays until no other container has a shard of the run. */
export function isStandby(name: string): boolean {
  return name.endsWith(':0');
}

// The same as `max_retries` in wrangler.jsonc. All instances can be in use for hours.
export const START_RETRIES = 100;

/** Seconds before the next try of a run message whose containers did not start. */
export function startRetryDelay(attempts: number): number {
  return Math.min(30 * 2 ** Math.max(attempts - 1, 0), 600);
}
