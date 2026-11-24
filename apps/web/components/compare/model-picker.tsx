'use client';

import { Meter } from '@/components/deploymeter/meter';
import { filterItems } from '@/components/nav/nav-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { modelNameOf } from '@/lib/compare';
import { votesOf } from '@/lib/deploymeter';
import type { SnippetFeedEntry } from '@/lib/server/snippet-feed';
import { cn } from '@/lib/utils';
import { ChevronDown, LoaderCircle, X } from 'lucide-react';
import { useState } from 'react';

/** The model of one column: a button that opens the models by name, with a search. Each row shows
 * the model's developer and name, and its Deploymeter at the right. `taken`: the models of the
 * other columns, not in the list. `current`: the column's model name, `label` its name to show.
 * `onRemove`: the X at the right, which removes the column's model. */
export function ModelPicker({
  index,
  current,
  label,
  choices,
  taken,
  loading,
  onPick,
  onRemove,
}: {
  index: number;
  current: string | null;
  label: string | null;
  choices: SnippetFeedEntry[];
  taken: string[];
  loading?: boolean;
  onPick: (name: string) => void;
  onRemove?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const shown = filterItems(
    choices.filter((c) => !taken.includes(modelNameOf(c.href))),
    query,
    (c) => `${c.label} ${c.org.label} ${modelNameOf(c.href)}`,
  );

  return (
    <div className="flex min-w-0 items-center gap-x-1">
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setQuery('');
        }}
      >
        <PopoverTrigger
          aria-label={`Model ${index + 1}`}
          disabled={loading}
          className={cn(
            'flex h-9 min-w-0 flex-1 cursor-pointer items-center justify-between gap-x-1 rounded-md border border-slate-200 bg-white px-2 text-left text-sm text-slate-700 shadow-xs transition-colors hover:border-slate-300 data-[state=open]:border-sky-600 sm:h-8 sm:text-xs',
            !current && 'text-slate-400',
          )}
        >
          <span className="truncate">{current ? (label ?? `${current} (no card)`) : 'Choose a model'}</span>
          {loading ? (
            <LoaderCircle aria-label="Loading" className="size-3.5 shrink-0 animate-spin text-slate-400" />
          ) : (
            <ChevronDown aria-hidden className="size-3.5 shrink-0 text-slate-400" />
          )}
        </PopoverTrigger>
        <PopoverContent
          align="start"
          collisionPadding={8}
          // On a phone, the keyboard does not open until the reader taps the search.
          onOpenAutoFocus={(e) => matchMedia('(pointer: coarse)').matches && e.preventDefault()}
          className="flex max-h-[min(36rem,75dvh)] w-[min(24rem,calc(100vw-1rem))] flex-col p-0"
        >
          <div className="shrink-0 border-b border-slate-100 p-2">
            <Input
              type="search"
              aria-label="Search models"
              placeholder="Search models"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 text-sm md:text-xs"
            />
          </div>
          <ul aria-label="Models" className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
            {shown.length === 0 && <li className="px-3 py-2 text-xs text-slate-500">No models match.</li>}
            {shown.map((c) => (
              <li key={c.key}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setQuery('');
                    onPick(modelNameOf(c.href));
                  }}
                  className="flex w-full cursor-pointer items-center justify-between gap-x-3 px-3 py-1.5 text-left hover:bg-sky-50 focus-visible:bg-sky-50 focus-visible:outline-none"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[9px] leading-3 font-semibold tracking-wide text-slate-400 uppercase">
                      {c.org.label}
                    </span>
                    <span className="truncate text-[13px] leading-5 font-medium text-slate-800">{c.label}</span>
                  </span>
                  <Meter score={c.meter} votes={c.judges ? votesOf(c.judges) : null} small />
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
      {current && onRemove && (
        <button
          type="button"
          aria-label={`Remove model ${index + 1}`}
          title="Remove"
          onClick={onRemove}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-rose-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
