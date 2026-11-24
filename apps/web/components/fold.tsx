'use client';

import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';

/** The first height of a fold, in px. */
const HEIGHT = { sm: 256, md: 448, lg: 576 };

/** Send it to a fold's `[data-fold]` box to show all of it at once (for example, from a tour). */
export const FOLD_OPEN = 'fold-open';

/**
 * Under `lg`: `children` show to a `size` height, then fade, with a `more` button that shows about
 * two screens more. The page scrolls, not a box. From `lg` up, no change: `children` are as if not
 * in a fold. Use it in place of a box that scrolls in itself only on a narrow screen.
 */
export function Fold({
  children,
  more = 'Show more',
  size = 'md',
  className,
}: {
  children: ReactNode;
  more?: string;
  size?: keyof typeof HEIGHT;
  className?: string;
}) {
  const [height, setHeight] = useState(HEIGHT[size]);
  const [over, setOver] = useState(false);
  const clip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = clip.current;
    if (!el) return;
    const check = () => setOver(el.scrollHeight > el.clientHeight + 1);
    check();
    if (typeof ResizeObserver === 'undefined') return;
    const seen = new ResizeObserver(check);
    seen.observe(el);
    for (const child of el.children) seen.observe(child);
    return () => seen.disconnect();
  }, [height]);
  useEffect(() => {
    const el = clip.current;
    // Sync, so that the sender can measure the open fold at once.
    const open = () => flushSync(() => setHeight(el?.scrollHeight ?? Infinity));
    el?.addEventListener(FOLD_OPEN, open);
    return () => el?.removeEventListener(FOLD_OPEN, open);
  }, []);
  return (
    <div className={cn('flex flex-col lg:contents', className)}>
      {/* With `display: contents` from `lg` up, the max height has no effect. `overflow: clip`:
          scripts (like `scrollIntoView`) cannot scroll the box, as users cannot. */}
      <div
        ref={clip}
        data-fold
        style={{ maxHeight: over || height === HEIGHT[size] ? height : undefined }}
        className="relative max-lg:overflow-clip lg:contents"
      >
        {children}
        {over && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-background lg:hidden"
          />
        )}
      </div>
      {over && (
        <button
          type="button"
          onClick={() => setHeight((h) => h + Math.max(HEIGHT[size], 2 * window.innerHeight))}
          className="mx-auto mt-1 inline-flex h-9 cursor-pointer items-center gap-x-1 rounded-full px-4 text-xs font-semibold text-sky-800 hover:bg-sky-50 lg:hidden"
        >
          {more}
          <ChevronDown aria-hidden className="size-3.5" />
        </button>
      )}
    </div>
  );
}
