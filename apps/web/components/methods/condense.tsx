import { INSET_TITLE } from '@/components/box-title';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

/** The first `top` rows and the rows of `mine`, in order. `null` is where rows are left out. All
 * rows when that leaves out fewer than two. */
export function condense<T>(rows: T[], mine: (row: T) => boolean, top = 3): (T | null)[] {
  const kept = rows.flatMap((r, i) => (i < top || mine(r) ? [i] : []));
  if (rows.length - kept.length < 2) return rows;
  const out = kept.flatMap((i, n) => (n > 0 && i > kept[n - 1]! + 1 ? [null, rows[i]!] : [rows[i]!]));
  return (kept.at(-1) ?? -1) < rows.length - 1 ? [...out, null] : out;
}

/** The row that `condense` puts where rows are left out. `span`: the table's column count. */
export function GapRow({ span }: { span: number }) {
  return (
    <tr aria-hidden>
      <td colSpan={span} className="py-0 text-center text-sm leading-5 text-slate-400">
        ⋯
      </td>
    </tr>
  );
}

/** A short table in a panel, with padding and `label` above it. */
export function Ranked({ label = 'Ranked Results', children }: { label?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-5">
      <p className={cn(INSET_TITLE, 'flex flex-wrap items-center gap-x-1.5 text-slate-400')}>{label}</p>
      {children}
    </div>
  );
}
