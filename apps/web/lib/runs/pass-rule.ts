import type { ScoreDef } from '@openaudit/spec';

type PassRule = NonNullable<ScoreDef['pass']>;

/** A value as the text of a pass rule: lower case, a number in its shortest form. Must match
 * `value_text` in `apps/runner/openaudit_runner/inspect_map.py`. */
export function valueText(v: unknown): string | null {
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  return typeof v === 'string' ? v.trim().toLowerCase() : null;
}

/** Pass or fail by a seed score's `pass` rule; null for no mark. Must match `rule_passed` in
 * `apps/runner/openaudit_runner/inspect_map.py`. */
export function rulePassed(rule: PassRule, value: unknown, target: unknown, groups: string[] = []): boolean | null {
  if (rule.none || (rule.groups && !rule.groups.some((g) => groups.includes(g)))) return null;
  if (rule.failAtOrAbove !== undefined) return typeof value === 'number' ? value < rule.failAtOrAbove : null;
  const marks = rule.byTarget ? (typeof target === 'string' ? rule.byTarget[target] : undefined) : rule.values;
  const text = valueText(value);
  if (!marks || text === null) return null;
  const found = Object.entries(marks).find(([k]) => k.trim().toLowerCase() === text);
  return found?.[1] ?? null;
}

/** Pass or fail by a score's direction; null for no mark. Must match `passed` in
 * `apps/runner/openaudit_runner/inspect_map.py`. */
export function directionPassed(value: unknown, d: ScoreDef): boolean | null {
  if (d.direction === 'neither') return null;
  if (d.direction === 'lower_is_better') {
    const v = value === 'C' ? 1 : value === 'I' ? 0 : value;
    const binary = d.type === 'binary';
    const low = d.min ?? (binary ? 0 : undefined);
    const high = d.max ?? (binary ? 1 : undefined);
    if (typeof v !== 'number' || low === undefined) return null;
    const scaled = v * (d.attemptScale ?? 1);
    if (scaled <= low) return true;
    return high !== undefined && scaled < (low + high) / 2 ? null : false;
  }
  if (typeof value === 'boolean') return value;
  if (value === 'C' || value === 'I') return value === 'C';
  if (value === 0 || value === 1) return value === 1;
  return null;
}

/** A score's mark on one attempt: by its `pass` rule, else by its direction. A scale (`ordinal`)
 * with no rule has no mark: its direction does not say where a fail starts. */
export function scoreMark(
  value: unknown,
  d: ScoreDef | undefined,
  target: unknown,
  groups: string[] = [],
): boolean | null {
  if (!d) return null;
  if (d.pass) return rulePassed(d.pass, value, target, groups);
  return d.type === 'ordinal' ? null : directionPassed(value, d);
}
