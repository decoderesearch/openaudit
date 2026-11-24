import { placeBand, placeTitle, type Place } from '@/lib/leaders';
import { ordinal } from '@/lib/methods';
import { cn } from '@/lib/utils';

/** A small "OF 22", for `ofClassName`. */
export const PLACE_OF = 'text-[10px] font-bold text-slate-400 uppercase';

/** A link on a place or a result, in a row that links elsewhere: on hover, the place (not the
 * metric) has a slate underline. `STAT_ROW_HOVER`: the row's hover color, but not when the link has
 * the hover. */
export const STAT_LINK =
  'stat-link relative z-10 [&_.place-text,&_.place-text_span]:decoration-slate-400 hover:[&_.place-text,&_.place-text_span]:underline';
export const STAT_ROW_HOVER = 'not-has-[.stat-link:hover]:hover:bg-sky-50/60';

export const BAND_TEXT = { top: 'text-emerald-700', middle: 'text-slate-600', bottom: 'text-red-700' } as const;

/** "15th of 22". The rank is bold, with the color of its `placeBand` (green at the top, red below
 * the middle), and a fixed width, so "of 22" is at the same place in each line. `ofClassName`: the
 * style of "of 22". `rankClassName`: of the rank. */
export function PlaceText({
  place,
  className,
  rankClassName,
  ofClassName,
}: {
  place: Place;
  className?: string;
  rankClassName?: string;
  ofClassName?: string;
}) {
  return (
    <span
      title={placeTitle(place)}
      className={cn('place-text font-sans text-[10px] whitespace-nowrap text-slate-500', className)}
    >
      <span
        className={cn(
          'inline-block w-[4.5ch] text-right font-bold tabular-nums',
          BAND_TEXT[placeBand(place)],
          rankClassName,
        )}
      >
        {ordinal(place.rank)}
      </span>{' '}
      <span className={ofClassName}>of {place.of}</span>
    </span>
  );
}
