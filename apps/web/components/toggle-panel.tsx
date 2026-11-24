'use client';

import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

/** `warn` shows the button in rose, for a panel that reports something missing. */
export type Panel = { label: string; content: ReactNode; warn?: boolean };

/**
 * `lead` content with toggle buttons at the right of it (`top` goes above both, and `corner` at the
 * right of `top`); a click on a button opens its panel below them.
 */
export function TogglePanels({
  top,
  corner,
  lead,
  panels,
}: {
  top?: ReactNode;
  corner?: ReactNode;
  lead?: ReactNode;
  panels: Panel[];
}) {
  const [open, setOpen] = useState<string[]>([]);
  const id = useId();
  const toggle = (label: string) => setOpen((o) => (o.includes(label) ? o.filter((l) => l !== label) : [...o, label]));

  return (
    <div className="@container">
      {corner ? (
        <div className="mb-1 flex items-center justify-between gap-x-3">
          <div className="min-w-0">{top}</div>
          <div className="shrink-0">{corner}</div>
        </div>
      ) : (
        top
      )}
      <div className="flex flex-col gap-2 @3xl:flex-row @3xl:items-center @3xl:justify-between @3xl:gap-x-4">
        <div className="min-w-0">{lead}</div>
        <div className="grid grid-cols-2 gap-x-1.5 gap-y-1 text-xs @3xl:flex @3xl:flex-wrap @3xl:justify-end">
          {panels.map((p, i) => {
            const isOpen = open.includes(p.label);
            return (
              <button
                key={p.label}
                type="button"
                aria-expanded={isOpen}
                aria-controls={`${id}-${i}`}
                onClick={() => toggle(p.label)}
                className={cn(
                  'flex cursor-pointer items-center justify-center gap-x-1 rounded-full border py-1.5 pr-2 pl-3 font-medium transition-colors @3xl:py-1',
                  p.warn
                    ? isOpen
                      ? 'border-rose-300 bg-rose-100 text-rose-800'
                      : 'border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:text-rose-800'
                    : isOpen
                      ? 'border-sky-700 bg-sky-50 text-sky-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-sky-700 hover:text-sky-800',
                )}
              >
                {p.label}
                <ChevronDown className={cn('size-3.5 transition-transform', isOpen && 'rotate-180')} />
              </button>
            );
          })}
        </div>
      </div>
      {panels.map((p, i) => {
        const isOpen = open.includes(p.label);
        return (
          <div
            key={p.label}
            id={`${id}-${i}`}
            inert={!isOpen}
            className={cn(
              'grid transition-[grid-template-rows] duration-200',
              isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            )}
          >
            <div className="overflow-hidden">
              <div className="pt-2">{p.content}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
