'use client';

import { cn } from '@/lib/utils';
import { ToggleGroup } from 'radix-ui';
import type { ReactNode } from 'react';

export type Segment<T extends string> = { value: T; label: ReactNode };

const ROOT = 'inline-flex h-7 shrink-0 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50';
const ITEM =
  'relative -ml-px flex cursor-pointer items-center justify-center border border-slate-200 bg-white transition-colors first:ml-0 hover:z-10 hover:border-sky-700 hover:bg-sky-100 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-sky-700/40 focus-visible:outline-none data-[state=on]:z-10 data-[state=on]:border-sky-700 data-[state=on]:bg-sky-700 data-[state=on]:text-white';
const CORNERS = 'first:rounded-l-lg last:rounded-r-lg';
const ROUND = 'first:rounded-l-full last:rounded-r-full';
/** `vertical`: joined top to bottom. */
const COLUMN = 'ml-0 -mt-px first:mt-0 first:rounded-t-md last:rounded-b-md';
/** `slate`: slate in place of sky. */
const SLATE = 'hover:border-slate-400 hover:bg-slate-100 data-[state=on]:border-slate-500 data-[state=on]:bg-slate-500';
const TEXT = 'px-3 text-[11px] font-medium text-slate-500 sm:px-5';
/** `small`: smaller bold capitals, and slate in place of sky. */
const SMALL =
  'px-2 text-[10px] font-bold tracking-wide text-slate-500 uppercase hover:border-slate-400 hover:bg-slate-100 data-[state=on]:border-slate-600 data-[state=on]:bg-slate-600';
/** `light`: the "on" button is light slate with dark text. */
const LIGHT = 'data-[state=on]:border-slate-300 data-[state=on]:bg-slate-300 data-[state=on]:text-slate-800';

/**
 * A row of joined buttons. Exactly one is on at all times: a click on the "on" button does nothing.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onValueChange,
  disabled,
  small,
  round,
  slate,
  light,
  vertical,
  className,
  itemClassName,
}: {
  /** The accessible name of the group. */
  label: string;
  value: T;
  options: readonly Segment<T>[];
  onValueChange: (value: T) => void;
  disabled?: boolean;
  small?: boolean;
  /** Fully rounded ends. */
  round?: boolean;
  slate?: boolean;
  light?: boolean;
  /** Buttons in a column, not a row. */
  vertical?: boolean;
  className?: string;
  /** Classes for each button, after the variants. */
  itemClassName?: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={value}
      disabled={disabled}
      onValueChange={(v) => v && onValueChange(v as T)}
      className={cn(ROOT, vertical && 'h-auto flex-col', className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className={cn(
            ITEM,
            vertical ? COLUMN : round ? ROUND : CORNERS,
            small ? SMALL : TEXT,
            slate && SLATE,
            light && LIGHT,
            itemClassName,
          )}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
