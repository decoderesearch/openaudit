'use client';

import { EvalCountsRow } from '@/components/catalog/model-list';
import { SafetyBar, safeShare } from '@/components/catalog/score';
import { EvalAbout } from '@/components/eval-link';
import Link from '@/components/link';
import type { CrumbGroup } from '@/components/nav/breadcrumbs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { EvalHover } from '@/lib/server/eval-hovers';
import { cn } from '@/lib/utils';
import { ArrowRight, ChevronDown, ExternalLink } from 'lucide-react';
import { useState } from 'react';

/** Centers the current page in the menu's scroll area when the menu opens. */
function centerInMenu(el: HTMLElement | null) {
  const box = el?.closest<HTMLElement>('[data-slot="dropdown-menu-content"]');
  if (!el || !box) return;
  const [a, b] = [el.getBoundingClientRect(), box.getBoundingClientRect()];
  box.scrollTop += a.top - b.top - (b.height - a.height) / 2;
}

/**
 * A breadcrumb that opens a list of pages; the crumb's own page shows as selected. When that page is
 * not the current one, an "Open" link to it stays at the top. Links with `evals` are
 * models, as in the home page's models list. Links with `run` are evals, with their result bar.
 * Links with `about`, and the crumb itself with `about`, show the eval's summary and topics on hover.
 * Links and the crumb with `info` show that text on hover.
 */
export function CrumbMenu({
  label,
  href,
  selected: marked,
  heading,
  groups,
  current,
  about,
  info,
}: {
  label: string;
  href?: string;
  selected?: string;
  heading?: string;
  groups: CrumbGroup[];
  current: boolean;
  about?: EvalHover;
  info?: string;
}) {
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState(false);
  const models = groups.some((g) => g.links.some((l) => l.evals));
  const runs = groups.some((g) => g.links.some((l) => l.run || l.score));
  const goTo = href && !current;
  const trigger = (
    <DropdownMenuTrigger
      aria-current={current ? 'page' : undefined}
      className={cn(
        'inline-flex max-w-full cursor-pointer items-center gap-x-1.5 rounded-full bg-slate-300/60 py-1 pr-2.5 pl-3.5 text-left text-slate-700 transition-colors outline-none',
        'hover:bg-slate-300 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-sky-300 data-[state=open]:bg-slate-300 data-[state=open]:text-slate-900',
        current && 'text-slate-900',
      )}
    >
      <span className="min-w-0 truncate leading-4">{label}</span>
      <ChevronDown className="size-3 shrink-0" />
    </DropdownMenuTrigger>
  );
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      {about || info ? (
        <TooltipProvider delayDuration={300}>
          <Tooltip open={tip && !open} onOpenChange={setTip}>
            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} className="max-w-72">
              {about ? <EvalAbout about={about} /> : info}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        trigger
      )}
      <DropdownMenuContent
        align="start"
        className={cn(
          'max-h-96 w-80 max-w-[calc(100vw-2rem)]',
          models && 'max-h-[28rem] w-[20rem]',
          runs && 'max-h-[28rem] w-96',
        )}
      >
        <TooltipProvider delayDuration={300}>
          {(heading || goTo) && (
            <div
              ref={(el) => el?.parentElement?.style.setProperty('--crumb-head', `${el.offsetHeight}px`)}
              className="sticky -top-1 z-10 -mx-1 -mt-1 bg-popover px-1 pt-1"
            >
              {heading && (
                <DropdownMenuLabel className="truncate text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                  {heading}
                </DropdownMenuLabel>
              )}
              {goTo && (
                <DropdownMenuItem asChild className="cursor-pointer text-xs font-medium text-sky-800">
                  <Link href={href}>
                    <span className="truncate">Open {label}</span>
                    <ArrowRight className="size-3.5 text-sky-800" />
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
            </div>
          )}
          {groups
            .filter((g) => g.links.length)
            .map((g, n) => (
              <DropdownMenuGroup key={g.title ?? n}>
                {n > 0 && <DropdownMenuSeparator />}
                {g.title && (
                  <DropdownMenuLabel
                    className={cn(
                      'text-[10px] font-semibold tracking-wide text-slate-500 uppercase',
                      g.sticky && 'sticky top-[calc(var(--crumb-head,0px)-0.25rem)] z-[5] -mx-1 bg-slate-100 px-3',
                    )}
                  >
                    {g.title}
                  </DropdownMenuLabel>
                )}
                {g.links.map((l) => {
                  const selected = l.href === (marked ?? href);
                  if (l.run) {
                    const item = (
                      <DropdownMenuItem
                        key={l.href}
                        asChild
                        className={cn('group cursor-pointer gap-x-3 py-1.5', selected && 'bg-sky-50')}
                      >
                        <Link href={l.href} ref={selected ? centerInMenu : undefined}>
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                'block truncate text-xs text-slate-800',
                                selected && 'font-medium text-sky-800',
                              )}
                            >
                              {l.label}
                            </span>
                            {l.run.topics.length > 0 && (
                              <span className="block truncate text-[10px] text-slate-400">
                                {l.run.topics.join(' · ')}
                              </span>
                            )}
                          </span>
                          {l.run.result ? (
                            <SafetyBar result={l.run.result} className="h-1.5 w-16 shrink-0" />
                          ) : (
                            <span className="w-16 shrink-0" />
                          )}
                        </Link>
                      </DropdownMenuItem>
                    );
                    return l.run.summary ? (
                      <Tooltip key={l.href}>
                        <TooltipTrigger asChild>{item}</TooltipTrigger>
                        <TooltipContent side="right" sideOffset={8} className="max-w-64">
                          {l.run.summary}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      item
                    );
                  }
                  if (l.evals)
                    return (
                      <DropdownMenuItem
                        key={l.href}
                        asChild
                        className={cn(
                          "group cursor-pointer gap-x-3 rounded-none py-2.5 pr-1 pl-3 focus:bg-sky-50 [&_svg:not([class*='text-'])]:text-current [a+&]:before:absolute [a+&]:before:top-0 [a+&]:before:right-0 [a+&]:before:left-3 [a+&]:before:h-px [a+&]:before:bg-slate-100",
                          selected && 'bg-sky-50',
                        )}
                      >
                        <Link href={l.href} hover={false} ref={selected ? centerInMenu : undefined}>
                          <span
                            className={cn(
                              'min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-800 group-data-[highlighted]:text-sky-700 group-data-[highlighted]:underline',
                              selected && 'text-sky-800',
                            )}
                          >
                            {l.label}
                          </span>
                          <EvalCountsRow evals={l.evals} model={l.label} />
                        </Link>
                      </DropdownMenuItem>
                    );
                  const item = (
                    <DropdownMenuItem
                      key={l.href}
                      asChild
                      className={cn(
                        'group cursor-pointer text-xs',
                        l.indent ? 'pl-6' : g.links.some((x) => x.indent) && 'font-medium text-slate-800',
                        selected && 'bg-sky-50 font-medium text-sky-800',
                      )}
                    >
                      {l.external ? (
                        <a href={l.href} target="_blank" rel="noreferrer nofollow">
                          {l.label}
                          <ExternalLink className="ml-auto size-3" />
                        </a>
                      ) : (
                        <Link href={l.href} hover={false} ref={selected ? centerInMenu : undefined}>
                          <span className="min-w-0 flex-1 truncate">{l.label}</span>
                          {l.score && (
                            <span className="flex w-12 shrink-0 flex-col items-center font-mono text-[11px] text-slate-700">
                              {l.score.text}
                              {l.score.bar && safeShare(l.score.bar) !== undefined && (
                                <SafetyBar result={l.score.bar} className="mt-0.5 h-1.5 w-10" />
                              )}
                            </span>
                          )}
                          {g.hint && (
                            <span className="invisible ml-auto shrink-0 pl-3 text-[11px] font-normal text-slate-400 group-data-[highlighted]:visible">
                              {g.hint}
                            </span>
                          )}
                        </Link>
                      )}
                    </DropdownMenuItem>
                  );
                  return l.about || l.info ? (
                    <Tooltip key={l.href}>
                      <TooltipTrigger asChild>{item}</TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8} className="max-w-64">
                        {l.about ? <EvalAbout about={l.about} /> : l.info}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    item
                  );
                })}
              </DropdownMenuGroup>
            ))}
        </TooltipProvider>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
