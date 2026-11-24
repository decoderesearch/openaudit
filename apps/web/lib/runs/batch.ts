import type { StartRunInput } from '@/app/runs/actions';

/** Runs in one queue or request call. */
export const MAX_BATCH = 50;

/** A key for a request: two requests with the same key are the same run. */
export function requestKey(input: StartRunInput): string {
  const models = Object.entries(input.models ?? {})
    .filter(([, m]) => m)
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify([input.modelId, input.evalId, input.reasoning, input.limit ?? null, models]);
}

export const samplesText = (n: number) => `${n.toLocaleString('en-US')} sample${n === 1 ? '' : 's'}`;
