import type { RunSettings } from '@openaudit/spec';
import type { OpenRouterReasoning } from './openrouter';

// Thinking effort of a run, in OpenRouter's words. The runner sends it as `reasoning.effort`.
// `on` is for models with no effort levels. Old runs say `off`: that is `none`.

export type Effort = NonNullable<RunSettings['reasoning']>;

/** Effort levels, lowest first. */
export const LEVELS: Effort[] = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
export const EFFORTS: Effort[] = [...LEVELS, 'on'];

const LABELS: Record<Effort, string> = {
  none: 'Off',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max',
  on: 'On',
};

export const effortLabel = (e: Effort) => LABELS[e];

export const isEffort = (value: unknown): value is Effort => EFFORTS.includes(value as Effort);

/** The run's effort. Null: the run did not set one (the model's default). */
export function effortOf(settings: { reasoning?: unknown } | null | undefined): Effort | null {
  const value = settings?.reasoning;
  if (value === 'off') return 'none';
  return isEffort(value) ? value : null;
}

/** The efforts a model takes, lowest first, and the one its API uses when a request sets none. */
export type EffortChoice = { options: Effort[]; default: Effort };

/** Runs at an effort other than the model's default. Off for now: see the plan's Todo (later). */
export const OTHER_EFFORTS = false;

/** The efforts that a new run can use. */
export const runnableEfforts = (c: EffortChoice): Effort[] => (OTHER_EFFORTS ? c.options : [c.default]);

/** From OpenRouter's `reasoning` object. Null: the model does not think. Undefined: no data. */
export function effortChoice(reasoning: OpenRouterReasoning | null | undefined): EffortChoice {
  if (reasoning === null) return { options: ['none'], default: 'none' };
  if (reasoning === undefined) return { options: ['none', 'on'], default: 'none' };
  const levels = (reasoning.supported_efforts ?? []).filter((e): e is Effort => LEVELS.includes(e as Effort));
  const options = new Set<Effort>(levels.length ? levels : ['on']);
  if (!reasoning.mandatory) options.add('none');
  else options.delete('none');
  const sorted = EFFORTS.filter((e) => options.has(e));
  const enabled = reasoning.default_enabled ?? (!!reasoning.mandatory || !!reasoning.default_effort);
  const level =
    levels.find((e) => e === reasoning.default_effort) ?? (levels.includes('medium') ? 'medium' : levels[0]);
  const fallback = enabled ? (level ?? 'on') : 'none';
  return { options: sorted, default: sorted.includes(fallback) ? fallback : sorted[0] };
}
