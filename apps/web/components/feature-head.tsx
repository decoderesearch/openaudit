'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';

/** A note that a button in `FeatureHead` shows, such as the problem or the caveats. */
export type FeatureNote = { label: string; body: ReactNode };

/** The top of a feature's panel: `head` (its name and Tutorial button) at the left, and a button for
 * each of `notes` at the right. A click on a button shows its note in a popover under it. */
export function FeatureHead({ head, notes }: { head: ReactNode; notes: FeatureNote[] }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">{head}</div>
      <div className="ml-auto flex items-center gap-x-2">
        {notes.map((n) => (
          <NoteButton key={n.label} note={n} />
        ))}
      </div>
    </div>
  );
}

function NoteButton({ note }: { note: FeatureNote }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'flex cursor-pointer items-center gap-x-1 rounded-full border py-1.5 pr-3 pl-4 text-xs font-semibold transition-colors',
          open
            ? 'border-slate-400 bg-slate-100 text-slate-800'
            : 'border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-slate-800',
        )}
      >
        {note.label}
        <ChevronDown aria-hidden className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label={note.label}
        className="w-[min(320px,calc(100vw-2rem))] px-4 py-3 shadow-lg"
      >
        {note.body}
      </PopoverContent>
    </Popover>
  );
}
