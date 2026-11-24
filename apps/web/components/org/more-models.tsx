'use client';

import Link from '@/components/link';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { useState } from 'react';

export type MoreModel = { key: string; label: string; href?: string };

/** "(+N others)": a hover, or a tap on a phone, shows the models in a list. A model with no
 * `href` has no link. */
export function MoreModels({ models }: { models: MoreModel[] }) {
  const [open, setOpen] = useState(false);
  if (!models.length) return null;
  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={100} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={() => setOpen((on) => !on)}
          className="cursor-pointer hover:text-slate-700 hover:underline"
        >
          (+{models.length} {models.length === 1 ? 'other' : 'others'})
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-auto max-w-72 p-2">
        <ul className="flex flex-col gap-y-0.5 text-xs text-slate-700">
          {models.map((m) => (
            <li key={m.key} className="px-1.5 py-0.5">
              {m.href ? (
                <Link href={m.href} className="hover:text-sky-800 hover:underline">
                  {m.label}
                </Link>
              ) : (
                m.label
              )}
            </li>
          ))}
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
}
