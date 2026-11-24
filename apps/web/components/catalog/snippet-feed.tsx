'use client';

import { FeedEvalLine, FeedEvalsHover, worstEvals } from '@/components/catalog/feed-evals-hover';
import { FeedTopicsHover } from '@/components/catalog/feed-topics-hover';
import { categoryLabel } from '@/components/catalog/parts';
import { Meter } from '@/components/deploymeter/meter';
import { type SnippetRef } from '@/components/evidence-hover';
import Link from '@/components/link';
import { RunLink } from '@/components/pdf-viewer';
import { openChatsFirst, shortCount } from '@/lib/feed';
import { formatShortDate } from '@/lib/org-research';
import { sampleLabel } from '@/lib/sample-label';
import type { SnippetFeedEntry } from '@/lib/server/snippet-feed';
import { cn } from '@/lib/utils';
import { BookCheck, Lock, MessageSquareWarning } from 'lucide-react';

const FEED_EVALS = 3;

/** A section head in a feed box, as "741 FLAGGED CHATS". */
export const HEADER = 'relative z-10 self-start text-[9px] leading-5 font-bold tracking-wide uppercase hover:underline';

/** One model's newest published OpenAudit card. Narrow: its org, the model, the date and the number
 * of evals (with a hover list), then under it its Deploymeter score and one column of its first
 * `FEED_SNIPPETS` flagged chats with no eval names, the most severe open chats first. When the row
 * is 40rem wide or more, three columns, the first one wider: the org, the model, the date, and the Deploymeter with
 * its panel summary; the number of flagged chats and the chats; the number of evals and the
 * `FEED_EVALS` evals with the worst results for safety, with their bars. The two numbers are level
 * with the model, link to the model page, and on hover show a table of the topics or of
 * the evals. The model's link covers its feed row (`data-row-link`), and is sky and
 * underlined when the row is hovered. `inOrg`: in a list for one organization, so no org name or date.
 * `noOrg`: no org name, with the date. `tight`: in three columns, less space between them, more
 * width for the first, and a larger, darker summary of 3 lines. */
export function SnippetFeedRow({
  entry: e,
  inOrg,
  noOrg,
  tight,
}: {
  entry: SnippetFeedEntry;
  inOrg?: boolean;
  noOrg?: boolean;
  tight?: boolean;
}) {
  // In `tight` rows, the numbers' text is level at its bottom with the date by the model.
  const columnTop = !tight
    ? inOrg
      ? '@min-[40rem]:pt-0.5'
      : '@min-[40rem]:pt-3.5'
    : inOrg || noOrg
      ? '@min-[40rem]:pt-1.25'
      : '@min-[40rem]:pt-4.25';
  return (
    <div className="@container">
      <div
        className={cn(
          'grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-2 @min-[40rem]:grid-cols-[minmax(0,9fr)_minmax(0,6fr)_minmax(0,6fr)]',
          tight && '@min-[40rem]:grid-cols-[minmax(0,12fr)_minmax(0,5fr)_minmax(0,5fr)] @min-[40rem]:gap-x-3',
        )}
      >
        <span className="col-span-2 flex min-w-0 flex-col items-start @min-[40rem]:col-span-1">
          {!inOrg && !noOrg && (
            <Link
              href={e.org.href}
              className="relative z-10 max-w-full truncate text-[9px] leading-3 font-semibold tracking-wide text-slate-400 uppercase hover:text-sky-700"
            >
              {e.org.label}
            </Link>
          )}
          <span className="flex max-w-full min-w-0 items-baseline gap-x-1.5">
            <Link
              href={e.href}
              data-row-link
              className="truncate text-sm font-semibold text-slate-800 group-hover/row:text-sky-800 group-hover/row:underline after:absolute after:inset-0"
            >
              {e.label}
            </Link>
            {!inOrg && (
              <>
                <span className="shrink-0 text-[9px] text-slate-300">·</span>
                <span className="shrink-0 text-[9px] font-bold tracking-wide text-slate-400 uppercase">
                  {formatShortDate(e.date)}
                </span>
              </>
            )}
            {e.evals.length > 0 && (
              <span className="flex shrink-0 items-baseline gap-x-1.5 @min-[40rem]:hidden">
                <span className="text-[9px] text-slate-300">·</span>
                <FeedEvalsHover evals={e.evals} model={e.label} />
              </span>
            )}
          </span>
        </span>
        <span
          className={cn(
            'flex min-w-0 items-start gap-x-4 self-start px-4 @min-[40rem]:pr-2',
            tight && '@min-[40rem]:pr-0',
          )}
        >
          <span className="shrink-0">
            <Meter score={e.meter} judges={e.judges} href={e.href} model={e.label} large />
          </span>
          {e.summary && (
            <p
              title={e.summary}
              className={cn(
                'hidden text-[10px] leading-snug text-slate-500 @min-[40rem]:line-clamp-5',
                tight && 'text-xs/snug text-slate-600 @min-[40rem]:line-clamp-3',
              )}
            >
              {e.summary}
            </p>
          )}
        </span>
        <div
          className={cn(
            'flex min-w-0 flex-col gap-y-0.5 @min-[40rem]:col-start-2 @min-[40rem]:row-span-2 @min-[40rem]:row-start-1',
            columnTop,
          )}
        >
          <FlaggedChats entry={e} large />
        </div>
        {e.evals.length > 0 && (
          <div
            className={cn(
              'hidden min-w-0 flex-col gap-y-0.5 @min-[40rem]:col-start-3 @min-[40rem]:row-span-2 @min-[40rem]:row-start-1 @min-[40rem]:flex',
              columnTop,
            )}
          >
            <WorstEvals entry={e} large />
          </div>
        )}
      </div>
    </div>
  );
}

/** A section head in a home feed box: an icon (`size-3`), then "741 FLAGGED CHATS". */
export const CARD_HEAD = cn(HEADER, 'flex items-center gap-x-1 text-[10px] text-slate-500 hover:text-slate-700');
/** A `CARD_HEAD` of a model's box, lighter and smaller. */
export const MODEL_CARD_HEAD = cn(CARD_HEAD, 'text-[9px] text-slate-400 hover:text-slate-600');
/** The list under a `CARD_HEAD`: in line with its text, not with its icon. */
export const CARD_LIST = 'pl-4';

/** In a home feed box: the name of what it is about, the name of who made it (at its right), and a
 * short text about it. Links are `relative`, above the box's link. */
export const CARD_NAME =
  'relative truncate text-[15px] leading-6 font-semibold text-slate-800 hover:text-sky-800 hover:underline';
const CARD_BY = 'relative truncate text-[8px] font-semibold tracking-wide text-slate-400 uppercase';
export const CARD_ABOUT = 'line-clamp-3 text-[11px] leading-snug text-slate-700';

/** One model's newest published OpenAudit card: the model and its org (with `dated`, "Audited DATE"
 * in place of the org), then its Deploymeter (with the judges' votes on hover) centered by the panel summary.
 * Under the summary, two columns of one width: the flagged chats and the evals. `brief`: their
 * counts only, with no lists. Links are `relative`, above the box's link. */
export function SnippetFeedCard({
  entry: e,
  dated,
  brief,
}: {
  entry: SnippetFeedEntry;
  dated?: boolean;
  brief?: boolean;
}) {
  return (
    <div className="flex flex-col gap-y-1.5">
      <span className="flex min-w-0 items-baseline gap-x-2">
        <Link href={e.href} hover={false} className={CARD_NAME}>
          {e.label}
        </Link>
        {dated ? (
          <span className={cn(CARD_BY, 'shrink-0')}>Audited {formatShortDate(e.date)}</span>
        ) : (
          <Link href={e.org.href} hover={false} className={cn(CARD_BY, 'shrink-0 hover:text-sky-700')}>
            {e.org.label}
          </Link>
        )}
      </span>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
        <span className="self-center">
          <Meter score={e.meter} judges={e.judges} href={e.href} model={e.label} large />
        </span>
        {e.summary && (
          <p title={e.summary} className={CARD_ABOUT}>
            {e.summary}
          </p>
        )}
        <div className="col-start-2 grid grid-cols-2 gap-x-3">
          <div className="flex min-w-0 flex-col gap-y-0.5">
            <FlaggedChats entry={e} brief={brief} />
          </div>
          {e.evals.length > 0 && (
            <div className="flex min-w-0 flex-col gap-y-0.5">
              <WorstEvals entry={e} brief={brief} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** A `MODEL_CARD_HEAD`: the number of flagged chats (`shortCount`), as a link to the model page with a hover
 * table of the topics. Under it, a `CARD_LIST` of the chats. `large`: titles of 11px, not 10px.
 * `brief`: no list. */
function FlaggedChats({ entry: e, large, brief }: { entry: SnippetFeedEntry; large?: boolean; brief?: boolean }) {
  const flagged = e.counts.high + e.counts.medium + e.counts.low;
  return (
    <>
      {flagged > 0 && (
        <FeedTopicsHover topics={e.topics} model={e.label}>
          <Link href={e.href} hover={false} className={MODEL_CARD_HEAD}>
            <MessageSquareWarning aria-hidden className="size-2.5" strokeWidth={2.5} />
            {shortCount(flagged)} {flagged === 1 ? 'Flagged Chat' : 'Flagged Chats'}
          </Link>
        </FeedTopicsHover>
      )}
      {!brief && (
        <ul
          aria-label="Flagged chats"
          className={cn(
            'flex min-w-0 flex-col gap-y-0.5 text-slate-600',
            CARD_LIST,
            large ? 'text-[11px]' : 'text-[10px]',
          )}
        >
          {openChatsFirst(e.snippets).map((s) => (
            <SnippetTitle key={s.id} snippet={s} />
          ))}
        </ul>
      )}
    </>
  );
}

/** A `MODEL_CARD_HEAD`: the number of evals, as a link to the model page with a hover table of the
 * evals. Under it, a `CARD_LIST` of the `FEED_EVALS` evals with the worst results for safety, with
 * no "of 22" after a place. `large`: names of 11px, not 10px. `brief`: no list. */
function WorstEvals({ entry: e, large, brief }: { entry: SnippetFeedEntry; large?: boolean; brief?: boolean }) {
  const n = e.evals.length;
  return (
    <>
      <FeedEvalsHover evals={e.evals} model={e.label}>
        <Link href={e.href} hover={false} className={MODEL_CARD_HEAD}>
          <BookCheck aria-hidden className="size-2.5" strokeWidth={2.5} />
          {n} {n === 1 ? 'Evaluation' : 'Evaluations'}
        </Link>
      </FeedEvalsHover>
      {!brief && (
        <ul aria-label="Evaluations" className={cn('flex flex-col gap-y-0.5', CARD_LIST)}>
          {worstEvals(e.evals, FEED_EVALS).map((x) => (
            <li key={x.href}>
              <FeedEvalLine eval={x} barOnly small bare noOf className={cn('relative z-10', large && 'text-[11px]')} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** A flagged chat's title, not bold. A lock before the title: the reader cannot open the reply. A
 * click opens the chat in the viewer at the bottom. On hover, a frame and a hint tab under it tell
 * this; the frame stays while the chat is open. The frame is opaque, so it covers the frame of the
 * chat next to it. */
export function SnippetTitle({ snippet: s }: { snippet: SnippetRef }) {
  return (
    <li className="group/chat relative isolate flex min-w-0 flex-col hover:z-[55]">
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-x-1.5 -inset-y-1 -z-10 rounded-md border border-sky-700 bg-white opacity-0 shadow-md shadow-sky-800/40 transition-opacity duration-200 group-hover/chat:opacity-100 group-has-[[data-cite-active]]/chat:opacity-100"
      />
      <span className="flex min-w-0 items-baseline gap-x-1">
        {s.locked && <Lock aria-label="Restricted" className="size-2.5 shrink-0 self-center text-slate-400" />}
        <span className="truncate text-slate-700">{s.title ?? categoryLabel(s.category)}</span>
      </span>
      <RunLink href={s.href} snippet={s.id} className="absolute inset-0 data-cite-active:outline-none">
        <span className="sr-only">
          {s.evalName} · sample {sampleLabel(s.sample)}
        </span>
      </RunLink>
      {/* It covers the frame's bottom border, so that the two look like one shape. */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-[calc(100%+3px)] left-1/2 -translate-x-1/2 rounded-b-md border-x border-b border-sky-700 bg-white px-2 pt-1 pb-1 text-[9px] leading-none font-semibold tracking-wide whitespace-nowrap text-slate-400 uppercase opacity-0 shadow-md shadow-sky-800/40 transition-opacity duration-200 group-hover/chat:opacity-100 group-has-[[data-cite-active]]/chat:opacity-0"
      >
        Click to Read
      </span>
    </li>
  );
}
