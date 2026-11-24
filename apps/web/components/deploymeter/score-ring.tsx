import { VERDICTS, verdictOf } from '@/lib/deploymeter';
import { cn } from '@/lib/utils';

/** A score from 0 to 100 as a ring in its verdict's color, with the number inside. Null: an empty
 * grey ring with a dash. */
export function ScoreRing({
  score,
  size = 'md',
  className,
}: {
  score: number | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const px = { sm: 36, md: 52, lg: 84 }[size];
  const width = { sm: 4, md: 5, lg: 7 }[size];
  const r = (px - width) / 2;
  const c = 2 * Math.PI * r;
  const label = score === null ? 'No score' : `${score} of 100`;
  return (
    <span role="img" aria-label={label} title={label} className={cn('relative inline-flex shrink-0', className)}>
      <svg width={px} height={px} viewBox={`0 0 ${px} ${px}`} className="-rotate-90">
        <circle cx={px / 2} cy={px / 2} r={r} fill="none" strokeWidth={width} className="stroke-slate-100" />
        {score !== null && (
          <circle
            cx={px / 2}
            cy={px / 2}
            r={r}
            fill="none"
            strokeWidth={width}
            strokeLinecap="round"
            strokeDasharray={`${(c * score) / 100} ${c}`}
            className={VERDICTS[verdictOf(score)].ring}
          />
        )}
      </svg>
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center font-semibold text-slate-800 tabular-nums',
          { sm: 'text-[11px]', md: 'text-sm', lg: 'text-2xl' }[size],
        )}
      >
        {score === null ? '–' : size === 'lg' ? `${score}%` : score}
      </span>
    </span>
  );
}

/** A score from 0 to 100 as a number with "%", in its verdict's color. Null: a grey dash. */
export function ScoreText({ score, className }: { score: number | null; className?: string }) {
  return (
    <span
      className={cn(
        'font-semibold tabular-nums',
        score === null ? 'text-slate-400' : VERDICTS[verdictOf(score)].score,
        className,
      )}
    >
      {score === null ? '–' : `${score}%`}
    </span>
  );
}

/** `judge`: the label for one judge's review. */
export function VerdictChip({ score, judge, className }: { score: number; judge?: boolean; className?: string }) {
  const v = VERDICTS[verdictOf(score)];
  return (
    <span title={v.text} className={cn('rounded border px-1.5 py-0.5 text-[11px]/none font-medium', v.chip, className)}>
      {judge ? v.judge : v.label}
    </span>
  );
}
