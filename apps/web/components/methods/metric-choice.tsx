'use client';

import { replaceUrlParam } from '@/lib/url-param';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';

/** `scope`: an eval's slug, on a page with more than one eval. */
const param = (scope?: string) => (scope ? `metric-${scope}` : 'metric');

/** The metric that an eval's board and samples show (`?metric=`, a metric key), and a function
 * that sets it. Null: the headline metric. */
export function useMetricChoice(scope?: string): [string | null, (key: string | null) => void] {
  const key = useSearchParams()?.get(param(scope)) ?? null;
  return [key, (k) => replaceUrlParam(param(scope), k ?? undefined)];
}

/** A cell that picks the metric `metric` for the samples of the eval `scope`. A second click picks
 * the headline again. The button covers the cell; put other controls in it at `relative z-10`. */
export function MetricPick({
  scope,
  metric,
  label,
  className,
  children,
}: {
  scope: string;
  metric: string;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const [key, setKey] = useMetricChoice(scope);
  const on = key === metric;
  return (
    <div
      className={cn(
        className,
        'relative transition-colors hover:border-sky-300',
        on && 'border-sky-700 ring-1 ring-sky-700 hover:border-sky-700',
      )}
    >
      <button
        type="button"
        aria-pressed={on}
        aria-label={`Show the samples by ${label}`}
        title={on ? 'Show the samples by the headline metric' : `Show the samples by ${label}`}
        onClick={() => setKey(on ? null : metric)}
        className="absolute inset-0 cursor-pointer rounded-md"
      />
      {children}
    </div>
  );
}
