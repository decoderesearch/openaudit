'use client';

import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

/** A value that a column sorts by. Null: last, in both directions. */
export type SortValue = string | number | null;
/** A column. `sorts: false`: its header does not sort. `info`: an icon after the label, out of
 * the sort button. */
export type SortColumn = { key: string; label: ReactNode; className?: string; sorts?: false; info?: ReactNode };
/** A table row, with its value for each column that sorts. */
export type SortRow = { key: string; values: Record<string, SortValue>; node: ReactNode };
type Sort = { column: string; dir: 'asc' | 'desc' } | null;

const valid = (v: SortValue | undefined) =>
  v === undefined || (typeof v === 'number' && !Number.isFinite(v)) ? null : v;

/** Sorts rows: text by its words and numbers in it, else by number. */
export function sortRows<R extends SortRow>(rows: R[], sort: Sort): R[] {
  if (!sort) return rows;
  const sign = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const [x, y] = [valid(a.values[sort.column]), valid(b.values[sort.column])];
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    if (typeof x === 'number' && typeof y === 'number') return sign * (x - y);
    return sign * String(x).localeCompare(String(y), 'en', { sensitivity: 'base', numeric: true });
  });
}

/**
 * A table whose column headers sort the rows. A click on a header goes from ascending to
 * descending to the first order. `cols`: the table's `colgroup`. `toolbar`: a first head row; as a
 * function, it gets `first`: the rows are in their first order. `notice`: a head row under the
 * column headers, the full width.
 */
export function SortTable({
  columns,
  rows,
  cols,
  toolbar,
  notice,
  className,
  headClassName,
}: {
  columns: SortColumn[];
  rows: SortRow[];
  cols?: ReactNode;
  toolbar?: ReactNode | ((first: boolean) => ReactNode);
  notice?: ReactNode;
  className?: string;
  headClassName?: string;
}) {
  const [sort, setSort] = useState<Sort>(null);
  const shown = useMemo(() => sortRows(rows, sort), [rows, sort]);
  const step = (column: string) =>
    setSort((s) => (s?.column !== column ? { column, dir: 'asc' } : s.dir === 'asc' ? { column, dir: 'desc' } : null));
  const head = 'px-3 py-1.5 font-medium';
  return (
    <table className={cn('w-full text-left text-sm', className)}>
      {cols && <colgroup>{cols}</colgroup>}
      <thead className={cn('sticky top-0 z-10 bg-slate-50 text-xs text-slate-500', headClassName)}>
        {toolbar && (
          <tr>
            <th colSpan={columns.length} className="h-10 px-3 py-1.5 font-normal">
              {typeof toolbar === 'function' ? toolbar(!sort) : toolbar}
            </th>
          </tr>
        )}
        <tr>
          {columns.map((c) => {
            if (c.sorts === false)
              return (
                <th key={c.key} className={cn(head, c.className)}>
                  <span className="inline-flex max-w-full items-center gap-1 align-middle">
                    {c.label}
                    {c.info && <span className="inline-flex shrink-0">{c.info}</span>}
                  </span>
                </th>
              );
            const dir = sort?.column === c.key ? sort.dir : undefined;
            const Icon = dir === 'asc' ? ArrowUp : dir === 'desc' ? ArrowDown : ChevronsUpDown;
            return (
              <th
                key={c.key}
                aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}
                className={cn(head, c.className)}
              >
                <span className="inline-flex max-w-full items-center gap-1 align-middle">
                  <button
                    type="button"
                    onClick={() => step(c.key)}
                    className={cn(
                      'inline-flex min-w-0 cursor-pointer items-center gap-0.5 text-left hover:text-slate-800',
                      dir && 'text-slate-800',
                    )}
                  >
                    {c.label}
                    <Icon className={cn('size-3 shrink-0', !dir && 'text-slate-300')} aria-hidden />
                  </button>
                  {c.info && <span className="inline-flex shrink-0">{c.info}</span>}
                </span>
              </th>
            );
          })}
        </tr>
        {notice && (
          <tr>
            <td colSpan={columns.length} className="p-0">
              {notice}
            </td>
          </tr>
        )}
      </thead>
      <tbody className="isolate divide-y divide-slate-100">{shown.map((r) => r.node)}</tbody>
    </table>
  );
}

/** A metric row, with what it sorts by: its metric's name and its value (null: last). */
export type SortableRow = { key: string; name: string; value: number | null; node: ReactNode };

/**
 * A metric table whose Metric and value headers sort the rows. `valueLabel`: for example 'Mean'.
 * `nameLabel`: the Metric header. `judges`: a Judges column, which does not sort.
 */
export function SortableTable({
  rows,
  valueLabel,
  nameLabel = 'Metric',
  judges,
  headClassName,
}: {
  rows: SortableRow[];
  valueLabel: string;
  nameLabel?: string;
  judges?: boolean;
  headClassName?: string;
}) {
  const columns: SortColumn[] = [
    { key: 'name', label: nameLabel },
    { key: 'value', label: valueLabel, className: 'text-center' },
    ...(judges ? [{ key: 'judges', label: 'Judges', className: 'text-center', sorts: false as const }] : []),
  ];
  return (
    <SortTable
      columns={columns}
      rows={rows.map((r) => ({ key: r.key, values: { name: r.name, value: r.value }, node: r.node }))}
      headClassName={headClassName}
    />
  );
}
