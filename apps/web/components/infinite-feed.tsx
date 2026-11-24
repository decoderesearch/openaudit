'use client';

import { INSET_TITLE } from '@/components/box-title';
import Link from '@/components/link';
import type { FeedPage } from '@/lib/feed';
import { formatLongDate } from '@/lib/org-research';
import { useReveal } from '@/lib/use-reveal';
import { cn } from '@/lib/utils';
import { OWN_WHEEL } from '@/lib/wheel-contain';
import { LoaderCircle } from 'lucide-react';
import { useRouter } from 'nextjs-toploader/app';
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

/** With `all`: the rows that show at a time. */
const ALL_STEP = 40;
const NONE: never[] = [];

const pageUrl = (endpoint: string, offset: number) =>
  `${endpoint}${endpoint.includes('?') ? '&' : '?'}offset=${offset}`;

async function fetchPage<T>(url: string): Promise<FeedPage<T>> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as FeedPage<T>;
}

const contents = (el: Element) => getComputedStyle(el).display === 'contents';

/** The element before or after `el` in the layout, through parents with `display: contents`. */
function beside(el: Element, next: boolean): Element | null {
  for (let e: Element | null = el; e; e = e.parentElement) {
    const s = next ? e.nextElementSibling : e.previousElementSibling;
    if (s) return s;
    if (!e.parentElement || !contents(e.parentElement)) return null;
  }
  return null;
}

/** The box of `el`, or of its first child with a box when it has `display: contents`. */
function boxOf(el: Element | null): DOMRect | undefined {
  for (let e = el; e; e = e.firstElementChild) if (!contents(e)) return e.getBoundingClientRect();
}

/** True when `x` is in the gap between `el` and the element before or after it. */
function inGap(el: Element, x: number) {
  const r = el.getBoundingClientRect();
  const before = boxOf(beside(el, false));
  const after = boxOf(beside(el, true));
  return (!!before && x >= before.right && x < r.left) || (!!after && x > r.right && x <= after.left);
}

/** When `side` is set and the screen is `lg` or wider: a wheel to that side of `area`, in its
 * height, scrolls `box`. `gaps`: in the gaps between `area` and the elements beside it. `over`: on
 * `area` (outside `box`) or left of it. When `box` cannot scroll that way, or the wheel is on a
 * box with its own wheel (`OWN_WHEEL`), the page gets it. */
export function useWheelFromSide(
  side: 'left' | 'right' | 'gaps' | 'over' | undefined,
  area: RefObject<HTMLElement | null>,
  box: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!side) return;
    const wide = window.matchMedia('(min-width: 64rem)');
    const onWheel = (e: WheelEvent) => {
      const [a, b] = [area.current, box.current];
      if (!a || !b || !wide.matches || e.ctrlKey || !e.deltaY) return;
      const r = a.getBoundingClientRect();
      const beside =
        side === 'gaps'
          ? inGap(a, e.clientX)
          : side === 'left'
            ? e.clientX < r.left
            : side === 'over'
              ? e.clientX <= r.right
              : e.clientX > r.right;
      if (!beside || e.clientY < r.top || e.clientY > r.bottom) return;
      const t = e.target instanceof Element ? e.target : null;
      if (t?.closest(OWN_WHEEL) || (t && b.contains(t))) return;
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? b.clientHeight : 1);
      const room = dy > 0 ? b.scrollHeight - b.clientHeight - b.scrollTop : b.scrollTop;
      if (room < 1) return;
      e.preventDefault();
      b.scrollBy({ top: dy });
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [side, area, box]);
}

/**
 * A box of feed entries that scrolls in itself, with `title` above it. It starts with `first` (from the server) and
 * gets the next page from `endpoint` with `offset=N` when the user scrolls near the end. With no `first`, it gets the first page too.
 * When `endpoint` changes, it starts again from its first page.
 */
export function InfiniteFeed<T extends { key: string }>({
  title,
  mobileTitle,
  first,
  endpoint = '',
  all,
  renderEntry,
  empty = 'No updates yet.',
  hideEnd,
  head,
  lead,
  untitled,
  inset,
  insetHead,
  actions,
  headClassName,
  boxClassName,
  scrollClassName,
  bare,
  cards,
  chain,
  wheelFrom,
  className,
}: {
  title: string;
  /** A slate box with no border or line under its head; use `boxed` for the entries. From `md` to
   * `lg`, the entries are in 2 columns. */
  cards?: boolean;
  /** At the end of the box's scroll, the page scrolls on. */
  chain?: boolean;
  /** On a wide screen, the mouse wheel beside the box (see `useWheelFromSide`) scrolls the box. */
  wheelFrom?: 'left' | 'right' | 'gaps';
  /** The title in the box, at its top left: small, bold and uppercase. */
  inset?: boolean;
  /** With `inset`: at the top left in place of the title, which must then hold the title. */
  insetHead?: ReactNode;
  /** With `inset`: at the top right of the box. */
  actions?: ReactNode;
  /** With `inset`: classes for the head. */
  headClassName?: string;
  /** Classes for the box. */
  boxClassName?: string;
  /** Classes for the part of the box that scrolls. */
  scrollClassName?: string;
  /** No border around the box. With `inset`: a larger title. */
  bare?: boolean;
  /** Shown above the box in place of `title`, which stays the name for screen readers. */
  head?: ReactNode;
  /** At the top of the box's scroll, above the entries. */
  lead?: ReactNode;
  /** No title shown: `title` is only the name for screen readers. */
  untitled?: boolean;
  /** The title under `lg`, if it is not `title`. */
  mobileTitle?: string;
  first?: FeedPage<T>;
  endpoint?: string;
  /** Every entry, so that nothing loads: in place of `first` and `endpoint`. The rows show
   * `ALL_STEP` at a time as the reader scrolls. */
  all?: T[];
  /** `all`: the entries loaded so far, so that an entry can see the one before it. */
  renderEntry: (entry: T, index: number, all: T[]) => ReactNode;
  empty?: string;
  /** No "No older updates." line after the last entry. */
  hideEnd?: boolean;
  className?: string;
}) {
  const [loaded, setEntries] = useState(first?.entries ?? []);
  const [moreLoaded, setMore] = useState(first?.more ?? true);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const section = useRef<HTMLElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const revealed = useReveal(all ?? NONE, ALL_STEP, box, end);
  const entries = all ? (revealed.shown as T[]) : loaded;
  const more = all ? revealed.more : moreLoaded;
  useWheelFromSide(wheelFrom, section, box);
  const [from, setFrom] = useState(endpoint);
  const current = useRef(endpoint);
  if (endpoint !== from) {
    setFrom(endpoint);
    setEntries([]);
    setMore(true);
    setState('idle');
  }
  useEffect(() => {
    current.current = endpoint;
    box.current?.scrollTo({ top: 0 });
  }, [endpoint]);
  useEffect(() => {
    box.current?.scrollTo({ top: 0 });
  }, [all]);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const page = await fetchPage<T>(pageUrl(endpoint, entries.length));
      if (current.current !== endpoint) return;
      setEntries((old) => {
        const seen = new Set(old.map((e) => e.key));
        return [...old, ...page.entries.filter((e) => !seen.has(e.key))];
      });
      setMore(page.more);
      setState('idle');
    } catch {
      if (current.current === endpoint) setState('error');
    }
  }, [endpoint, entries.length]);

  useEffect(() => {
    if (all || !more || state !== 'idle' || !end.current) return;
    // A box that does not scroll (under `lg`, in a `Fold`): the page loads more as it scrolls.
    const b = box.current;
    const observer = new IntersectionObserver((seen) => seen.some((s) => s.isIntersecting) && load(), {
      root: b && b.scrollHeight > b.clientHeight ? b : null,
      rootMargin: '0px 0px 600px 0px',
    });
    observer.observe(end.current);
    return () => observer.disconnect();
  }, [all, more, state, load]);

  return (
    <section ref={section} aria-label={title} className={cn('flex min-h-0 flex-col', className)}>
      {head ? (
        <div className="mb-2 flex h-7 items-center">{head}</div>
      ) : (
        !inset &&
        !untitled && (
          <h2 className="mb-2 flex h-7 items-center text-sm font-semibold text-slate-600">
            {mobileTitle ? (
              <>
                <span className="max-lg:hidden">{title}</span>
                <span className="lg:hidden">{mobileTitle}</span>
              </>
            ) : (
              title
            )}
          </h2>
        )
      )}
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-hidden',
          cards ? 'rounded-lg bg-slate-100' : 'bg-white',
          !bare && !cards && 'rounded-lg border border-slate-200',
          boxClassName,
        )}
      >
        {inset && (
          <div
            className={cn(
              'flex h-10 shrink-0 items-center justify-between gap-x-3 px-4 sm:px-5',
              cards
                ? 'h-9 pt-1'
                : cn(
                    'bg-slate-50 max-sm:h-auto max-sm:min-h-10 max-sm:flex-wrap max-sm:gap-y-1.5 max-sm:py-2',
                    !bare && 'pl-5 sm:pl-6',
                  ),
              headClassName,
            )}
          >
            {insetHead ?? <h2 className={cn(INSET_TITLE, bare && 'text-xs', cards && 'text-slate-600')}>{title}</h2>}
            {actions}
          </div>
        )}
        <div
          ref={box}
          data-feed-list
          className={cn('min-h-0 flex-1 overflow-y-auto', !chain && 'overscroll-contain', scrollClassName)}
        >
          {lead}
          {entries.length > 0 && (
            <ul
              className={cn(cards && 'flex flex-col gap-y-2 px-3 md:max-lg:grid md:max-lg:grid-cols-2 md:max-lg:gap-2')}
            >
              {entries.map(renderEntry)}
            </ul>
          )}
          {!entries.length && !more && (
            <p className={cn('px-4 py-3 text-sm text-slate-500', cards && 'text-slate-600')}>{empty}</p>
          )}
          <div ref={end} className="flex justify-center px-4 py-3 text-xs text-slate-500">
            {state === 'loading' && (
              <span className="inline-flex items-center gap-x-1.5">
                <LoaderCircle className="size-3.5 animate-spin" /> Loading more updates
              </span>
            )}
            {state === 'error' && (
              <button type="button" onClick={load} className="cursor-pointer text-sky-800 hover:underline">
                We could not load more updates. Try again.
              </button>
            )}
            {!more && entries.length > 0 && !hideEnd && <span className="text-slate-400">No older updates.</span>}
          </div>
        </div>
      </div>
    </section>
  );
}

type DayEntry = { key: string; date: string; href: string };

/** A `renderEntry` that puts a date line before the first entry of each day. `content`: the body of
 * one entry's row. `flush`: rows are not indented under their date. `dense`: less space between the
 * rows of a day, and between days. `rules`: a line between days. */
export function byDay<T extends DayEntry>(
  content: (entry: T) => ReactNode,
  { flush = false, dense = false, rules = true } = {},
) {
  function renderEntry(e: T, i: number, all: T[]) {
    const firstOfDay = i === 0 || all[i - 1].date !== e.date;
    const lastOfDay = i === all.length - 1 || all[i + 1].date !== e.date;
    return (
      <Fragment key={e.key}>
        {firstOfDay && (
          <li
            className={cn(
              'px-4 text-[11px] font-semibold tracking-wide text-slate-400 uppercase sm:px-5',
              rules && 'border-t border-slate-200 first:border-t-0',
              dense ? 'pt-1 first:pt-2' : 'pt-4',
            )}
          >
            {formatLongDate(e.date)}
          </li>
        )}
        <DayRow href={e.href} firstOfDay={firstOfDay} lastOfDay={lastOfDay} flush={flush} dense={dense}>
          {content(e)}
        </DayRow>
      </Fragment>
    );
  }
  return renderEntry;
}

/** A `renderEntry` with no indent and no click on the row. A row with a
 * `data-row-link` link (that covers the row) is sky on hover. With no `dated`, a line between rows
 * that starts at the rows' text. `dated`: a date at the top of the
 * first row of each day, the rows indented under it and closer together; the hover color is only
 * under the date. `roomy`: with no `dated`, more space at the top of each row. `even`: with no
 * `dated`, the same space above and below each row. */
export function lined<T extends DayEntry>(
  content: (entry: T) => ReactNode,
  { dated = false, roomy = false, even = false } = {},
) {
  function renderEntry(e: T, i: number, all: T[]) {
    const firstOfDay = !dated || i === 0 || all[i - 1].date !== e.date;
    if (!dated) {
      return (
        <FeedRow
          key={e.key}
          className={cn(
            'group/row pt-2 pr-4 pb-4 pl-5 not-first:before:absolute not-first:before:top-0 not-first:before:right-0 not-first:before:left-5 not-first:before:h-px not-first:before:bg-slate-100 first:pt-3 has-[[data-row-link]]:hover:bg-sky-50 sm:pr-5 sm:pl-6 sm:not-first:before:left-6',
            roomy && 'pt-3 first:pt-4',
            even && 'pt-3 pb-3',
          )}
        >
          {content(e)}
        </FeedRow>
      );
    }
    return (
      <FeedRow key={e.key} className={cn('gap-y-1 px-4 pb-2.5 sm:px-5', firstOfDay ? 'pt-2' : 'pt-0')}>
        {firstOfDay && (
          <span className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            {formatLongDate(e.date)}
          </span>
        )}
        <div className="group/row relative ml-1 flex flex-col gap-y-2 rounded-md pl-2 transition-colors has-[[data-row-link]]:-mr-2 has-[[data-row-link]]:py-1 has-[[data-row-link]]:pr-2 has-[[data-row-link]]:hover:bg-sky-50">
          {content(e)}
        </div>
      </FeedRow>
    );
  }
  return renderEntry;
}

/** A `renderEntry` for an `InfiniteFeed` with `cards`: each entry in a white box with no border,
 * that opens the entry's `href`. On hover, as a model in the home page's list: a sky box, border
 * and shadow, and a tab under it with `hint`. Links in `content` need `relative` to be above the
 * box's link. A part with `data-own-link` has its own hover: on it, the box does not change.
 * `className`: added to the box's classes. */
export function boxed<T extends { key: string; href: string }>(
  content: (entry: T) => ReactNode,
  hint: (entry: T) => string,
  className?: string,
) {
  function renderEntry(e: T) {
    return (
      <FeedRow
        key={e.key}
        className={cn(
          'group/entry rounded-[10px] border border-transparent bg-white px-4 py-3 hover:z-10 hover:border-sky-700 hover:bg-sky-50 hover:shadow-md hover:shadow-sky-800/40 has-[[data-own-link]:hover]:border-transparent! has-[[data-own-link]:hover]:bg-white! has-[[data-own-link]:hover]:shadow-none!',
          className,
        )}
      >
        <Link href={e.href} hover={false} aria-hidden tabIndex={-1} className="absolute inset-0 rounded-[10px]" />
        {content(e)}
        {/* It covers the box's bottom border, so that the two look like one shape. */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-[calc(100%-1px)] left-1/2 -translate-x-1/2 rounded-b-md border-x border-b border-sky-700 bg-sky-50 px-2 pt-1 pb-1 text-[9px] leading-none font-semibold tracking-wide whitespace-nowrap text-slate-400 uppercase opacity-0 shadow-md shadow-sky-800/40 transition-opacity duration-200 group-hover/entry:opacity-100 group-has-[[data-own-link]:hover]/entry:opacity-0!"
        >
          {hint(e)}
        </span>
      </FeedRow>
    );
  }
  return renderEntry;
}

/** From md up, rows are indented under their date (not with `flush`). */
function DayRow({
  href,
  firstOfDay,
  lastOfDay,
  flush,
  dense,
  children,
}: {
  href: string;
  firstOfDay: boolean;
  lastOfDay: boolean;
  flush: boolean;
  dense: boolean;
  children: ReactNode;
}) {
  return (
    <FeedRow
      href={href}
      className={cn(
        'gap-y-1 px-4 sm:px-5',
        !flush && 'md:pl-9',
        firstOfDay ? 'pt-1.5' : dense ? 'pt-1' : 'pt-2.5',
        lastOfDay ? (dense ? 'pb-3' : 'pb-4') : dense ? 'pb-1' : 'pb-2.5',
        'hover:bg-slate-50',
      )}
    >
      {children}
    </FeedRow>
  );
}

/** With `href`, a click on the row opens it. A click on a link, a button, a table row or a dialog,
 * or one that selects text, does not. */
function FeedRow({ href, className, children }: { href?: string; className: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <li
      onClick={(ev) => {
        const t = ev.target as HTMLElement;
        if (!href || !ev.currentTarget.contains(t) || t.closest('a, button, tr') || getSelection()?.toString()) return;
        router.push(href);
      }}
      className={cn('relative flex flex-col gap-y-2 transition-colors', href && 'cursor-pointer', className)}
    >
      {children}
    </li>
  );
}
