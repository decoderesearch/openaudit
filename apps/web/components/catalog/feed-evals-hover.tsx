'use client';

import { PlaceText } from '@/components/catalog/place-text';
import { ResultValue, SafetyBar, safeShare } from '@/components/catalog/score';
import { EvalLink } from '@/components/eval-link';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { CHAT_GROUP_STYLES, shortCount } from '@/lib/feed';
import type { EvalFlags, FeedEval } from '@/lib/server/snippet-feed';
import { cn } from '@/lib/utils';
import { BookCheck, MessageSquareWarning } from 'lucide-react';
import type { ReactElement } from 'react';

/** The `n` evals where the model does worst for safety first: by its place among the models, else by
 * its result's share. Evals with neither go last, in their order. */
export function worstEvals(evals: FeedEval[], n: number) {
  const good = (e: FeedEval) =>
    e.place
      ? 1 - (e.place.rank - 1) / Math.max(1, e.place.of - 1)
      : ((e.result ? safeShare(e.result) : undefined) ?? Infinity);
  return [...evals].sort((a, b) => good(a) - good(b)).slice(0, n);
}

/** An eval and its headline result, as a link to the run. On hover, the eval's card. Under the
 * result: the model's place among the models, else the result's bar. `barOnly`: no number when there
 * is a place or a bar. `small`: smaller text and icon, and a name that is not bold. `flags`: at the
 * right, the eval's high and medium flagged chats, in a space of fixed width. `noOf`: no "of 22",
 * and a narrower result at the right. `bare`: no icon, and (if not `small`) no bold text. */
export function FeedEvalLine({
  eval: e,
  barOnly,
  small,
  flags,
  noOf,
  bare,
  className,
}: {
  eval: FeedEval;
  barOnly?: boolean;
  small?: boolean;
  flags?: boolean;
  noOf?: boolean;
  bare?: boolean;
  className?: string;
}) {
  const bar = !e.place && e.result && safeShare(e.result) !== undefined;
  const below = !!e.place || bar;
  return (
    <EvalLink
      slug={e.slug}
      href={e.href}
      className={cn('flex items-center gap-x-1 text-xs hover:text-sky-800', small && 'text-[10px]', className)}
    >
      {!bare && <BookCheck aria-hidden className={cn('size-3.5 shrink-0 text-slate-500', small && 'size-3')} />}
      <span className={cn('min-w-0 flex-1 truncate font-medium text-slate-700', (small || bare) && 'font-normal')}>
        {e.label}
      </span>
      {e.result ? (
        <span
          className={cn(
            'flex w-16 shrink-0 flex-col items-start font-mono text-[11px] text-slate-700',
            noOf && 'w-auto items-end',
          )}
        >
          {!(barOnly && below) && <ResultValue result={e.result} round noStderr />}
          {e.place && (
            <PlaceText
              place={e.place}
              className={cn(!barOnly && 'leading-3', small && 'text-[9px]')}
              rankClassName={cn(small ? 'font-semibold' : bare && 'font-normal', noOf && 'w-auto')}
              ofClassName={noOf ? 'hidden' : undefined}
            />
          )}
          {bar && <SafetyBar result={e.result} className={cn('h-1.5 w-12', noOf && 'w-8', !barOnly && 'mt-0.5')} />}
        </span>
      ) : (
        <span className={cn('w-16 shrink-0 text-slate-400', noOf && 'w-8 text-right')}>—</span>
      )}
      {flags && <FlagCount flags={e.flags} />}
    </EvalLink>
  );
}

/** The flagged chat icon and the count of high and medium chats; red with a high chat, else amber.
 * Nothing when there are none, in the same width. */
function FlagCount({ flags }: { flags: EvalFlags }) {
  const n = flags.high + flags.medium;
  return (
    <span
      title={n ? `${n} high or medium flagged chats` : undefined}
      className="flex w-10 shrink-0 items-center gap-x-0.5 text-[10px] text-slate-600 tabular-nums"
    >
      {n > 0 && (
        <>
          <MessageSquareWarning
            aria-label="Flagged chats"
            className={cn('size-3 shrink-0', CHAT_GROUP_STYLES[flags.high ? 'high' : 'medium'].icon)}
          />
          {shortCount(n)}
        </>
      )}
    </span>
  );
}

/** "N Evaluations" in a feed row, or `children`. On hover, a card at its right lists the evals as
 * `worstEvals` orders them, each with its place or bar (`barOnly`), and links to the run. */
export function FeedEvalsHover({
  evals,
  model,
  children,
}: {
  evals: FeedEval[];
  model: string;
  children?: ReactElement;
}) {
  if (!evals.length) return null;
  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>
        {children ?? (
          <span
            tabIndex={0}
            className="relative z-10 shrink-0 cursor-default text-[9px] font-bold tracking-wide text-slate-400 uppercase hover:text-slate-600"
          >
            {evals.length} {evals.length === 1 ? 'Evaluation' : 'Evaluations'}
          </span>
        )}
      </HoverCardTrigger>
      <HoverCardContent side="right" align="center" sideOffset={8} className="w-80 p-0 text-slate-700">
        <div className="border-b border-slate-100 px-3 py-2 text-[10px] font-bold text-slate-400">
          Evaluation runs on <span className="text-slate-600">{model}</span>
        </div>
        <ul className="max-h-[240px] overflow-y-auto overscroll-contain py-1">
          {worstEvals(evals, evals.length).map((e) => (
            <li key={e.href}>
              <FeedEvalLine eval={e} barOnly flags bare className="px-3 py-1 hover:bg-slate-50" />
            </li>
          ))}
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
}
