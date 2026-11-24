/** The classes of the method tables, as the model page's run table. `FLUSH`: in a `Panel`. */
export const TABLE_BOX = 'overflow-x-auto rounded-md border border-slate-200 bg-white';
export const FLUSH = 'rounded-none border-0';
export const TABLE = 'w-full text-left text-[13px]';
export const THEAD = 'bg-slate-50 text-[11px] text-slate-500';
export const ROW = 'hover:bg-sky-50/60';
/** A table box that scrolls down after 12 rows, with its header fixed. `wide`: only from `lg` up;
 * under `lg`, put the box in a `Fold`. */
export const scrollAfter12 = (rows: number, wide = false) =>
  rows > 12 &&
  (wide
    ? 'lg:max-h-[30rem] lg:overflow-y-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10'
    : 'max-h-[30rem] overflow-y-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10');
