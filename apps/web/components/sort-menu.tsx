'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';

/** A menu of `sorts` (label by key) that shows the picked one, as text with a caret. `label`: the
 * menu's name for screen readers. */
export function SortMenu<K extends string>({
  sorts,
  value,
  onPick,
  label = 'Sort',
}: {
  sorts: Record<K, string>;
  value: K;
  onPick: (sort: K) => void;
  label?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className="flex cursor-pointer items-center gap-x-0.5 text-[11px] font-medium text-slate-600 transition-colors hover:text-sky-700"
      >
        {sorts[value]}
        <ChevronDown className="size-3.5 shrink-0" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onPick(v as K)}>
          {(Object.keys(sorts) as K[]).map((k) => (
            <DropdownMenuRadioItem key={k} value={k} className="cursor-pointer text-xs">
              {sorts[k]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
