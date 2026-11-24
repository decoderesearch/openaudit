'use client';

import Link from '@/components/link';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { monthYear } from '@/lib/card-heading';
import type { EvalHover } from '@/lib/server/eval-hovers';
import { cn } from '@/lib/utils';
import { Fragment, useState, type ComponentProps } from 'react';

let hovers: Promise<Record<string, EvalHover>> | null = null;

/** All the hover cards, from one request per page load. */
function loadHovers() {
  hovers ??= fetch('/api/eval-hovers')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`eval-hovers: ${r.status}`))))
    .catch((e) => {
      hovers = null;
      throw e;
    });
  return hovers;
}

/** A link to an eval. On hover, a card shows its summary and topics. `href`: default its page.
 * `side` and `sideOffset`: where the card opens. */
export function EvalLink({
  slug,
  href = `/evaluations/${slug}`,
  side = 'right',
  sideOffset = 8,
  ...props
}: { slug: string; side?: 'left' | 'right'; sideOffset?: number } & Omit<ComponentProps<typeof Link>, 'href'> & {
    href?: string;
  }) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<EvalHover | null>(null);
  const load = () => {
    if (!info)
      loadHovers().then(
        (all) => setInfo(all[slug] ?? null),
        () => {},
      );
  };
  return (
    <HoverCard open={open && !!info} onOpenChange={setOpen}>
      <HoverCardTrigger asChild onPointerEnter={load} onFocus={load}>
        <Link href={href} {...props} />
      </HoverCardTrigger>
      {info && (
        <HoverCardContent side={side} align="center" sideOffset={sideOffset} className="w-72 text-slate-700">
          <EvalHead about={info} />
          {(info.summary || info.topics.length > 0) && (
            <div className="mt-2">
              <EvalAbout about={info} />
            </div>
          )}
        </HoverCardContent>
      )}
    </HoverCard>
  );
}

/** A link with the hover card of `EvalLink`, from data that the page has (a suite's). Only this
 * card shows, not that of `Link`. */
export function AboutLink({
  info,
  side = 'right',
  sideOffset = 8,
  ...props
}: { info: EvalHover; side?: 'left' | 'right'; sideOffset?: number } & ComponentProps<typeof Link>) {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Link {...props} hover={false} />
      </HoverCardTrigger>
      <HoverCardContent side={side} align="center" sideOffset={sideOffset} className="w-72 text-slate-700">
        <EvalHead about={info} />
        {(info.summary || info.topics.length > 0) && (
          <div className="mt-2">
            <EvalAbout about={info} />
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

/** The eval's name, and under it its creator and date, as in a model's hover card. */
function EvalHead({ about }: { about: EvalHover }) {
  const date = monthYear(about.date);
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-[13px] leading-4 font-semibold text-slate-800">{about.name}</span>
      {(about.creator || date) && (
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[11px] leading-4 text-slate-500">
          {about.creator}
          {about.creator && date && (
            <span aria-hidden className="text-slate-300">
              ·
            </span>
          )}
          {date}
        </span>
      )}
    </div>
  );
}

/** An eval's summary, then its topics joined by dots. Also in the breadcrumb tooltips, so it
 * takes its color from the box. */
export function EvalAbout({ about }: { about: EvalHover }) {
  return (
    <>
      {about.summary && <p>{about.summary}</p>}
      {about.topics.length > 0 && (
        <p className={cn('flex flex-wrap items-center gap-x-1.5 text-[10px] opacity-55', about.summary && 'mt-1.5')}>
          {about.topics.map((t, i) => (
            <Fragment key={t}>
              {i > 0 && <span className="opacity-50">·</span>}
              {t}
            </Fragment>
          ))}
        </p>
      )}
    </>
  );
}
