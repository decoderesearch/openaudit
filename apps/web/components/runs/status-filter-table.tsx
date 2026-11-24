'use client';

import { Fold } from '@/components/fold';
import { SortTable, type SortColumn, type SortRow } from '@/components/runs/sortable-table';
import { cn } from '@/lib/utils';
import type { RunStatus } from '@openaudit/spec';
import { useState, type ReactNode } from 'react';

/** Statuses whose rows do not show until the reader turns them on. */
const HIDDEN = [
  ['cancelled', 'Cancelled'],
  ['failed', 'Failed'],
] as const satisfies [RunStatus, string][];

export type StatusRow = SortRow & { status: RunStatus };

/**
 * A boxed table of runs with sortable headers. Cancelled and failed runs do not show; a pill
 * above the table for each shows them. `label`: the table's name for screen readers. `notice`: a
 * row under the column headers.
 */
export function StatusFilterTable({
  id,
  label,
  columns,
  rows,
  notice,
  className,
}: {
  id?: string;
  label: string;
  columns: SortColumn[];
  rows: StatusRow[];
  notice?: ReactNode;
  className?: string;
}) {
  const [shown, setShown] = useState<RunStatus[]>([]);
  const pills = HIDDEN.map(([status, text]) => ({
    status,
    text,
    count: rows.filter((r) => r.status === status).length,
  })).filter((p) => p.count > 0);
  const hidden = new Set<RunStatus>(HIDDEN.map(([s]) => s).filter((s) => !shown.includes(s)));
  const visible = rows.filter((r) => !hidden.has(r.status));
  const toolbar = pills.length > 0 && (
    <div role="group" aria-label={`${label} to show`} className="flex items-center justify-end gap-x-1.5">
      {pills.map((p) => {
        const on = shown.includes(p.status);
        return (
          <button
            key={p.status}
            type="button"
            aria-pressed={on}
            onClick={() => setShown((s) => (on ? s.filter((x) => x !== p.status) : [...s, p.status]))}
            className={cn(
              'flex h-6 cursor-pointer items-center gap-x-1 rounded-full border px-2.5 text-[11px] font-medium',
              on
                ? 'border-slate-600 bg-slate-600 text-white hover:bg-slate-700'
                : 'border-slate-200 bg-slate-100 text-slate-700 hover:border-slate-300 hover:bg-slate-200',
            )}
          >
            {p.text}
            <span className="tabular-nums opacity-60">{p.count}</span>
          </button>
        );
      })}
    </div>
  );
  return (
    <Fold more="Show more rows">
      <section
        id={id}
        aria-label={label}
        className={cn(
          'scroll-mt-10 overflow-auto rounded-lg border border-slate-200 bg-white lg:max-h-[40rem]',
          className,
        )}
      >
        <SortTable
          columns={columns}
          rows={visible}
          toolbar={toolbar || undefined}
          notice={notice}
          className="text-xs"
        />
      </section>
    </Fold>
  );
}
