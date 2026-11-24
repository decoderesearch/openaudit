const DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/;

/** True when the model came out after the eval, at the precision that both dates have (YYYY,
 * YYYY-MM or YYYY-MM-DD). Then the eval's data can be in the model's training data. */
export function releasedAfter(model?: string | null, evalDate?: string | null): boolean {
  if (!model || !evalDate || !DATE.test(model) || !DATE.test(evalDate)) return false;
  const n = Math.min(model.length, evalDate.length);
  return model.slice(0, n) > evalDate.slice(0, n);
}

/** An eval version's release date, else its name when that is a date. Null when it has none. */
export function evalReleased(v: { version: string; releasedDate?: string | null }): string | null {
  return v.releasedDate ?? (/^\d{4}-\d{2}/.test(v.version) ? v.version : null);
}

/** The release date in a model's facts, when it is a string. */
export function modelReleased(facts: unknown): string | null {
  const value = (facts as { releaseDate?: { value?: unknown } } | null)?.releaseDate?.value;
  return typeof value === 'string' ? value : null;
}
