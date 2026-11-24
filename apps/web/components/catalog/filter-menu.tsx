'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ChevronDown, X } from 'lucide-react';
import type { ReactNode } from 'react';

/** The value of a filter's "All" option. */
export const ALL = '';

/** `look`: an icon before the label, and classes for the label. */
type Option = [value: string, label: string, count: number | null, look?: { icon?: ReactNode; className?: string }];

/** A filter's menu: "All" first, then each option with its count (null: no count yet). `last`:
 * options below a line, which stay at the bottom while the others scroll. The trigger shows the
 * selected option, else `placeholder` (default: `all`). `name`: a value's text when no option has it. */
export function FilterMenu({
  label,
  all,
  placeholder = all,
  value,
  options,
  last = [],
  name,
  onChange,
  onOpenChange,
  className,
}: {
  label: string;
  all: string;
  placeholder?: string;
  value: string;
  options: Option[];
  last?: Option[];
  name: (value: string) => string;
  onChange: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  /** Classes for the trigger. */
  className?: string;
}) {
  const selected = [...options, ...last].find(([v]) => v === value);
  const item = ([v, text, n, look]: Option) => (
    <DropdownMenuRadioItem key={v} value={v} className="cursor-pointer text-xs">
      <span className={cn('flex min-w-0 flex-1 items-center gap-1.5', look?.className)}>
        {look?.icon}
        {text}
      </span>
      {n !== null && <span className="text-slate-400 tabular-nums">{n}</span>}
    </DropdownMenuRadioItem>
  );
  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        aria-label={`${label}: ${value === ALL ? all : (selected?.[1] ?? name(value))}`}
        className={cn(
          'flex h-6 max-w-full min-w-0 cursor-pointer items-center gap-x-1 rounded-md border bg-white px-2 text-xs font-medium select-none',
          value === ALL ? 'border-slate-200 text-slate-700 hover:border-slate-300' : 'border-sky-700 text-sky-800',
          className,
        )}
      >
        <span className="truncate">{value === ALL ? placeholder : (selected?.[1] ?? name(value))}</span>
        <ChevronDown className="ml-auto size-3.5 shrink-0 text-slate-400" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="flex max-h-72 w-72 flex-col overflow-hidden select-none">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange} className="flex min-h-0 flex-col">
          <div className="min-h-0 overflow-y-auto">
            <DropdownMenuRadioItem value={ALL} className="cursor-pointer text-xs">
              {all}
            </DropdownMenuRadioItem>
            {options.map(item)}
          </div>
          {last.length > 0 && <DropdownMenuSeparator className="shrink-0 bg-slate-300" />}
          {last.map(item)}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Clears all filters, and says how many items show. `noun`: the items, plural. */
export function ClearFilters({
  shown,
  total,
  noun,
  onClear,
}: {
  shown: number;
  total: number;
  noun: string;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onClear}
        className="flex h-6 cursor-pointer items-center gap-x-1 rounded-md border border-rose-200 bg-rose-50 px-2 text-[11px] font-medium text-rose-700 hover:border-rose-300 hover:bg-rose-100"
      >
        <X className="size-3" aria-hidden />
        Clear Filters
      </button>
      <span className="text-[11px] text-slate-500 tabular-nums">
        Showing {shown.toLocaleString()} of {total.toLocaleString()} {noun}
      </span>
    </div>
  );
}
