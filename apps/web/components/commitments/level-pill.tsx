import { formatPoints, LEVELS, type PillState, type Points } from '@/lib/commitments';
import { cn } from '@/lib/utils';

// The pill of a commitment's level. Server and client pages use it.

/** All pills have the same width, so they line up in a column. */
const SHAPE = {
  sm: 'h-5 w-16 text-[11px]',
  md: 'h-6 w-20 text-xs',
};
const BASE = 'inline-flex shrink-0 items-center justify-center rounded-full font-semibold whitespace-nowrap';
/** A pill with a word, not points: smaller and uppercase. */
const WORD = { sm: 'text-[9px] tracking-wide uppercase', md: 'text-[10px] tracking-wide uppercase' };

/** Partial and Full with `score`: a bar that the points fill, with the points in it. None Found:
 * "None". Other levels: the level's word. `size="md"`: larger, for a page's head. `bare`: only the
 * color, with no points or word. */
export function LevelPill({
  state,
  score,
  size = 'sm',
  bare,
  className,
}: {
  state: PillState;
  score?: Points | null;
  size?: 'sm' | 'md';
  bare?: boolean;
  className?: string;
}) {
  const level = LEVELS[state.level];
  if (score && (state.level === 'partial' || state.level === 'full'))
    return (
      <ScoreBar
        score={score}
        text={bare ? '' : formatPoints(score.points)}
        label={level.label}
        full={state.level === 'full'}
        size={size}
        className={className}
      />
    );
  return (
    <span title={level.about} className={cn(BASE, SHAPE[size], WORD[size], level.pill, className)}>
      {bare ? (
        <span className="sr-only">{level.label}</span>
      ) : state.level === 'none_found' ? (
        <>
          <span aria-hidden>None</span>
          <span className="sr-only">{level.label}</span>
        </>
      ) : (
        level.label
      )}
    </span>
  );
}

/** The fill of a bar: light emerald from 90% of the points, amber from 70%, orange from 40%, red
 * below. */
function fillTone(share: number) {
  if (share >= 0.9) return 'bg-emerald-100';
  if (share >= 0.7) return 'bg-amber-300';
  return share >= 0.4 ? 'bg-orange-300' : 'bg-red-300';
}

/** A pill that the points fill over slate, in `fillTone`, or all emerald when `full`. `text`: what
 * it shows. `label`: the word before the points for screen readers and the hover title. */
export function ScoreBar({
  score,
  text,
  label,
  full = false,
  size = 'sm',
  className,
}: {
  score: Points;
  text: string;
  label: string;
  full?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const words = `${label}: ${formatPoints(score.points)} of ${score.total} Points`;
  const share = score.points / (score.total || 1);
  return (
    <span
      title={words}
      className={cn(
        BASE,
        SHAPE[size],
        'relative overflow-hidden tabular-nums',
        full ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700',
        className,
      )}
    >
      {!full && (
        <span
          aria-hidden
          className={cn('absolute inset-y-0 left-0', fillTone(share))}
          style={{ width: `${100 * share}%` }}
        />
      )}
      <span className="sr-only">{words}</span>
      <span aria-hidden className="relative">
        {text}
      </span>
    </span>
  );
}
