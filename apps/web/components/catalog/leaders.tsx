import { ReleaseWarning } from '@/components/catalog/release-warning';
import { SafetyBar, safeShare } from '@/components/catalog/score';
import Link from '@/components/link';
import type { Leader } from '@/lib/leaders';
import { MEDALS } from '@/lib/methods';
import { releasedAfter } from '@/lib/release-dates';
import { cn } from '@/lib/utils';

export { MEDALS };

/** One end of a ranking: each rank, name and score, with a safety bar under the score. `ranked`:
 * false for no ranks. `medals`: a medal in place of each of the first 3 ranks. `scores`: false for
 * the bar only. `bars`: false for no bar. `barClassName`: the bar's height. `warn`: a
 * `ReleaseWarning` after each name. */
export function Leaders({
  leaders,
  onPick,
  ranked = true,
  medals = false,
  scores = true,
  bars = true,
  barClassName = 'h-1',
  warn = false,
  nameClassName = 'text-xs',
  className,
}: {
  leaders: Leader[];
  onPick?: () => void;
  ranked?: boolean;
  medals?: boolean;
  scores?: boolean;
  bars?: boolean;
  barClassName?: string;
  warn?: boolean;
  nameClassName?: string;
  className?: string;
}) {
  return (
    <ol className={cn('flex flex-col gap-y-1 text-slate-700 tabular-nums', className)}>
      {leaders.map((t, i) => (
        <li
          key={t.href}
          className={cn(
            'grid items-center gap-x-1.5',
            !scores && !bars
              ? medals
                ? 'grid-cols-[1rem_minmax(0,1fr)] gap-x-2'
                : ranked
                  ? 'grid-cols-[0.625rem_minmax(0,1fr)]'
                  : 'grid-cols-[minmax(0,1fr)]'
              : medals
                ? 'grid-cols-[1rem_minmax(0,1fr)_2.5rem] gap-x-2'
                : ranked
                  ? 'grid-cols-[0.625rem_minmax(0,1fr)_2.5rem]'
                  : 'grid-cols-[minmax(0,1fr)_2.5rem]',
          )}
        >
          {medals ? (
            <span aria-label={`Rank ${i + 1}`} className="text-left text-sm leading-none">
              {MEDALS[i] ?? i + 1}
            </span>
          ) : (
            ranked && <span className="text-right text-[10px] text-slate-400">{i + 1}</span>
          )}
          {warn && releasedAfter(t.released?.model, t.released?.eval) ? (
            <span className={cn('flex min-w-0 items-center gap-x-1 normal-nums', nameClassName)}>
              <Link href={t.href} onClick={onPick} className="relative z-10 truncate text-slate-700 hover:underline">
                {t.label}
              </Link>
              <ReleaseWarning model={t.released?.model} evalDate={t.released?.eval} className="shrink-0" />
            </span>
          ) : (
            <span className={cn('truncate normal-nums', nameClassName)}>
              <Link href={t.href} onClick={onPick} className="relative z-10 text-slate-700 hover:underline">
                {t.label}
              </Link>
            </span>
          )}
          {(scores || bars) && (
            <div className="text-right text-[9px] leading-[10px] font-medium">
              {scores && t.score}
              {bars && t.bar && safeShare(t.bar) !== undefined && <SafetyBar result={t.bar} className={barClassName} />}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

/** The 3 that rank best and the 3 that rank worst, side by side, with their safety bars. `ranked`:
 * as in `Leaders`. `compact`: smaller names, no scores or bars, and a darker "Worst". `warnBest`:
 * `warn` of `Leaders` on the best only. */
export function BestWorst({
  best,
  worst,
  onPick,
  ranked = true,
  compact = false,
  warnBest = false,
  className,
}: {
  best: Leader[];
  worst: Leader[];
  onPick?: () => void;
  ranked?: boolean;
  compact?: boolean;
  warnBest?: boolean;
  className?: string;
}) {
  // In line with the names: the rank column (0.625rem) and the gap (0.375rem).
  const head = cn('text-[9px] font-bold tracking-wide uppercase', ranked && 'pl-4');
  const names = compact ? 'text-[11px]' : 'text-xs';
  return (
    <div className={cn('grid grid-cols-2 gap-x-4', className)}>
      <div className="flex min-w-0 flex-col gap-y-1">
        <span className={cn(head, 'text-emerald-600')}>Best</span>
        <Leaders
          leaders={best}
          onPick={onPick}
          ranked={ranked}
          scores={!compact}
          bars={!compact}
          warn={warnBest}
          nameClassName={names}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-y-1">
        <span className={cn(head, compact ? 'text-rose-700' : 'text-rose-600')}>Worst</span>
        <Leaders
          leaders={worst}
          onPick={onPick}
          ranked={ranked}
          scores={!compact}
          bars={!compact}
          nameClassName={names}
        />
      </div>
    </div>
  );
}
