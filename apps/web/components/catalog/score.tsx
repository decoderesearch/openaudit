import { cn } from '@/lib/utils';
import type { EvalResult } from '@openaudit/spec';
import type { ReactNode } from 'react';

// A result's score: its value, and a bar for its safety direction. Safe in server and client code.

/** `range`: the metric's min and max, for a bar when the unit has no scale (a 1 to 10 judge score). */
export type Score = Pick<EvalResult, 'metric' | 'value' | 'unit' | 'stderr' | 'safetyDirection'> & {
  range?: [number, number];
};

/** The metric's min and max in its eval version's `metrics`. "key@judge" uses the metric "key". */
export function metricRange(metrics: unknown, metric: string): [number, number] | undefined {
  const key = metric.split('@')[0];
  const def = (Array.isArray(metrics) ? metrics : []).find((m) => m?.key === key);
  return typeof def?.min === 'number' && typeof def?.max === 'number' ? [def.min, def.max] : undefined;
}

/** A result's value with its unit and standard error. `round`: at most 2 decimal places.
 * `fixed`: always 2 decimal places. `noStderr`: the value and unit only. */
export function ResultValue({
  result: r,
  round,
  fixed,
  noStderr,
}: {
  result: Score;
  round?: boolean;
  fixed?: boolean;
  noStderr?: boolean;
}) {
  const show = (n: number) => (fixed || (round && !Number.isInteger(n)) ? n.toFixed(2) : n);
  return (
    <>
      {show(r.value)}
      {r.unit === 'percent' ? '%' : ''}
      {!noStderr && r.stderr !== undefined && <span className="text-slate-400"> ± {show(r.stderr)}</span>}
    </>
  );
}

/** The bar (or `top`), with the metric and value below it. With neither: the metric and value only.
 * `end`: the metric line is at the right, not centered, and 2 px nearer. */
export function ScoreBar({ result: r, top, end }: { result: Score; top?: ReactNode; end?: boolean }) {
  return top || ranged(r) !== undefined ? (
    <div className="relative min-w-0 flex-1">
      {top || <SafetyBar result={r} />}
      <MetricValue
        result={r}
        end={end}
        className={cn('absolute inset-x-0', end ? 'top-[calc(100%+2px)]' : 'top-[calc(100%+4px)]')}
      />
    </div>
  ) : (
    <MetricValue result={r} end={end} className="flex-1" />
  );
}

/** The metric, then the value, on one centered line (`end`: at the right). A long metric is cut;
 * its title shows all. */
function MetricValue({ result: r, end, className }: { result: Score; end?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'flex min-w-0 gap-x-1.5 text-[9px] leading-none whitespace-nowrap',
        end ? 'justify-end' : 'justify-center',
        className,
      )}
    >
      {r.metric && (
        <span title={r.metric} className="min-w-0 truncate text-slate-400">
          {r.metric}
        </span>
      )}
      <span className="shrink-0 font-mono text-slate-500">
        <ResultValue result={r} round noStderr />
      </span>
    </span>
  );
}

/**
 * Green: the part of the score that is good for safety. Red: the rest. With no safety direction,
 * grey shows the score itself.
 */
export function SafetyBar({ result: r, className }: { result: Score; className?: string }) {
  const v = ranged(r);
  const d = r.safetyDirection;
  const neutral = d === 'neither' && v !== undefined;
  const share = neutral ? undefined : safeShare(r, v);
  const label =
    share !== undefined
      ? `${Math.round(share * 100)}% good for safety`
      : neutral
        ? `${Math.round(v * 100)}%, no direction is better for safety`
        : 'Safety direction not known';
  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className={cn('flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200', className)}
    >
      {share !== undefined && (
        <>
          <div className="bg-emerald-600" style={{ width: `${share * 100}%` }} />
          <div className="flex-1 bg-rose-600" />
        </>
      )}
      {neutral && <div className="bg-slate-400" style={{ width: `${v * 100}%` }} />}
    </div>
  );
}

/** The value from 0 to 1: a fraction, a percent, or a value in its metric's range. */
function scaled(r: Score) {
  if (r.unit === 'fraction') return r.value;
  if (r.unit === 'percent') return r.value / 100;
  const [min, max] = r.range ?? [0, 0];
  return max > min ? (r.value - min) / (max - min) : undefined;
}

/** The scaled value when it fits the bar: 0 to 1, or −1 to 1 when nearer zero is better. */
function ranged(r: Score) {
  const v = scaled(r);
  if (v === undefined) return undefined;
  const fits = r.safetyDirection === 'nearer_zero_is_better' ? Math.abs(v) <= 1 : v >= 0 && v <= 1;
  return fits ? v : undefined;
}

/** 0 to 1, from the safety direction. Undefined when the direction or the scale is not known. */
export function safeShare(r: Score, v = ranged(r)) {
  const d = r.safetyDirection;
  if (v === undefined || !d || d === 'neither') return undefined;
  if (d === 'nearer_zero_is_better') return Math.abs(v) <= 1 ? 1 - Math.abs(v) : undefined;
  if (v < 0 || v > 1) return undefined;
  return d === 'higher_is_better' ? v : 1 - v;
}
