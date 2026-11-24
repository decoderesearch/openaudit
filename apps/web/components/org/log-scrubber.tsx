'use client';

import { cn } from '@/lib/utils';
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';

/** A place on the page to jump to: the summary, or a log excerpt (`n`). */
export type ScrubItem = { id: string; label: string; n?: number };

/**
 * The contents of the log excerpts, with the item in view selected. From `md` up: a list at the left
 * that stays in view; a click or a drag on it scrolls through the excerpts. From `lg` up, its box
 * scrolls, and gives its height as `cqh`. Under `md`: a bar of numbers at the top that stays in
 * view, with the title of the item in view. Each item's element needs a `scroll-margin-top` for the
 * bars above it; the first one's is the line for "in view".
 */
export function LogScrubber({ items }: { items: ScrubItem[] }) {
  const [active, setActive] = useState(0);
  const hold = useRef<number | null>(null);
  const ids = items.map((i) => i.id).join(' ');

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (hold.current !== null) return;
      const els = ids.split(' ').map((id) => document.getElementById(id));
      const box = scroller(els[0]);
      const top = box === document.documentElement ? 0 : box.getBoundingClientRect().top;
      const line = top + (els[0] ? parseFloat(getComputedStyle(els[0]).scrollMarginTop) || 0 : 0) + 8;
      let k = 0;
      els.forEach((el, i) => {
        if (el && el.getBoundingClientRect().top <= line) k = i;
      });
      const end = box.scrollTop + box.clientHeight >= box.scrollHeight - 2;
      setActive(end && box.scrollTop > 0 ? els.length - 1 : k);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const release = () => {
      hold.current = null;
      onScroll();
    };
    update();
    // In the capture phase, to get the scroll of a box too: a scroll event does not bubble.
    const opts = { capture: true, passive: true };
    document.addEventListener('scroll', onScroll, opts);
    window.addEventListener('resize', onScroll);
    document.addEventListener('scrollend', release, opts);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('scroll', onScroll, opts);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('scrollend', release, opts);
    };
  }, [ids]);

  /** Scrolls smoothly to item `k`. While the scroll runs, the selection stays on `k`. */
  const go = useCallback(
    (k: number) => {
      const el = document.getElementById(items[k]?.id ?? '');
      if (!el) return;
      setActive(k);
      hold.current = k;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Without `scrollend`, or with no scroll at all.
      setTimeout(() => hold.current === k && (hold.current = null), 1000);
    },
    [items],
  );

  return (
    <>
      <Rail items={items} active={active} go={go} />
      <Bar items={items} active={active} go={go} />
    </>
  );
}

/** The box that scrolls `el`: its nearest ancestor that scrolls, else the page. */
function scroller(el: HTMLElement | null): HTMLElement {
  for (let p = el?.parentElement; p; p = p.parentElement)
    if (/auto|scroll/.test(getComputedStyle(p).overflowY) && p.scrollHeight > p.clientHeight) return p;
  return document.documentElement;
}

type View = { items: ScrubItem[]; active: number; go: (k: number) => void };

function Rail({ items, active, go }: View) {
  const box = useRef<HTMLDivElement>(null);
  // While a drag runs: the list's place on the screen when it started, and the rows' tops in the
  // list. The list moves when the page scrolls past the logs, so the drag uses these.
  const drag = useRef<{ top: number; bottom: number; rows: number[]; k: number } | null>(null);

  useEffect(() => keepInView(box.current, `[data-k="${active}"]`, 'y'), [active]);

  const start = (e: PointerEvent) => {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const rows = [...el.querySelectorAll<HTMLElement>('[data-k]')].map(
      (row) => row.getBoundingClientRect().top - r.top + el.scrollTop,
    );
    drag.current = { top: r.top, bottom: r.bottom, rows, k: -1 };
    pick(e);
  };

  /** The item under the pointer. At the top or bottom edge of a list that scrolls, the list moves. */
  const pick = (e: PointerEvent) => {
    const el = box.current;
    const d = drag.current;
    if (!el || !d) return;
    if (e.clientY > d.bottom - 16) el.scrollTop += 16;
    else if (e.clientY < d.top + 16) el.scrollTop -= 16;
    const y = e.clientY - d.top + el.scrollTop;
    let k = 0;
    for (const [i, top] of d.rows.entries()) if (top <= y) k = i;
    if (k !== d.k) {
      d.k = k;
      go(k);
    }
  };

  return (
    <nav
      aria-label="Log excerpts"
      className="sticky top-[calc(4rem+env(safe-area-inset-top))] flex max-h-[calc(100dvh-5rem-env(safe-area-inset-top))] flex-col self-start max-md:hidden lg:top-0 lg:max-h-[100cqh]"
    >
      <div
        ref={box}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          start(e);
        }}
        onPointerMove={(e) => drag.current && pick(e)}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        className="relative min-h-0 touch-none overflow-y-auto overscroll-contain select-none"
      >
        <ol className="flex flex-col">
          {items.map((item, k) => (
            <li key={item.id} className="relative">
              {item.n !== undefined && (
                // The line to the next number. The number's background hides it under the number.
                <span
                  aria-hidden
                  className={cn(
                    'absolute left-2.5 w-px',
                    items[k - 1]?.n === undefined ? 'top-2' : 'top-0',
                    k === items.length - 1 ? 'h-2' : 'bottom-0',
                    k < active ? 'bg-sky-200' : 'bg-slate-200',
                  )}
                />
              )}
              <button
                type="button"
                data-k={k}
                aria-current={k === active ? 'location' : undefined}
                // Pointer clicks move on pointer down; this is for the keyboard.
                onClick={(e) => e.detail === 0 && go(k)}
                className="group relative flex w-full cursor-pointer items-start gap-x-1.5 py-1 pr-1 text-left text-[11px]/4"
              >
                <span
                  className={cn(
                    'w-5 shrink-0 text-center tabular-nums',
                    item.n !== undefined && 'bg-background',
                    k === active ? 'text-sky-700' : 'text-slate-400',
                  )}
                >
                  {item.n}
                </span>
                <span
                  className={cn(
                    // The negative margin keeps the text in place under the padding.
                    '-mx-1 -my-0.5 line-clamp-2 rounded px-1 py-0.5',
                    k === active ? 'bg-sky-50 text-sky-900' : 'text-slate-500 group-hover:text-slate-800',
                  )}
                >
                  {item.label}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}

function Bar({ items, active, go }: View) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => keepInView(box.current, `[data-k="${active}"]`, 'x'), [active]);
  const item = items[active];
  return (
    <nav
      aria-label="Log excerpts"
      className="sticky top-[calc(3rem+env(safe-area-inset-top))] z-10 -mx-4 flex flex-col gap-y-1 border-b border-slate-200 bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 md:hidden"
    >
      <div ref={box} className="flex [scrollbar-width:none] gap-x-1.5 overflow-x-auto">
        {items.map((it, k) => (
          <button
            key={it.id}
            type="button"
            data-k={k}
            aria-current={k === active ? 'location' : undefined}
            aria-label={it.n !== undefined ? `${it.n}. ${it.label}` : it.label}
            onClick={() => go(k)}
            className={cn(
              'h-7 shrink-0 cursor-pointer rounded-full border px-2.5 text-xs tabular-nums',
              k === active ? 'border-sky-700 bg-sky-700 text-white' : 'border-slate-200 bg-white text-slate-600',
            )}
          >
            {it.n ?? it.label}
          </button>
        ))}
      </div>
      {item?.n !== undefined && (
        <p className="truncate text-[11px] text-slate-500">
          <span className="tabular-nums">{item.n}. </span>
          {item.label}
        </p>
      )}
    </nav>
  );
}

/** Scrolls `box` (not the page) so that its child that matches `selector` is in view. */
function keepInView(box: HTMLElement | null, selector: string, axis: 'x' | 'y') {
  const el = box?.querySelector<HTMLElement>(selector);
  if (!box || !el) return;
  const b = box.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  if (axis === 'y') {
    if (r.top < b.top) box.scrollTop -= b.top - r.top + 8;
    else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom + 8;
  } else if (r.left < b.left || r.right > b.right) {
    box.scrollLeft += r.left - b.left - (b.width - r.width) / 2;
  }
}
