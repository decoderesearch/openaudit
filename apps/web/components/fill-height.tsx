'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Sets `--fill-h` on its box: the height that lets the page (footer too) fit the window with no
 * scroll, and at least 24rem. The box's classes use it, for example at a breakpoint. It changes
 * when the window resizes or a `details` element above opens or closes. */
export function FillHeight({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => {
      // First fill to the window bottom, so that all content below overflows; then remove it.
      const top = el.getBoundingClientRect().top + window.scrollY;
      const full = window.innerHeight - top;
      el.style.setProperty('--fill-h', `${full}px`);
      // The open viewer's scroll room is not page content.
      let below = document.documentElement.scrollHeight - window.innerHeight;
      for (const room of document.querySelectorAll('[data-scroll-room]')) below -= room.getBoundingClientRect().height;
      el.style.setProperty('--fill-h', `${Math.max(full - below, 384)}px`);
    };
    set();
    window.addEventListener('resize', set);
    // `toggle` does not bubble.
    document.addEventListener('toggle', set, true);
    return () => {
      window.removeEventListener('resize', set);
      document.removeEventListener('toggle', set, true);
    };
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
