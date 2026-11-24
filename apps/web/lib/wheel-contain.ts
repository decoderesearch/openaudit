import { useEffect, type RefObject } from 'react';

/** True if `n` can scroll further in the wheel's direction. */
export function canScroll(n: HTMLElement, y: boolean, delta: number) {
  const overflow = getComputedStyle(n)[y ? 'overflowY' : 'overflowX'];
  if (overflow !== 'auto' && overflow !== 'scroll') return false;
  const [pos, size, view] = y
    ? [n.scrollTop, n.scrollHeight, n.clientHeight]
    : [n.scrollLeft, n.scrollWidth, n.clientWidth];
  return delta < 0 ? pos > 0 : pos + view < size - 1;
}

/** The boxes that keep their wheel: a page's own wheel handlers do not use a wheel in them. */
export const OWN_WHEEL = '[role="dialog"], [data-radix-popper-content-wrapper], [data-wheel-contain]';

/**
 * A wheel in `ref` never scrolls the page behind it, while `on`. `overscroll-contain` does not do
 * this when no box under the pointer can scroll, for example on a header or a short list.
 */
export function useWheelContain(ref: RefObject<HTMLElement | null>, on: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!on || !el) return;
    el.setAttribute('data-wheel-contain', '');
    const onWheel = (e: WheelEvent) => {
      const y = Math.abs(e.deltaY) >= Math.abs(e.deltaX);
      const delta = y ? e.deltaY : e.deltaX;
      for (let n = e.target as HTMLElement | null; n && el.contains(n); n = n.parentElement) {
        if (canScroll(n, y, delta)) return;
      }
      e.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeAttribute('data-wheel-contain');
    };
  }, [ref, on]);
}
