'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export type MetricOption = { key: string; label: string; count: number };

const ALL = '';

/** A menu of the metrics that pick samples, and "Show All" when one is picked. `small`: the height
 * of the controls in a row of small toggles. */
export function MetricPicker({
  options,
  current,
  onPick,
  small,
}: {
  options: MetricOption[];
  current?: string;
  onPick: (key: string | undefined) => void;
  small?: boolean;
}) {
  const picked = options.find((o) => o.key === current);
  return (
    <div className="flex min-w-0 items-center gap-x-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Metric"
          className={cn(
            'flex max-w-72 min-w-0 cursor-pointer items-center gap-x-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 hover:border-slate-300',
            small ? 'h-5' : 'h-6',
          )}
        >
          <span className="truncate">{picked?.label ?? 'All Metrics'}</span>
          {picked && <span className="text-slate-400 tabular-nums">{picked.count}</span>}
          <ChevronDown className="size-3.5 shrink-0 text-slate-400" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 w-72">
          <DropdownMenuRadioGroup value={picked?.key ?? ALL} onValueChange={(k) => onPick(k === ALL ? undefined : k)}>
            {[{ key: ALL, label: 'All Metrics', count: null }, ...options].map((o) => (
              <DropdownMenuRadioItem key={o.key} value={o.key} className="cursor-pointer text-xs">
                <span className="min-w-0 flex-1">{o.label}</span>
                {o.count !== null && <span className="text-slate-400 tabular-nums">{o.count}</span>}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {picked && (
        <button
          type="button"
          onClick={() => onPick(undefined)}
          className={cn(
            'flex shrink-0 cursor-pointer items-center rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-sky-800 hover:border-slate-300 hover:bg-sky-50',
            small ? 'h-5' : 'h-6',
          )}
        >
          Show All
        </button>
      )}
    </div>
  );
}
