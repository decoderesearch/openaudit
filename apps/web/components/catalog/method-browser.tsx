'use client';

import { MEDALS } from '@/components/catalog/leaders';
import { BoxTitle } from '@/components/catalog/title-search';
import { EvalLink } from '@/components/eval-link';
import { InfoPopover } from '@/components/info-popover';
import Link from '@/components/link';
import { SubmitDialogButton } from '@/components/nav/report-dialog';
import { SubmitVariant } from '@/components/submit-buttons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { monthYear } from '@/lib/card-heading';
import { newestFirst } from '@/lib/methods';
import type { NavMethod } from '@/lib/server/nav-methods';
import { SUBMIT_BUTTON } from '@/lib/submissions';
import { cn } from '@/lib/utils';
import { ChevronRight, HardHat, Plus } from 'lucide-react';
import { Fragment } from 'react';

type VariantItem = NavMethod['variants'][number];

const PLACES = ['1st', '2nd', '3rd'];

/** The Methods page's list of methods, in a box as the Models page's feed: the title and a "Method"
 * submit button at the top, then each method with its summary and variants. */
export function MethodBrowser({ methods, className }: { methods: NavMethod[]; className?: string }) {
  return (
    <section aria-label="Methods" className={cn('flex min-h-0 flex-col', className)}>
      <div className="isolate flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex h-10 shrink-0 items-center justify-between gap-x-3 bg-slate-50 pr-4 pl-2 sm:pr-5 sm:pl-3">
          <BoxTitle
            title="Methods"
            icon={<HardHat aria-hidden />}
            info={
              <>
                Tools that look inside a model or read its outputs to find unsafe behavior, for example sparse
                autoencoders, probes and LLM monitors. Each method has variants. The medals show the evals where a
                variant placed in the top 3.
                <SubmitVariant className="mt-2 flex" />
              </>
            }
          />
          <SubmitDialogButton type="method" className={SUBMIT_BUTTON}>
            <Plus aria-hidden />
            Method
          </SubmitDialogButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {methods.length ? (
            <ul>
              {methods.map((m) => (
                <MethodSection key={m.href} method={m} />
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-slate-500">No methods yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}

/** One method: a header that opens it. Under it, its summary next to the tree line, then its
 * variants as branches of the tree. A hover on a name shows a card. `onPick`: on a click on a
 * link. `compact`, as in a menu: smaller text, and no summaries. */
export function MethodSection({
  method: m,
  onPick,
  compact = false,
}: {
  method: NavMethod;
  onPick?: () => void;
  compact?: boolean;
}) {
  return (
    <li className={cn('pb-2', compact && 'pb-1.5')}>
      <div className="group/head relative transition-colors hover:bg-sky-50">
        <div
          className={cn(
            'flex h-8 items-center gap-x-1.5 pt-1 pr-4 pl-5 sm:pr-5 sm:pl-6',
            compact && 'h-7 pt-0 sm:pr-4 sm:pl-5',
          )}
        >
          <Link
            href={m.href}
            onClick={onPick}
            className={cn(
              'min-w-0 truncate text-sm font-semibold text-slate-800 group-hover/head:text-sky-800 group-hover/head:underline after:absolute after:inset-0',
              compact && 'text-[13px]',
            )}
          >
            {m.label}
          </Link>
        </div>
        {!compact && (
          <p
            className={cn(
              'pointer-events-none relative pr-4 pl-10 text-[11px] leading-snug text-slate-500 sm:pr-5 sm:pl-11',
              m.variants.length > 0 &&
                "before:absolute before:inset-y-0 before:left-[26px] before:w-px before:bg-slate-300 before:content-[''] sm:before:left-[30px]",
            )}
          >
            {m.summary}
          </p>
        )}
      </div>
      {m.variants.length > 0 && (
        <ul
          aria-label={`${m.label} variants`}
          className={cn(
            'relative flex flex-col',
            !compact &&
              "pt-1.5 before:absolute before:top-0 before:left-[26px] before:h-1.5 before:w-px before:bg-slate-300 before:content-[''] sm:before:left-[30px]",
          )}
        >
          {m.variants.map((v) =>
            compact ? (
              <CompactVariant key={v.href} variant={v} onPick={onPick} />
            ) : (
              <Variant key={v.href} variant={v} onPick={onPick} />
            ),
          )}
        </ul>
      )}
    </li>
  );
}

/** The tree lines of a variant row: down from the method, and a branch to the name, `--branch` from
 * the top of the row. The line of the last variant stops at its branch. */
export function Branch({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 w-2.5 border-l border-slate-300 group-last/variant:bottom-auto group-last/variant:h-(--branch) after:absolute after:inset-x-0 after:top-(--branch) after:h-px after:bg-slate-300 after:content-['']",
        className,
      )}
    />
  );
}

/** A line for each medal that a variant has, with its evals joined by commas. */
function Medals({ variant: v, onPick }: { variant: VariantItem; onPick?: () => void }) {
  const places = [1, 2, 3]
    .map((place) => ({ place, evals: v.medals.filter((e) => e.place === place) }))
    .filter((p) => p.evals.length > 0);
  return places.map((p, i) => (
    <p key={p.place} className={cn('mt-0.5 flex gap-x-1 pl-2 text-[11px] text-slate-600', i === 0 && 'mt-1.5')}>
      <span aria-label={`Rank ${p.place}`} className="shrink-0">
        {MEDALS[p.place - 1]}
      </span>
      <span className="min-w-0">
        {p.evals.map((e, i) => (
          <Fragment key={e.slug}>
            {i > 0 && ', '}
            <EvalLink
              slug={e.slug}
              onClick={onPick}
              className="relative z-10 font-medium hover:text-sky-800 hover:underline"
            >
              {e.label}
            </EvalLink>
          </Fragment>
        ))}
      </span>
    </p>
  ));
}

/** One variant in a menu, a row that opens it: its name with a medal for each of its top 3 places,
 * then its author under the name. A medal shows its eval on hover. In a narrow row, the medals
 * overlap more, and the name stays whole. */
function CompactVariant({ variant: v, onPick }: { variant: VariantItem; onPick?: () => void }) {
  return (
    <li className="group/variant relative flex items-start py-0.75 pr-4 pl-10 transition-colors hover:bg-sky-50">
      <Branch className="left-[26px] [--branch:12px]" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-x-1.5">
          <Link
            href={v.href}
            onClick={onPick}
            className="max-w-full shrink-0 truncate text-[13px] leading-[18px] font-semibold text-slate-600 group-hover/variant:text-sky-800 group-hover/variant:underline after:absolute after:inset-0"
          >
            {v.label}
          </Link>
          {v.medals.length > 0 && (
            <TooltipProvider>
              <span className="flex min-w-0 -space-x-1 text-xs leading-none">
                {v.medals.map((m) => (
                  <Tooltip key={m.slug}>
                    <TooltipTrigger asChild>
                      <Link
                        href={v.href}
                        hover={false}
                        onClick={onPick}
                        aria-label={`Rank ${m.place} in ${m.label}`}
                        className="relative z-10 min-w-0"
                      >
                        {MEDALS[m.place - 1]}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={4} className="px-2 py-1 text-[11px]">
                      {PLACES[m.place - 1]} in {m.label}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </span>
            </TooltipProvider>
          )}
        </span>
        {v.author && <span className="truncate text-[11px] text-slate-400">{v.author}</span>}
      </div>
    </li>
  );
}

/** A method's variants in a titled box, the newest first, with no tree lines. */
export function VariantBox({ method: m, className }: { method: NavMethod; className?: string }) {
  return (
    <section
      aria-label="Method Variants"
      className={cn('flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white', className)}
    >
      <div className="flex h-10 shrink-0 items-center gap-x-1 bg-slate-50 pr-4 pl-2 sm:pr-5 sm:pl-3">
        <BoxTitle title="Method Variants" icon={<HardHat aria-hidden />} />
        <InfoPopover label="Method Variants" iconClassName="size-3.5" contentClassName="text-xs">
          The designs of this method. Each variant changes one part of how the method works, for example how it trains
          or which activations it reads. A medal shows that the variant is in the top 3 of an eval.
        </InfoPopover>
        <SubmitVariant className="ml-auto" />
      </div>
      <ul aria-label={`${m.label} variants`} className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1.5">
        {newestFirst(m.variants).map((v) => (
          <Variant key={v.href} variant={v} tree={false} />
        ))}
      </ul>
    </section>
  );
}

/** One variant, a row that opens it: its name with its author and date at the right, its summary,
 * and its medals.
 * `tree`: the tree lines from its method, and no summary (the method's summary is above). */
function Variant({ variant: v, onPick, tree = true }: { variant: VariantItem; onPick?: () => void; tree?: boolean }) {
  const date = monthYear(v.date);
  return (
    <li
      className={cn(
        'group/variant relative pr-4 transition-colors hover:bg-sky-50 sm:pr-5',
        tree ? 'py-2 pl-10 sm:pl-11' : 'py-3 pl-5 sm:pl-6',
      )}
    >
      {tree && <Branch className="left-[26px] [--branch:17px] sm:left-[30px]" />}
      {!tree && (
        <ChevronRight
          className="absolute top-3.5 left-5 size-3.5 text-slate-400 group-hover/variant:text-sky-800 sm:left-6"
          aria-hidden
        />
      )}
      <div className={cn('flex min-w-0 flex-col', !tree && 'pl-4')}>
        <span className="flex min-w-0 items-baseline gap-x-1.5">
          <Link
            href={v.href}
            onClick={onPick}
            className="max-w-full shrink-0 truncate text-sm leading-[18px] font-semibold text-slate-600 group-hover/variant:text-sky-800 group-hover/variant:underline after:absolute after:inset-0"
          >
            {v.label}
          </Link>
          {(v.author || date) && (
            <span className="ml-auto flex min-w-0 items-baseline gap-x-1 text-[11px] text-slate-400">
              {v.author && <span className="truncate">{v.author}</span>}
              {v.author && date && <span className="shrink-0">·</span>}
              {date && <span className="shrink-0">{date}</span>}
            </span>
          )}
        </span>
        {!tree && v.summary && <span className="mt-0.5 text-[11px] leading-snug text-slate-500">{v.summary}</span>}
        <Medals variant={v} onPick={onPick} />
      </div>
    </li>
  );
}
