'use client';

import { useCardsHere } from '@/components/cards-here';
import { Meter } from '@/components/deploymeter/meter';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { monthYear } from '@/lib/card-heading';
import { modelPathOf } from '@/lib/model-links';
import type { ModelHover } from '@/lib/server/model-hovers';
import { cn } from '@/lib/utils';
import { BookCheck, MessageSquareWarning } from 'lucide-react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ComponentProps, type ReactNode } from 'react';

let hovers: Promise<Record<string, ModelHover>> | null = null;

/** All the hover cards, from one request per page load. */
function loadHovers() {
  hovers ??= fetch('/api/model-hovers')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`model-hovers: ${r.status}`))))
    .catch((e) => {
      hovers = null;
      throw e;
    });
  return hovers;
}

/** A link to a model page. On hover, a card shows the model's summary (`ModelAbout`). A link
 * with a row cover (`after:inset-0`) opens it only from its text, which sits above the cover, so
 * the rest of the row does not. No card on the model's own page, except in a navbar menu. `path`: as `modelPathOf` the
 * link. `Link` uses it for model links. */
export function ModelLink({
  path,
  children,
  onFocus,
  onBlur,
  ...props
}: { path: string } & ComponentProps<typeof NextLink>) {
  const pathname = usePathname();
  const here = !useCardsHere() && modelPathOf(pathname ?? '') === path;
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<ModelHover | null>(null);
  const load = () => {
    if (!info)
      loadHovers().then(
        (all) => setInfo(all[path] ?? null),
        () => {},
      );
  };
  if (here)
    return (
      <NextLink {...props} onFocus={onFocus} onBlur={onBlur}>
        {children}
      </NextLink>
    );
  const card = info && (
    <HoverCardContent side="right" align="center" sideOffset={8} className="w-72 text-slate-700">
      <ModelAbout about={info} href={String(props.href).replace(/[?#].*/, '')} />
    </HoverCardContent>
  );
  if (!/\bafter:inset-0\b/.test(props.className ?? ''))
    return (
      <HoverCard open={open && !!info} onOpenChange={setOpen}>
        <HoverCardTrigger asChild onPointerEnter={load} onFocus={load}>
          <NextLink {...props} onFocus={onFocus} onBlur={onBlur}>
            {children}
          </NextLink>
        </HoverCardTrigger>
        {card}
      </HoverCard>
    );
  return (
    <HoverCard open={open && !!info} onOpenChange={setOpen}>
      <NextLink
        {...props}
        onFocus={(e) => {
          onFocus?.(e);
          load();
          setOpen(true);
        }}
        onBlur={(e) => {
          onBlur?.(e);
          setOpen(false);
        }}
      >
        <HoverCardTrigger asChild onPointerEnter={load}>
          <span className="relative z-1">{children}</span>
        </HoverCardTrigger>
      </NextLink>
      {card}
    </HoverCard>
  );
}

/** A model's name, then its developer and release month, with a link to its page at the top
 * right; below, its Deploymeter (also a link to the page), then its flagged chats and evals. */
export function ModelAbout({ about, href }: { about: ModelHover; href: string }) {
  const released = monthYear(about.released);
  return (
    <div className="flex flex-col gap-y-3">
      <div className="flex items-start justify-between gap-x-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-[13px] leading-4 font-semibold text-slate-800">{about.name}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[11px] leading-4 text-slate-500">
            {about.developer}
            {released && (
              <>
                <span aria-hidden className="text-slate-300">
                  ·
                </span>
                {released}
              </>
            )}
          </span>
        </div>
        <NextLink
          href={href}
          prefetch={false}
          className="shrink-0 text-[11px] leading-4 font-medium text-sky-700 hover:underline"
        >
          Open Model →
        </NextLink>
      </div>
      <div className="flex items-center gap-x-3">
        <Meter score={about.meter} votes={about.votes} href={href} labeled />
        <div className="flex flex-col gap-y-0.5 text-[11px] leading-4 font-semibold">
          <Count n={about.flagged ?? 0} one="Flagged Chat" many="Flagged Chats" className="text-amber-700">
            <MessageSquareWarning aria-hidden className="size-3.5 shrink-0" />
          </Count>
          <Count n={about.evals ?? 0} one="Evaluation" many="Evaluations" className="text-slate-600">
            <BookCheck aria-hidden className="size-3.5 shrink-0" />
          </Count>
        </div>
      </div>
    </div>
  );
}

/** A count in words. Grey when none. */
function Count({
  n,
  one,
  many,
  className,
  children,
}: {
  n: number;
  one: string;
  many: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <span className={cn('flex items-center gap-x-1', n ? className : 'text-slate-400')}>
      {children}
      <span className="tabular-nums">{n || 'No'}</span> {n === 1 ? one : many}
    </span>
  );
}
