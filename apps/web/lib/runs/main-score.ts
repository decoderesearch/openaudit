import { metricRange, type Score } from '@/components/catalog/score';
import { SEVERITIES, type SnippetSeverity } from '@/lib/openaudit-card';
import { onScale } from '@/lib/runs/attempt-scores';
import type { EvalAttempt, EvalResult, EvalVersion } from '@openaudit/spec';

/** How a sample's score shows a safety bar: its metric's unit, direction and range. `groups`: the
 * directions of the group metrics of the same score, as a benign category's "neither". */
export type Bar = Pick<Score, 'unit' | 'safetyDirection' | 'range'> & {
  groups?: Record<string, Score['safetyDirection']>;
};

/** The groups of the metric's score that declare a safety direction, by metric key. A metric with
 * no score has the groups whose keys start with its key and "_". */
export function groupDirections(version: EvalVersion, metric: string | undefined) {
  const def = version.metrics.find((m) => m.key === metric);
  const ofDef = (m: EvalVersion['metrics'][number]) =>
    def?.score ? m.score === def.score : !m.score && m.key.startsWith(`${def?.key}_`);
  const groups = version.metrics.filter((m) => def && m.key !== def.key && ofDef(m) && m.safetyDirection);
  return groups.length ? Object.fromEntries(groups.map((m) => [m.key, m.safetyDirection])) : undefined;
}

/** A sample's bar for `value`. A sample in a group of `bar.groups` shows its group's direction. */
export function sampleBar(metric: string, value: number, { groups, ...bar }: Bar, inGroups: string[] = []): Score {
  const group = inGroups.find((m) => groups && m in groups);
  return { metric, value, ...bar, ...(group && { safetyDirection: groups![group] }) };
}
/** A column of one score of each sample. `attemptScale`: as for `ScoreDef`. `description`: what
 * the score means. */
/** `ordinal`: the score's values are steps on a scale (0 to 10). */
export type ScoreColumn = {
  key: string;
  label: string;
  bar?: Bar;
  attemptScale?: number;
  description?: string;
  ordinal?: boolean;
};

/** The headline metric, its definition, and the definition of the score it aggregates. */
export function headlineOf(version: EvalVersion) {
  const headDef = version.metrics.find((m) => m.headline);
  const headScoreDef = version.scores.find((s) => s.key === headDef?.score);
  return { headline: headDef?.key, headDef, headScore: headDef?.score, headScoreDef };
}

/** A result with the direction the eval declares, not the stored one, and its metric's range. */
export function scoredResult(version: EvalVersion, r: EvalResult): Score {
  return {
    ...r,
    safetyDirection: version.metrics.find((m) => m.key === r.metric)?.safetyDirection,
    range: metricRange(version.metrics, r.metric),
  };
}

/** A sample's bar for a metric: from its result, else from its definition. A sample of a percent
 * metric is a fraction (1 or 0). */
export function barOf(version: EvalVersion, results: EvalResult[], metric: string | undefined): Bar | undefined {
  const r = results.find((x) => x.metric === metric);
  const def = version.metrics.find((m) => m.key === metric);
  if (!r && !def) return undefined;
  const { unit, safetyDirection, range } = r
    ? scoredResult(version, r)
    : {
        unit: def!.unit as Bar['unit'],
        safetyDirection: def!.safetyDirection,
        range: metricRange(version.metrics, def!.key),
      };
  const groups = groupDirections(version, metric);
  return { unit: unit === 'percent' ? 'fraction' : unit, safetyDirection, range, ...(groups && { groups }) };
}

/** Aggregations whose value for one sample is the sample's score. */
const PER_SAMPLE: (string | undefined)[] = [undefined, 'mean', 'rate', 'pass_at_k'];

/** The score each sample shows when no score metric is picked: the headline's, else the scorer's
 * first. A scorer's plain `score` key is its main value, so it is the headline's when no key has
 * that name. `keys`: the score keys of the run's attempts.
 * When the headline is not a mean of the score (such as a share above a cutoff), the column has
 * the score's name, and the bar of the score's mean metric if it has one. */
export function mainScore(version: EvalVersion, results: EvalResult[], keys: string[]): ScoreColumn | undefined {
  const { headline, headDef, headScore, headScoreDef } = headlineOf(version);
  const named = (name: string) => keys.find((k) => k === name || k.endsWith(`/${name}`));
  const headKey =
    headScore && (named(headScore) ?? (headScoreDef?.attemptName && named(headScoreDef.attemptName)) ?? named('score'));
  // Else the first score the version declares: the order of the stored keys has no meaning.
  const key = headKey ?? version.scores.map((s) => named(s.key)).find(Boolean) ?? keys[0];
  if (!key) return undefined;
  const label = key.split('/').pop() ?? '';
  const def = version.scores.find((s) => s.key === label || s.attemptName === label);
  if (!headKey)
    return {
      key,
      label: def?.displayName || label,
      ...(def?.description && { description: def.description }),
      ...(def?.type === 'ordinal' && { ordinal: true }),
    };
  const fits = PER_SAMPLE.includes(headDef?.aggregation);
  const mean = version.metrics.find((m) => m.score === headScore && m.aggregation === 'mean');
  // With no mean metric, the headline's bar, when the score's values are on its scale.
  const [lo, hi] = [headScoreDef?.min ?? 0, headScoreDef?.max ?? 1];
  const onHeadScale = lo >= (headDef?.min ?? 0) && hi <= (headDef?.max ?? 1);
  const barMetric = fits ? headline : (mean?.key ?? (onHeadScale ? headline : undefined));
  const description = fits
    ? (headScoreDef?.description ?? headDef?.description)
    : [
        headScoreDef?.description,
        headDef?.description && `The headline, ${headDef.displayName}: ${headDef.description}`,
      ]
        .filter(Boolean)
        .join(' ');
  return {
    key,
    label: (fits ? headDef?.displayName : headScoreDef?.displayName) || def?.displayName || label,
    bar: barOf(version, results, barMetric),
    attemptScale: headScoreDef?.attemptScale,
    ...(description && { description }),
    ...(headScoreDef?.type === 'ordinal' && { ordinal: true }),
  };
}

export const scoreNumber = (v: unknown): number | undefined => {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return Number(v);
  if (typeof v !== 'string') return undefined;
  return { c: 1, yes: 1, true: 1, p: 0.5, i: 0, n: 0, no: 0, false: 0 }[v.trim().toLowerCase()];
};

/** A score as a harm, so that the highest is the worst. With no direction, the highest is first. */
export const harmOf = (v: number, direction?: Bar['safetyDirection']) =>
  direction === 'higher_is_better' ? -v : direction === 'nearer_zero_is_better' ? Math.abs(v) : v;

/** A flag's place in the sample order: the most severe first, no flag last. */
export const flagRank = (flag?: SnippetSeverity) => (flag ? SEVERITIES.indexOf(flag) : SEVERITIES.length);

/** `whole`: a whole number shows with no decimals. */
export const scoreText = (v: number | string | boolean | undefined, whole = false) =>
  typeof v === 'number' ? (whole && Number.isInteger(v) ? String(v) : v.toFixed(2)) : v === undefined ? '—' : String(v);

/** An attempt's value in a column, as text, and its bar. The bar is null when the column has no
 * direction or the value is not a number. */
export function columnValue(a: Pick<EvalAttempt, 'scores' | 'metrics'>, column: ScoreColumn) {
  const value = onScale(a.scores[column.key]?.value, column);
  const n = scoreNumber(value);
  const bar = column.bar && n !== undefined ? sampleBar(column.key, n, column.bar, a.metrics) : null;
  return { text: scoreText(value as number | string | boolean | undefined, column.ordinal), bar };
}
