/**
 * The results a run's table shows: not a panel judge's own (`@`), not a standard error, and not a
 * metric that the eval does not declare with the same value as one it declares (a second name).
 */
export function tableResults<T extends { metric: string; value: number }>(results: T[], declared: Set<string>): T[] {
  const values = new Set(results.filter((r) => declared.has(r.metric)).map((r) => r.value));
  return results.filter(
    (r) => !r.metric.includes('@') && !r.metric.includes('stderr') && (declared.has(r.metric) || !values.has(r.value)),
  );
}

/** Sorts metrics: the headline first, then by display name, A to Z. */
export function byHeadlineThenName<T>(isHeadline: (item: T) => boolean, name: (item: T) => string) {
  return (a: T, b: T) =>
    Number(isHeadline(b)) - Number(isHeadline(a)) ||
    name(a).localeCompare(name(b), 'en', { sensitivity: 'base', numeric: true });
}
