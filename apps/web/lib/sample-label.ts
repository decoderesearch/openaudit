// A sample's label in lists: its dataset id, which is the same in every run of the eval. The
// attempt's ordinal is only its place in one run.

/** A sample id, and its epoch when the run has more than one. */
export type SampleRef = { id: string; epoch?: number };

const MAX = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The id for display: a UUID's first 8 characters; else at most `max`, with `…` after the first
 * 7, as the end often holds the distinct part. */
export function shortSampleId(id: string, max = MAX): string {
  if (UUID.test(id)) return id.slice(0, 8);
  if (id.length <= max) return id;
  const head = 7;
  return `${id.slice(0, head)}…${id.slice(id.length - (max - 1 - head))}`;
}

/** "mask_0009b9b6", or "blackma…_replacement #14" for epoch 14. */
export function sampleLabel(s: SampleRef, max?: number): string {
  return s.epoch ? `${shortSampleId(s.id, max)} #${s.epoch}` : shortSampleId(s.id, max);
}

/** The full id, for a tooltip, or undefined when the label shows all of it. */
export function sampleTitle(s: SampleRef, max?: number): string | undefined {
  return shortSampleId(s.id, max) === s.id ? undefined : s.id;
}

/** An attempt's place in its run: "Sample 3 of 176", or "Sample 1 of 1, epoch 14 of 50". The
 * run orders attempts by sample, then by epoch. */
export function samplePlace(a: { ordinal: number; epoch: number }, total: number, runEpochs: unknown): string {
  if (typeof runEpochs !== 'number' || runEpochs <= 1) return `Sample ${a.ordinal} of ${total}`;
  const n = Math.ceil(a.ordinal / runEpochs);
  return `Sample ${n} of ${Math.ceil(total / runEpochs)}, epoch ${a.epoch} of ${runEpochs}`;
}
/** A run's sample count from its attempt count: "176", or "1 × 50 epochs". */
export function sampleCount(attempts: number, runEpochs: unknown): string {
  if (typeof runEpochs !== 'number' || runEpochs <= 1) return String(attempts);
  return `${Math.ceil(attempts / runEpochs)} × ${runEpochs} epochs`;
}

/** `SampleRef` of an attempt: the epoch only when the run has more than one. */
export function sampleRef(a: { sampleId: string; epoch: number }, runEpochs: unknown): SampleRef {
  return typeof runEpochs === 'number' && runEpochs > 1 ? { id: a.sampleId, epoch: a.epoch } : { id: a.sampleId };
}
