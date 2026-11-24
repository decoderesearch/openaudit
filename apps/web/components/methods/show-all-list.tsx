'use client';

import { useState, type ReactNode } from 'react';

/** A list that shows its first `max` items, with a "Show all" link at the bottom for the rest. */
export function ShowAllList({ items, max = 3, className }: { items: ReactNode[]; max?: number; className?: string }) {
  const [all, setAll] = useState(false);
  const extra = items.length - max;
  return (
    <div className="flex flex-col gap-y-1.5">
      <ul className={className}>{all || extra <= 0 ? items : items.slice(0, max)}</ul>
      {extra > 0 && (
        <button
          type="button"
          onClick={() => setAll(!all)}
          className="cursor-pointer self-start text-[11px] font-medium text-sky-700 hover:underline"
        >
          {all ? 'Show less' : `Show all (${items.length})`}
        </button>
      )}
    </div>
  );
}
