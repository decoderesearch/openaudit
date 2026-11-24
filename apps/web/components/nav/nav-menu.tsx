'use client';

import { CardsHere } from '@/components/cards-here';
import Link from '@/components/link';
import { IncidentCategory } from '@/components/org/incident-category';
import { StoryLink } from '@/components/org/story-link';
import { formatLongDate } from '@/lib/org-research';
import { cn } from '@/lib/utils';
import { useWheelContain } from '@/lib/wheel-contain';
import type { IncidentPrimaryCategory } from '@openaudit/spec';
import { ArrowRight, ChevronDown, Search, type LucideIcon } from 'lucide-react';
import { Fragment, useEffect, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from 'react';

/** A navbar item with no menu, in the style of the menu links. */
export const NAV_ITEM =
  'flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-slate-500 transition-colors hover:text-sky-600 [&_svg]:size-4 [&_svg]:shrink-0';

/** Items that a menu list shows. A link to the full page gives the rest. */
export const SHOWN = 20;

/** A click that opens a link elsewhere (a new tab or window), or not with the main button. */
const isModified = (e: React.MouseEvent) => e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;

/** The items whose text has the filter in it, any letter case. */
export function filterItems<T>(items: T[], filter: string, text: (item: T) => string): T[] {
  const q = filter.trim().toLowerCase();
  return q ? items.filter((i) => text(i).toLowerCase().includes(q)) : items;
}

/**
 * A navbar link that opens a panel on a click, with a filter and a link to the full page. A
 * second click closes it. A modified click opens `href`, for example in a new tab. Arrow Down
 * also opens the panel. The panel's data is `initial`, else it loads from `api` when the page is
 * idle, or on open if that load failed. A click or focus outside, or Escape, closes the panel.
 */
export function NavMenu<T>({
  label,
  icon: Icon,
  href,
  active,
  api,
  initial = null,
  noun,
  width = 760,
  maxHeight,
  inlineFilter,
  body: Body,
}: {
  label: string;
  /** Shown to the left of the label. */
  icon: LucideIcon;
  href: string;
  active: boolean;
  /** The JSON route that gives the panel's data. */
  api: string;
  /** The data from the server. Null: load it from `api`. */
  initial?: T | null;
  /** "models": for the filter and the error text. */
  noun: string;
  width?: number;
  /** The panel's maximum height, in px. Its `MENU_LIST`s get shorter to fit. */
  maxHeight?: number;
  /** The body shows `filterInput` where it wants it, and the panel has no top bar. */
  inlineFilter?: boolean;
  /** The panel under the top bar. `onPick` closes the panel, but not after a modified click. */
  body: ComponentType<{ data: T; filter: string; filterInput: ReactNode; onPick: () => void }>;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<T | null>(initial);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState('');
  const [idle, setIdle] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const loading = useRef(false);
  useWheelContain(panel, open);

  useEffect(() => {
    if (!open) return;
    // A hover card or popover from the panel (a flagged chat's conversation) is outside the box.
    const outside = (e: Event) => {
      const t = e.target as Element;
      if (!box.current?.contains(t) && !t.closest?.('[data-slot=hover-card-content],[data-slot=popover-content]'))
        setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
    };
  }, [open]);

  useEffect(() => {
    if (typeof requestIdleCallback !== 'function') {
      const t = setTimeout(() => setIdle(true), 1000);
      return () => clearTimeout(t);
    }
    const id = requestIdleCallback(() => setIdle(true), { timeout: 3000 });
    return () => cancelIdleCallback(id);
  }, []);

  useEffect(() => {
    if (!(open || (idle && !failed)) || data || loading.current) return;
    loading.current = true;
    fetch(api)
      .then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error(String(r.status)))))
      .then(
        (d) => (setData(d), setFailed(false)),
        () => setFailed(true),
      )
      .finally(() => (loading.current = false));
  }, [open, idle, failed, data, api]);

  const close = () => setOpen(false);
  // A modified click in the panel opens a link in a new tab, so the panel stays open for more.
  const modified = useRef(false);
  const pick = () => !modified.current && close();
  const click = (e: React.MouseEvent) => {
    if (isModified(e)) return;
    e.preventDefault();
    // The top loading bar starts on each link click, and stays when no page loads.
    e.nativeEvent.stopImmediatePropagation();
    setOpen(!open);
  };

  const filterInput = (
    <label
      className={cn(
        'flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 focus-within:border-sky-600',
        inlineFilter ? 'w-36 min-w-0' : 'w-64',
      )}
    >
      <Search className="size-3.5 shrink-0 text-slate-400" />
      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter"
        aria-label={`Filter ${noun}`}
        className="w-full bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400"
      />
    </label>
  );

  return (
    <div ref={box} className="relative flex h-12 items-center" onKeyDown={(e) => e.key === 'Escape' && close()}>
      <Link
        href={href}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={click}
        onKeyDown={(e) => e.key === 'ArrowDown' && (e.preventDefault(), setOpen(true))}
        className={cn(
          '-mx-2 flex items-center gap-1 rounded-md px-2 py-1 transition-colors',
          open ? 'bg-sky-100 text-sky-900' : 'hover:bg-slate-100',
          active ? 'text-sky-800' : 'hover:text-sky-600',
        )}
      >
        <Icon className="mr-0.5 size-4 shrink-0" aria-hidden />
        {label}
        <ChevronDown className={cn('-ml-0.5 size-3.5 transition-transform duration-200', open && 'rotate-180')} />
      </Link>
      {open && (
        <div
          ref={panel}
          className="absolute top-9 -left-4 z-30 pt-1"
          style={{ width: `min(${width}px, calc(100vw - 2rem))` }}
          onClickCapture={(e) => (modified.current = isModified(e))}
        >
          <div
            className="overflow-hidden rounded-lg border border-slate-200 bg-white text-xs font-normal shadow-lg [--menu-above:0px]"
            style={maxHeight ? ({ '--menu-max': `${maxHeight}px` } as CSSProperties) : undefined}
          >
            {!inlineFilter && (
              <div className="flex items-center justify-between gap-4 bg-slate-100 px-4 pt-2 pb-0.5">
                {filterInput}
                <Link
                  href={href}
                  onClick={pick}
                  className="flex items-center gap-1 font-medium text-sky-800 hover:underline"
                >
                  Show All {label}
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            )}
            {data ? (
              <CardsHere.Provider value>
                <Body data={data} filter={filter} filterInput={inlineFilter ? filterInput : null} onPick={pick} />
              </CardsHere.Provider>
            ) : (
              <p className="px-4 py-6 text-slate-500">{failed ? `We could not load the ${noun}.` : 'Loading…'}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export const EYEBROW = 'text-[10px] font-semibold tracking-wide text-slate-400 uppercase';

/** The name of a menu column, as `INSET_TITLE` but lighter. */
export const MENU_TITLE = 'text-[11px] font-bold tracking-wide text-slate-400 uppercase';
/** The maximum height of the large menus' panels, in px. */
export const MENU_MAX_HEIGHT = 768;

/** A menu list's height: as tall as the screen allows, less the navbar, the panel's rows above the
 * list (`--menu-above`) and a margin at the bottom. With `--menu-max`, the panel (with its 2px
 * border) is no taller than that. */
export const MENU_HEIGHT =
  'max-h-[min(calc(100dvh-env(safe-area-inset-top)-var(--menu-above)-4.25rem),calc(var(--menu-max,100dvh)-var(--menu-above)-2px))]';
/** A menu's list, at `MENU_HEIGHT`, that scrolls. */
export const MENU_LIST = `no-scrollbar ${MENU_HEIGHT} overflow-y-auto overscroll-contain`;
/** The main link of a menu row. It covers the row; other links in the row need `relative z-10`. */
export const ROW_LINK =
  'truncate text-xs font-semibold text-slate-800 group-hover:text-sky-700 after:absolute after:inset-0';

/** A `MenuBlurHead` with the column's name (`MENU_TITLE`) at the left and a `MenuPageLink` at the right. */
export const MENU_HEAD = 'top-2.5 items-center justify-between gap-2 pr-3 pl-4';

/** A sky button that opens a page, for example the menu's page in a `MenuBlurHead`. `count`: a
 * subtle total, a shade darker than the label, before it. */
export function MenuPageLink({
  href,
  onPick,
  count,
  className,
  children,
}: {
  href: string;
  onPick?: () => void;
  count?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onPick}
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-x-1 rounded-full bg-sky-700 px-3 text-xs font-semibold text-white transition-colors hover:bg-sky-800',
        className,
      )}
    >
      {count !== undefined && <span className="font-bold text-slate-300">{count.toLocaleString('en-US')}</span>}
      {children}
      <ArrowRight aria-hidden className="size-3.5" />
    </Link>
  );
}

/** Incident titles under a menu row, each under its category. A title wraps to 3 lines at most. A
 * response from before a deploy can have no category. `after`: after each category, past a dot. */
export function MenuIncidents({
  incidents,
  onPick,
  after,
  className,
  titleClassName,
}: {
  incidents: { title: string; href?: string; category?: IncidentPrimaryCategory }[];
  onPick: () => void;
  after?: ReactNode;
  className?: string;
  titleClassName?: string;
}) {
  if (!incidents.length) return null;
  return (
    <ul className={cn('mt-0.5 flex flex-col gap-y-0.5 pl-3', className)}>
      {incidents.map((i) => (
        <li key={i.title} className="flex min-w-0 flex-col">
          {after ? (
            <span className="flex min-w-0 items-baseline gap-x-1 text-[9px]/3">
              {i.category && (
                <>
                  <IncidentCategory category={i.category} className="shrink-0 text-[9px]/3" />
                  <span aria-hidden className="text-slate-400">
                    ·
                  </span>
                </>
              )}
              {after}
            </span>
          ) : (
            i.category && <IncidentCategory category={i.category} className="text-[9px]/3" />
          )}
          <StoryLink
            href={i.href}
            onClick={onPick}
            className={cn(
              'relative z-10 line-clamp-3 min-w-0 text-[11px] leading-4 font-medium text-slate-700 hover:underline',
              titleClassName,
            )}
          >
            {i.title}
          </StoryLink>
        </li>
      ))}
    </ul>
  );
}

/** The head of a menu column: `children` float on a blur that fades out, over the top of the list.
 * The column must be `relative`, and its list needs top padding. `blur`: the blur's height class. */
export function MenuBlurHead({
  children,
  className,
  blur = 'h-16',
  mask = '[mask-image:linear-gradient(to_bottom,black_45%,transparent)]',
}: {
  children: ReactNode;
  className?: string;
  blur?: string;
  /** The fade mask: how far the blur stays opaque before it fades out. */
  mask?: string;
}) {
  return (
    <>
      <div
        aria-hidden
        className={cn('pointer-events-none absolute inset-x-0 top-0 z-20 bg-white/50 backdrop-blur-sm', mask, blur)}
      />
      <div className={cn('pointer-events-none absolute inset-x-0 z-20 flex [&>*]:pointer-events-auto', className)}>
        {children}
      </div>
    </>
  );
}

/** A menu column of feed entries, as on the full page: a date line before the first entry of each
 * day, and a link to the full feed. The entries scroll under a "New Updates" pill, or `heading`;
 * `title` names the column for screen readers. `item`: the body of one entry's row. `spaced`: more
 * space below each date line. `empty`: the text when there are no entries. `link`: a
 * `MenuPageLink` above `heading`. */
export function MenuFeed<T extends { key: string; date: string }>({
  title,
  heading,
  head,
  link,
  entries,
  href,
  item,
  onPick,
  spaced,
  dense,
  bare,
  flush,
  undated,
  empty = 'No updates match.',
  className,
}: {
  title: string;
  /** A title at the top left, in place of the pill. */
  heading?: string;
  /** A block at the top left, in place of `heading`: it floats over the list, which fades under it. */
  head?: ReactNode;
  link?: ReactNode;
  empty?: ReactNode;
  entries: T[];
  href: string;
  item: (entry: T) => ReactNode;
  onPick: () => void;
  spaced?: boolean;
  /** Less space between the rows of a day, and between days. */
  dense?: boolean;
  /** No head: the dates start at the top. */
  bare?: boolean;
  /** Rows are not indented under their date. */
  flush?: boolean;
  /** No date lines, for entries not in date order. */
  undated?: boolean;
  className?: string;
}) {
  return (
    <section aria-label={title} className={cn('relative flex min-w-0 flex-col', className)}>
      {(heading || head) && (
        // As tall as a `MenuPageLink`, so it lines up with one in the next column's head.
        <MenuBlurHead
          blur={head ? 'h-56' : link ? 'h-[4.75rem]' : 'h-11'}
          mask={head ? '[mask-image:linear-gradient(to_bottom,black_70%,transparent)]' : undefined}
          className={cn(MENU_HEAD, 'top-3', link || head ? 'flex-col items-start gap-y-2.5' : 'h-6')}
        >
          {link}
          {head ?? <span className={MENU_TITLE}>{heading}</span>}
        </MenuBlurHead>
      )}
      {!bare && !heading && !head && (
        <MenuBlurHead blur="h-10" className="top-2.5 justify-center px-3">
          <span
            aria-hidden
            className="pointer-events-none! rounded-full bg-white/80 px-3.5 py-1 text-[10px] font-semibold tracking-wide text-slate-500 uppercase backdrop-blur-md"
          >
            New Updates
          </span>
        </MenuBlurHead>
      )}
      <ul
        className={cn(
          MENU_LIST,
          'pb-2',
          head ? 'pt-44' : heading ? (link ? 'pt-16' : 'pt-10') : bare ? 'pt-1' : 'pt-8',
        )}
      >
        {entries.length === 0 && <li className="px-4 py-2 text-slate-500">{empty}</li>}
        {entries.map((e, i) => {
          const firstOfDay = !undated && (i === 0 || entries[i - 1].date !== e.date);
          const lastOfDay = !undated && (i === entries.length - 1 || entries[i + 1].date !== e.date);
          return (
            <Fragment key={e.key}>
              {firstOfDay && (
                <li
                  className={cn(
                    'px-4 text-[10px] font-semibold tracking-wide text-slate-400 uppercase',
                    i === 0 ? 'pt-2' : dense ? 'pt-1.5' : 'pt-3',
                  )}
                >
                  {formatLongDate(e.date)}
                </li>
              )}
              <li
                className={cn(
                  'group relative flex flex-col px-4 hover:bg-slate-50',
                  !flush && 'pl-6',
                  dense
                    ? cn(firstOfDay ? 'pt-1.5' : 'pt-0.5', lastOfDay ? 'pb-2.5' : 'pb-0.5')
                    : cn(firstOfDay ? (spaced ? 'pt-2' : 'pt-1') : 'pt-2', lastOfDay ? 'pb-3' : 'pb-2'),
                )}
              >
                {item(e)}
              </li>
            </Fragment>
          );
        })}
        {entries.length > 0 && (
          <li>
            <Link href={href} onClick={onPick} className="block px-4 pt-2 font-medium text-sky-800 hover:underline">
              More updates…
            </Link>
          </li>
        )}
      </ul>
    </section>
  );
}

/** "980 more…", to the full page. Nothing when no items are left. */
export function MoreLink({ href, count, onPick }: { href: string; count: number; onPick: () => void }) {
  if (count <= 0) return null;
  return (
    <Link href={href} onClick={onPick} className="block px-2 py-1 font-medium text-sky-800 hover:underline">
      {count.toLocaleString('en-US')} more…
    </Link>
  );
}
