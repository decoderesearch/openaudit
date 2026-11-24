import { InfoPopover } from '@/components/info-popover';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export type Toggle<T extends string> = { value: T; label: ReactNode; count?: number; info?: ReactNode };

/**
 * A row of joined toggles in one rounded box, as in the home feed ("Evaluations | Incidents"). At
 * most one is on: a click on the "on" toggle turns it off (`null`). `count`: after the label.
 * `info`: a question mark after the label that shows it on hover.
 */
export function SegmentedToggle<T extends string>({
  label,
  value,
  options,
  onValueChange,
  className,
  itemClassName,
}: {
  /** The accessible name of the group. */
  label: string;
  value: T | null;
  options: readonly Toggle<T>[];
  onValueChange: (value: T | null) => void;
  className?: string;
  /** Classes for each toggle button. */
  itemClassName?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'flex divide-x divide-slate-200 overflow-hidden rounded-full border border-slate-200 text-[10px] leading-4 font-medium whitespace-nowrap',
        className,
      )}
    >
      {options.map((o) => {
        const on = value === o.value;
        const button = (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onValueChange(on ? null : o.value)}
            className={cn(
              'flex cursor-pointer items-center gap-x-1 px-2.5 py-0.5 transition-colors',
              on ? 'bg-white text-slate-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800',
              itemClassName,
            )}
          >
            {o.label}
            {o.count !== undefined && <span className="tabular-nums opacity-60">{o.count}</span>}
          </button>
        );
        if (!o.info) return button;
        // The question mark is beside the button, not in it: a button cannot hold a button.
        return (
          <span key={o.value} className={cn('relative flex items-center', on ? 'bg-white' : 'bg-slate-100')}>
            {button}
            <InfoPopover
              label={typeof o.label === 'string' ? o.label : o.value}
              iconClassName="size-3"
              triggerClassName="absolute right-2.5"
              contentClassName="text-xs font-normal whitespace-normal"
            >
              {o.info}
            </InfoPopover>
          </span>
        );
      })}
    </div>
  );
}
