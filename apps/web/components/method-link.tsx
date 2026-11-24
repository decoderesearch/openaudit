'use client';

import { useCardsHere } from '@/components/cards-here';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { monthYear } from '@/lib/card-heading';
import type { MethodHover } from '@/lib/server/method-hovers';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, useState, type ComponentProps } from 'react';

let hovers: Promise<Record<string, MethodHover>> | null = null;

/** All the hover cards, from one request per page load. */
function loadHovers() {
  hovers ??= fetch('/api/method-hovers')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`method-hovers: ${r.status}`))))
    .catch((e) => {
      hovers = null;
      throw e;
    });
  return hovers;
}

/** A link to a method or variant page. On hover, a card at the right shows its summary. As
 * `ModelLink`: a link with a row cover (`after:inset-0`) opens it only from its text, and there is
 * no card on the page that it links to, except in a navbar menu. `path`: as `methodPathOf` the link. `Link` uses it. */
export function MethodLink({
  path,
  children,
  onFocus,
  onBlur,
  ...props
}: { path: string } & ComponentProps<typeof NextLink>) {
  const pathname = usePathname();
  const here = !useCardsHere() && pathname === path;
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<MethodHover | null>(null);
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
      <MethodAbout about={info} href={path} />
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

/** The group (a method) or the method (a variant), the name, then the number of variants or the
 * author and month, with a link to the page at the top right; below, the summary. */
function MethodAbout({ about, href }: { about: MethodHover; href: string }) {
  const meta = [
    about.variants ? `${about.variants} ${about.variants === 1 ? 'variant' : 'variants'}` : null,
    about.author,
    monthYear(about.date),
  ].filter(Boolean);
  return (
    <div className="flex flex-col gap-y-2">
      <div className="flex items-start justify-between gap-x-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-[10px] leading-4 font-semibold tracking-wide text-slate-400 uppercase">
            {about.kind}
          </span>
          <span className="text-[13px] leading-4 font-semibold text-slate-800">{about.name}</span>
          {meta.length > 0 && (
            <span className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[11px] leading-4 text-slate-500">
              {meta.map((t, i) => (
                <Fragment key={i}>
                  {i > 0 && (
                    <span aria-hidden className="text-slate-300">
                      ·
                    </span>
                  )}
                  {t}
                </Fragment>
              ))}
            </span>
          )}
        </div>
        <NextLink
          href={href}
          prefetch={false}
          className="shrink-0 text-[11px] leading-4 font-medium text-sky-700 hover:underline"
        >
          {about.variants === null ? 'Open Variant →' : 'Open Method →'}
        </NextLink>
      </div>
      {about.summary && <p className="text-xs leading-[18px] text-slate-600">{about.summary}</p>}
    </div>
  );
}
