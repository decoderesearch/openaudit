'use client';

import type { PanelView } from '@/app/runs/panel';
import { CITE_BADGE, PILL_BUTTON } from '@/components/cite-badge';
import Link from '@/components/link';
import { PAGE_COLUMN } from '@/components/page';
import {
  isSamplePanel,
  panelFromParams,
  panelFromPath,
  panelKey,
  panelPath,
  withPanel,
  type Panel,
} from '@/lib/run-panel';
import { cn } from '@/lib/utils';
import { useWheelContain } from '@/lib/wheel-contain';
import { Expand, LoaderCircle, SquareArrowRightEnter, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';

// A site-wide viewer for PDFs we host, or for a run or attempt: a sheet on the bottom half of the
// screen. One shows at a time. A panel is in the query string (see
// `lib/run-panel.ts`), so a shared link opens it. The header links to the full page or to our copy
// of the PDF, and to the publisher's original.

/** `url` is our saved copy (same origin); `originalUrl` is the publisher's link. */
export type PdfDocument = { url: string; title: string; originalUrl?: string };
/** `page` is the page in the file, from 1; `pageLabel` is the number printed on it; `quote` is marked. */
export type PdfTarget = PdfDocument & { page?: number; pageLabel?: string; quote?: string };

/** Where the target is: a page ("12", "12-13") or, for a web page's cites, a section ("3.2", "Results"). */
function place(t: PdfTarget) {
  const label = t.pageLabel ?? String(t.page);
  const page = /^\d+(?![.\d])/.test(label);
  return { long: `${page ? 'page' : 'section'} ${label}`, short: `${page ? 'p.' : '§'} ${label}` };
}

type Open<T> = (target: T, anchor?: Element) => void;
const PdfViewerContext = createContext<{
  pdf: Open<PdfTarget>;
  run: Open<Panel>;
  mark: (anchor: Element) => void;
} | null>(null);

function useViewer() {
  const open = useContext(PdfViewerContext);
  if (!open) throw new Error('The viewer needs a PdfViewerProvider');
  return open;
}

/** Opens the PDF viewer. If it opens now, `anchor` scrolls to a quarter of the way down the screen. */
export function usePdfViewer() {
  return useViewer().pdf;
}

/** Opens a run or attempt in the viewer, as `usePdfViewer` opens a PDF. */
export function useRunViewer() {
  return useViewer().run;
}

/** `useRunViewer`, or undefined outside a viewer. */
export function useRunViewerIfAny() {
  return useContext(PdfViewerContext)?.run;
}

/** Marks an element as the clicked citation, for what the viewer shows now (for example a panel
 * from the page's URL). Undefined outside a viewer. */
export function useMarkCite() {
  return useContext(PdfViewerContext)?.mark;
}

const PanelRefreshContext = createContext<(() => void) | null>(null);

/** In the viewer's run or attempt: reads it again (for example after the reader accepts terms). */
export function usePanelRefresh() {
  return useContext(PanelRefreshContext);
}

/** This page's URL with `panel` in the query string. */
function urlWith(pathname: string, search: URLSearchParams, panel: Panel | null) {
  const q = withPanel(search, panel);
  return `${pathname}${q.size ? `?${q}` : ''}`;
}

/** Sets the panel in the URL. Next.js reads the new query string; the page does not load again. */
const pushPanel = (panel: Panel | null) =>
  window.history.pushState(null, '', urlWith(location.pathname, new URLSearchParams(location.search), panel));

type Loaded = { key: string; view: PanelView | null } | 'error';

/** The view of `panel`. While the next loads, `loaded` is still the last one. */
function usePanelView(panel: Panel | null) {
  const key = panel && panelKey(panel);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!panel || !key) return;
    let live = true;
    import('@/app/runs/panel')
      .then(({ panelView }) => panelView(panel))
      .then(
        (view) => live && setLoaded({ key, view }),
        () => live && setLoaded('error'),
      );
    return () => {
      live = false;
    };
    // `key` stands for `panel`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  const current = loaded !== 'error' && loaded?.key === key;
  return { loaded: key ? loaded : null, loading: !!key && !current, refresh };
}

/** The URL to frame: `#page=` opens the PDF at that page. */
export function pdfSrc({ url, page }: PdfTarget) {
  return page ? `${url.split('#')[0]}#page=${page}` : url;
}

/** Reports the query string. It is in its own Suspense boundary, so static pages still prerender. */
function SearchWatch({ onChange }: { onChange: (search: string) => void }) {
  const search = useSearchParams()?.toString() ?? '';
  useEffect(() => onChange(search), [search, onChange]);
  return null;
}

/** The slide-out time of the sheet (`duration-150`), plus a frame. */
const SLIDE_OUT_MS = 170;
const OPEN_PAGE = 'flex items-center gap-x-1 text-sky-800 hover:underline';
const TITLE_LINK = 'min-w-0 truncate font-medium text-slate-700 hover:text-sky-800 hover:underline';

/** An open menu or dialog over the viewer: Escape or a press outside closes that first. */
const LAYERS = '[data-radix-popper-content-wrapper]:not(:has([role="tooltip"])), [role="dialog"][data-state="open"]';

export function PdfViewerProvider({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState('');
  const urlPanel = useMemo(() => panelFromParams(new URLSearchParams(search)), [search]);
  const [openPdf, setPdf] = useState<PdfTarget | null>(null);
  // Opening a PDF takes the run or attempt out of the URL, so both show only after Back or
  // Forward. Then the run or attempt wins.
  const openNow = urlPanel ? null : openPdf;
  const target = openNow ?? urlPanel;
  // The sheet keeps the last item while it slides down.
  const [last, setLast] = useState<{ pdf: PdfTarget | null; panel: typeof urlPanel } | null>(null);
  const livePanel = openNow ? null : urlPanel;
  if (target && (last?.pdf !== openNow || last?.panel !== livePanel)) setLast({ pdf: openNow, panel: livePanel });
  useEffect(() => {
    if (target || !last) return;
    const timer = setTimeout(() => setLast(null), SLIDE_OUT_MS);
    return () => clearTimeout(timer);
  }, [target, last]);
  const pdf = target ? openNow : (last?.pdf ?? null);
  const { loaded, loading, refresh } = usePanelView(target ? livePanel : (last?.panel ?? null));
  const view = loaded && loaded !== 'error' && !loading ? loaded.view : null;
  const pad = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // The clicked citation keeps an outline until the reader closes or scrolls the viewer.
  const marked = useRef<Element | null>(null);
  const unmark = useCallback(() => {
    marked.current?.removeAttribute('data-cite-active');
    marked.current = null;
  }, []);
  const mark = useCallback(
    (anchor: Element) => {
      unmark();
      anchor.setAttribute('data-cite-active', '');
      marked.current = anchor;
    },
    [unmark],
  );
  const reveal = useCallback(
    (anchor?: Element) => {
      if (anchor) mark(anchor);
      else unmark();
      // Opening narrows the page (or covers its bottom), so the anchor can move away. If it is out
      // of view, it goes just below the navbar and the sticky bars. Also when the viewer is open:
      // on a phone, the sheet leaves room for about one row.
      if (anchor)
        setTimeout(() => {
          const band = openBand();
          const r = anchor.getBoundingClientRect();
          if (r.top >= band.top && r.bottom <= band.bottom) return;
          const top = anchor.getBoundingClientRect().top + window.scrollY - band.top - 8;
          const short = top - (document.documentElement.scrollHeight - window.innerHeight);
          if (short > 0 && pad.current) pad.current.style.height = `${short}px`;
          window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        }, 100);
    },
    [mark, unmark],
  );
  const value = useMemo(
    () => ({
      pdf: (t: PdfTarget, anchor?: Element) => {
        reveal(anchor);
        if (panelFromParams(new URLSearchParams(location.search))) pushPanel(null);
        setPdf(t);
      },
      run: (p: Panel, anchor?: Element) => {
        // A link in the panel has no anchor: the card's link stays marked.
        if (anchor) reveal(anchor);
        setPdf(null);
        pushPanel(p);
      },
      mark,
    }),
    [reveal, mark],
  );
  const close = useCallback(() => {
    unmark();
    setPdf(null);
    if (panelFromParams(new URLSearchParams(location.search))) pushPanel(null);
  }, [unmark]);

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector(LAYERS) && close();
    // Capture: a dialog closes on Escape before the key gets to the window.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [target, close]);

  // A press outside closes the viewer. Not for links that open it, the scroll bar, or the menus
  // and dialogs that open from it (they are outside it in the DOM).
  useEffect(() => {
    if (!target) return;
    const keep = '[role="dialog"], [data-radix-popper-content-wrapper], [data-viewer-open]';
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Element;
      if (e.button !== 0 || !document.contains(t) || t.closest(keep)) return;
      if (t === document.documentElement && e.clientX >= t.clientWidth) return;
      if (document.querySelector(LAYERS)) return;
      close();
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [target, close]);

  // Only the reader's own scrolling: the viewer also scrolls itself to the page.
  useEffect(() => {
    const el = panel.current;
    if (!target || !el) return;
    const keys = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);
    const onKey = (e: KeyboardEvent) => keys.has(e.key) && unmark();
    // A press on a scroll bar is outside the element's client area.
    const onPointer = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (e.offsetX > t.clientWidth || e.offsetY > t.clientHeight) unmark();
    };
    el.addEventListener('wheel', unmark, { passive: true });
    el.addEventListener('touchmove', unmark, { passive: true });
    el.addEventListener('keydown', onKey);
    el.addEventListener('pointerdown', onPointer);
    return () => {
      el.removeEventListener('wheel', unmark);
      el.removeEventListener('touchmove', unmark);
      el.removeEventListener('keydown', onKey);
      el.removeEventListener('pointerdown', onPointer);
    };
  }, [target, unmark]);

  useWheelContain(panel, !!target);

  const src = useMemo(() => (pdf ? pdfSrc(pdf) : (view?.href ?? null)), [pdf, view]);
  const title = pdf?.title ?? view?.title ?? (loaded === 'error' || (loaded && !loading) ? 'Not found' : 'Loading…');

  return (
    <PdfViewerContext.Provider value={value}>
      <Suspense fallback={null}>
        <SearchWatch onChange={setSearch} />
      </Suspense>
      {children}
      {(target || last) && (
        <>
          {/* Zero height, so that a page that fits the window keeps its size; the rooms hang below it. */}
          <div aria-hidden className="h-0 shrink-0">
            {/* Room to scroll the page's end above the viewer. */}
            <div data-scroll-room className="h-[75dvh]" />
            {/* Room to scroll the clicked citation up; see `reveal`. */}
            <div ref={pad} data-scroll-room />
          </div>
          <div
            ref={panel}
            role="dialog"
            data-viewer-sheet
            aria-label={`${title}${pdf?.page ? `, ${place(pdf).long}` : ''}`}
            className={cn(
              'fixed inset-x-0 bottom-0 z-30 flex h-[75dvh] border-t border-slate-300 bg-slate-50 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_24px_rgba(15,23,42,0.2)]',
              'xl:inset-x-6 xl:mx-auto xl:max-w-page xl:overflow-hidden xl:rounded-t-xl xl:border-x',
              target
                ? 'animate-in duration-200 ease-out slide-in-from-bottom'
                : 'pointer-events-none animate-out duration-150 ease-in fill-mode-forwards slide-out-to-bottom',
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="h-9 shrink-0 border-b border-slate-200 bg-slate-100 text-xs">
                <div className="flex h-full items-center gap-x-3 px-4 sm:px-6">
                  {src && pdf ? (
                    <a href={src} rel="noreferrer nofollow" title={title} className={TITLE_LINK}>
                      {title}
                    </a>
                  ) : src ? (
                    <Link href={src} title={title} className={TITLE_LINK}>
                      {title}
                    </Link>
                  ) : (
                    <span className="min-w-0 truncate font-medium text-slate-700" title={title}>
                      {title}
                    </span>
                  )}
                  {pdf?.page && <span className="shrink-0 text-slate-500">{place(pdf).short}</span>}
                  <div className="ml-auto flex shrink-0 items-center gap-x-3">
                    {pdf?.originalUrl && (
                      <a
                        href={pdf.originalUrl}
                        target="_blank"
                        rel="noreferrer nofollow"
                        className="text-sky-800 hover:underline"
                      >
                        Original
                      </a>
                    )}
                    {src &&
                      (pdf ? (
                        <a href={src} rel="noreferrer nofollow" className={OPEN_PAGE}>
                          <Expand className="size-3" /> Open Page
                        </a>
                      ) : (
                        <Link href={src} className={OPEN_PAGE}>
                          <Expand className="size-3" /> Open Page
                        </Link>
                      ))}
                    <button
                      type="button"
                      onClick={close}
                      aria-label={pdf ? 'Close the PDF viewer' : 'Close the panel'}
                      className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
              {pdf ? (
                <PdfJsView key={pdf.url} url={pdf.url} page={pdf.page} quote={pdf.quote} />
              ) : (
                <PanelRefreshContext.Provider value={refresh}>
                  <RunPanelBody view={view} loading={loading} failed={loaded === 'error' && !loading} />
                </PanelRefreshContext.Provider>
              )}
            </div>
          </div>
        </>
      )}
    </PdfViewerContext.Provider>
  );
}

/** True when `n` is a scroll box that can still scroll by `delta` on its `y` (else x) axis. */
/** A run or attempt in the viewer. While the next loads, only "Loading…" shows. */
function RunPanelBody({ view, loading, failed }: { view: PanelView | null; loading: boolean; failed: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  // Before the view's own effects, which can scroll to a flagged message.
  useLayoutEffect(() => {
    (box.current?.firstElementChild as HTMLElement | null)?.style.removeProperty('padding-bottom');
    box.current?.scrollTo(0, 0);
  }, [view]);
  return (
    <>
      {/* A size container: content sizes itself to the box with `cqh`. */}
      <div
        ref={box}
        data-scroll
        className="[container-type:size] relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {view ? (
          <div className={cn(PAGE_COLUMN, '@container flex flex-col gap-y-5 py-4')}>{view.body}</div>
        ) : failed ? (
          <p className="p-4 text-sm text-rose-700">Could not load this item.</p>
        ) : (
          !loading && <p className="p-4 text-sm text-slate-500">This item is not available.</p>
        )}
        {loading && (
          <div
            role="status"
            className="absolute inset-0 flex flex-col items-center justify-center gap-y-2 text-xs text-slate-500"
          >
            <LoaderCircle className="size-6 animate-spin text-slate-400" />
            Loading…
          </div>
        )}
      </div>
    </>
  );
}

export const plainClick = (e: React.MouseEvent) =>
  e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

/** The part of the window that the navbar, the sticky bars (`data-sticky-bar`) and the open
 * viewer do not cover. */
function openBand() {
  const sheet = document.querySelector<HTMLElement>('[data-viewer-sheet]');
  const bars = [...document.querySelectorAll('header, [data-sticky-bar]')].map((el) => el.getBoundingClientRect());
  return {
    top: Math.max(0, ...bars.filter((r) => r.height > 0).map((r) => r.bottom)),
    // The sheet's box moves while it slides in; its height does not.
    bottom: window.innerHeight - (sheet?.offsetHeight ?? 0),
  };
}

/** Scrolls `el` by the least amount into the part of the window that the navbar, its list's
 * sticky head and the viewer do not cover. Its list scrolls first; the page scrolls only for the
 * rest. Nothing moves if it is in view, or if it is in the viewer. */
export function showInView(el: HTMLElement) {
  if (el.closest('[data-viewer-sheet]')) return;
  const band = openBand();
  const r = el.getBoundingClientRect();
  let moved = 0;
  const list = scrollParent(el);
  if (list) {
    const box = list.getBoundingClientRect();
    const top = Math.max(box.top + (list.querySelector('thead')?.offsetHeight ?? 0), band.top);
    const bottom = Math.min(box.bottom, band.bottom);
    const want = r.top < top || bottom - top < r.height ? r.top - top : Math.max(0, r.bottom - bottom);
    moved = Math.min(Math.max(want, -list.scrollTop), list.scrollHeight - list.clientHeight - list.scrollTop);
    if (Math.abs(moved) <= 1) moved = 0;
    else list.scrollBy({ top: moved, behavior: 'smooth' });
  }
  const top = r.top - moved;
  const page = top < band.top ? top - band.top : Math.max(0, Math.min(r.bottom - moved - band.bottom, top - band.top));
  if (Math.abs(page) > 1) window.scrollBy({ top: page, behavior: 'smooth' });
}

function scrollParent(el: HTMLElement) {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if ((overflowY === 'auto' || overflowY === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

/**
 * A link that opens a run or attempt in the viewer. Its `href` is the run or attempt page, so a
 * click with a modifier key opens that in a new tab. `mark`: mark `anchor` (else the link) as
 * a cite in the viewer is marked.
 */
export function PanelLink({
  to,
  mark,
  anchor,
  onClick,
  ...rest
}: Omit<ComponentProps<'a'>, 'href'> & { to: Panel; mark?: boolean; anchor?: () => Element | null }) {
  const open = useRunViewer();
  return (
    <a
      href={panelPath(to)}
      data-viewer-open
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || !plainClick(e)) return;
        e.preventDefault();
        // The top loader would wait for a page load that does not come.
        e.nativeEvent.stopImmediatePropagation();
        open(to, mark ? (anchor?.() ?? e.currentTarget) : undefined);
      }}
      {...rest}
    />
  );
}

/** A link to a page. A run, attempt or sample page opens in the viewer, and the link is marked; other
 * pages (and all pages outside a viewer) are plain links. `anchor`: the element to mark, if not
 * the link. `snippet`: the flagged case, whose message the attempt shows in rose. */
export function RunLink({
  href,
  anchor,
  snippet,
  ...rest
}: Omit<ComponentProps<'a'>, 'href'> & { href: string; anchor?: () => Element | null; snippet?: string }) {
  const panel = useContext(PdfViewerContext) && panelFromPath(href);
  if (!panel) return <Link href={snippet ? `${href}?snippet=${snippet}` : href} {...rest} />;
  const to = isSamplePanel(panel) ? panel : { ...panel, snippet };
  return <PanelLink to={to} mark anchor={anchor} {...rest} />;
}

/** Shown while pdf.js loads, and by it while the document loads. */
export function PdfLoading({ progress }: { progress?: number }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div
      role="status"
      className="absolute inset-0 flex flex-col items-center justify-center gap-y-2 bg-slate-50 text-xs text-slate-500"
    >
      <LoaderCircle className="size-6 animate-spin text-slate-400" />
      Loading the PDF…{progress ? ` ${Math.round(progress * 100)}%` : ''}
      {slow && <span className="text-slate-400">Large files can take a while. You can also open it in a new tab.</span>}
    </div>
  );
}

const PdfJsView = dynamic(() => import('@/components/pdfjs-view'), {
  ssr: false,
  loading: () => (
    <div className="relative min-h-0 flex-1">
      <PdfLoading />
    </div>
  ),
});

const CITE_TITLE = 'Click to open page reference in source file.';

/**
 * A button that opens the viewer at a source page. With `children` (the text the source supports),
 * hovering or clicking the text works as the button too. `stretch` makes the button's click area
 * cover its nearest positioned parent. `label` makes it a pill button with that label. `anchor`:
 * the element to mark, if not the one clicked.
 */
export function PdfCite({
  target,
  children,
  className,
  stretch,
  label,
  anchor,
}: {
  target: PdfTarget;
  children?: ReactNode;
  className?: string;
  stretch?: boolean;
  label?: string;
  anchor?: () => Element | null;
}) {
  const open = usePdfViewer();
  // A stretched click area covers the positioned parent, so that parent is what the reader clicked.
  // Not `offsetParent`: in a table, that is the cell and not a positioned row.
  const mark = (el: HTMLElement) => {
    const a = anchor?.();
    if (a) return a;
    let p = stretch ? el.parentElement : null;
    while (p && getComputedStyle(p).position === 'static') p = p.parentElement;
    return p ?? el;
  };
  if (label)
    return (
      <button
        type="button"
        title={CITE_TITLE}
        aria-label={`Open ${place(target).long} in the source file`}
        data-viewer-open
        onClick={(e) => {
          e.stopPropagation();
          open(target, anchor?.() ?? e.currentTarget);
        }}
        className={cn(PILL_BUTTON, className)}
      >
        <SquareArrowRightEnter />
        {label}
      </button>
    );
  const button = (
    <button
      type="button"
      title={CITE_TITLE}
      aria-label={`Open ${place(target).long} in the source file`}
      data-viewer-open
      onClick={(e) => {
        e.stopPropagation();
        open(target, mark(e.currentTarget));
      }}
      className={cn(
        CITE_BADGE,
        'cursor-pointer text-sky-700 hover:bg-sky-100 hover:text-sky-800',
        'group-hover/cite:bg-sky-100 group-hover/cite:text-sky-800',
        stretch && 'after:absolute after:inset-0 after:rounded-md',
      )}
    >
      <SquareArrowRightEnter className="size-3.5" />
    </button>
  );
  if (!children) return button;
  return (
    // The button is the keyboard control; a click on the text is a shortcut for the mouse.
    <span
      title={CITE_TITLE}
      data-viewer-open
      onClick={(e) => open(target, mark(e.currentTarget))}
      className={cn(
        'group/cite -mx-1 -my-0.5 cursor-pointer rounded box-decoration-clone px-1 py-0.5 transition-colors hover:bg-sky-50 hover:text-sky-900',
        className,
      )}
    >
      {children} {button}
    </span>
  );
}
