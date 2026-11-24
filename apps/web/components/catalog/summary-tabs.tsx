'use client';

import { cn } from '@/lib/utils';
import { useState, type ReactNode } from 'react';

/** Parts of the executive summary in one slate box: a toggle of their titles (`about` on hover),
 * then the part that is on (the first at the start). All parts stay in the page; the others are
 * hidden. */
export function SummaryTabs({
  parts,
  className,
}: {
  parts: { key: string; title: string; about?: string; body: ReactNode }[];
  className?: string;
}) {
  const [shown, setShown] = useState(parts[0]?.key);
  return (
    <div className={cn('flex flex-col gap-y-2.5 rounded-md bg-slate-50 px-4 py-3.5', className)}>
      <div role="tablist" aria-label="Summary" className="flex self-start rounded-md bg-slate-200/70 p-0.5">
        {parts.map((p) => (
          <button
            key={p.key}
            type="button"
            role="tab"
            aria-selected={p.key === shown}
            title={p.about}
            onClick={() => setShown(p.key)}
            className={cn(
              'cursor-pointer rounded px-3.5 py-1 text-[10px] leading-4 font-semibold tracking-wide uppercase transition-colors',
              p.key === shown ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {p.title}
          </button>
        ))}
      </div>
      {parts.map((p) => (
        <div key={p.key} role="tabpanel" aria-label={p.title} data-summary-part={p.key} hidden={p.key !== shown}>
          {p.body}
        </div>
      ))}
    </div>
  );
}
