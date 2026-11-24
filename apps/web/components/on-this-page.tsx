'use client';

import { cn } from '@/lib/utils';
import { ArrowUp } from 'lucide-react';
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';

export type NavPart = { id: string; title: string; items?: { id: string; title: string }[] };

/** The space under the navbar and the breadcrumbs, as `lg:scroll-mt-24` in `ANCHOR`. */
const TOP = 96;
/** After a link to a part, the mark stays until the scroll stops for this time. */
const SETTLE_MS = 150;

/** The part on screen: the last one whose top is above the line under the navbar. At the end of a
 * scrolled page, the last part. A link to a part marks it until the next scroll. `select`: mark a
 * part from a link. */
function useActive(ids: string[]): { active?: string; select: (id: string) => void } {
  const [active, setActive] = useState<string>();
  const select = useRef<(id: string) => void>(() => {});
  useEffect(() => {
    let frame = 0;
    // True from a link to a part until its scroll stops.
    let holding = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const hold = () => {
      holding = true;
      clearTimeout(timer);
      timer = setTimeout(() => (holding = false), SETTLE_MS);
    };
    const update = () => {
      frame = 0;
      const atEnd =
        window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      let found = ids[0];
      for (const id of ids) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= TOP + 16) found = id;
      }
      setActive(atEnd ? ids.at(-1) : found);
    };
    const onScroll = () => {
      if (holding) hold();
      else if (!frame) frame = requestAnimationFrame(update);
    };
    const mark = (id: string) => {
      if (!ids.includes(id)) return;
      hold();
      setActive(id);
    };
    const onHash = () => mark(decodeURIComponent(window.location.hash.slice(1)));
    select.current = mark;
    update();
    onHash();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('hashchange', onHash);
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [ids]);
  return { active, select: (id) => select.current(id) };
}

/** Scroll to the element with an animation, and put its id in the URL. A click with a modifier key
 * keeps the default. `select`: called before the scroll. */
export function scrollToPart(e: MouseEvent<HTMLAnchorElement>, id: string, select?: (id: string) => void) {
  const el = document.getElementById(id);
  if (!el || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  history.pushState(null, '', `#${id}`);
  select?.(id);
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

const LINK = 'block rounded px-2 py-1 transition-colors hover:bg-slate-50 hover:text-slate-800';
const ACTIVE = 'bg-slate-100 text-sky-800 hover:bg-slate-100';

/** The tree of a page's parts, with the part on screen marked. */
export function OnThisPage({ parts }: { parts: NavPart[] }) {
  const [ids] = useState(() => parts.flatMap((p) => [p.id, ...(p.items ?? []).map((i) => i.id)]));
  const { active, select } = useActive(ids);
  return (
    <nav aria-label="On this page" className="text-[13px]">
      <ol className="flex flex-col gap-y-0.5">
        {parts.map((p) => (
          <li key={p.id}>
            <a
              href={`#${p.id}`}
              onClick={(e) => scrollToPart(e, p.id, select)}
              aria-current={active === p.id ? 'location' : undefined}
              className={cn(LINK, active === p.id ? ACTIVE : 'text-slate-600')}
            >
              {p.title}
            </a>
            {p.items && (
              <ul className="my-0.5 ml-4 flex flex-col border-l border-slate-200 pl-2">
                {p.items.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      onClick={(e) => scrollToPart(e, item.id, select)}
                      aria-current={active === item.id ? 'location' : undefined}
                      className={cn(LINK, active === item.id ? ACTIVE : 'text-slate-500')}
                    >
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** `OnThisPage` in a box, for the top of a `NavPanel`'s content under `lg`, where the sidebar does
 * not show. */
export function MobileOnThisPage({ parts, className }: { parts: NavPart[]; className?: string }) {
  return (
    <div className={cn('max-w-3xl rounded-lg border border-slate-200 bg-slate-50 p-3 lg:hidden', className)}>
      <p className="mb-1 px-2 text-center text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
        Table of Contents
      </p>
      <OnThisPage parts={parts} />
    </div>
  );
}

/** Scroll to the top of the page with an animation, and take the part's id out of the URL. A click
 * with a modifier key keeps the default. */
function scrollToTop(e: MouseEvent<HTMLAnchorElement>) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  history.pushState(null, '', window.location.pathname + window.location.search);
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
}

/** A page title's text, as a link to the top of the page (see `scrollToTop`). */
export function TopLink({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <a href="#" onClick={scrollToTop} className={cn('cursor-pointer', className)}>
      {children}
    </a>
  );
}

/** A "Back to top" link (see `scrollToTop`). */
export function BackToTop({ className }: { className?: string }) {
  return (
    <a
      href="#"
      onClick={scrollToTop}
      className={cn(
        'inline-flex shrink-0 items-center gap-x-1 text-xs font-medium whitespace-nowrap text-slate-400 transition-colors hover:text-sky-700',
        className,
      )}
    >
      <ArrowUp aria-hidden className="size-3.5" />
      Back to top
    </a>
  );
}

/** A white panel that fills the page, with `OnThisPage` at the left from `lg` up. The sidebar
 * stays on screen as the page scrolls. */
export function NavPanel({ parts, children }: { parts: NavPart[]; children: ReactNode }) {
  return (
    <div className="flex flex-1 rounded-lg border border-slate-200 bg-white">
      <aside className="hidden w-72 shrink-0 border-r border-slate-200 px-4 pt-6 pb-3 lg:block">
        <div className="sticky top-24">
          <OnThisPage parts={parts} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

/** A title that links to its own anchor, so a right click can copy the link. */
export function AnchorTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <a href={`#${id}`} className="group/anchor hover:underline">
      {children}
      <span aria-hidden className="ml-1.5 text-slate-300 opacity-0 group-hover/anchor:opacity-100">
        #
      </span>
    </a>
  );
}
