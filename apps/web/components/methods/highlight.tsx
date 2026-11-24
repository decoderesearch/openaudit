import { cn } from '@/lib/utils';

/**
 * One cell's part of the rounded sky frame of a highlighted table column, behind the cell's text.
 * The cell must have `CELL`. `edge`: the first (top) or last (bottom) cell of the column. `green`:
 * a first place, which keeps its green. `row`: a frame of a row; `edge` is then left or right.
 * `tone`: slate for a hover, where sky marks the current item.
 */
export function Frame({
  edge,
  green,
  row,
  tone = 'sky',
}: {
  edge?: 'top' | 'bottom' | 'left' | 'right';
  green?: boolean;
  row?: boolean;
  tone?: 'sky' | 'slate';
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute -z-10',
        tone === 'sky' ? 'border-sky-300' : 'border-slate-300',
        row ? 'inset-x-0 inset-y-0.5 border-y' : 'inset-x-0.5 inset-y-0 border-x',
        green ? 'bg-emerald-50' : tone === 'sky' ? 'bg-sky-50' : 'bg-slate-100',
        edge === 'top' && 'top-1 rounded-t-md border-t',
        edge === 'bottom' && 'bottom-1 rounded-b-md border-b',
        edge === 'left' && 'left-1 rounded-l-md border-l',
        edge === 'right' && 'right-1 rounded-r-md border-r',
      )}
    />
  );
}

/** The class of a cell with a `Frame`. */
export const CELL = 'relative z-0';
