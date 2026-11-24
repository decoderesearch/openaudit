import { useEffect, useState, type RefObject } from 'react';

/**
 * The first `step` of `items`, and `step` more each time `end` comes near the bottom of `root` (or
 * of the screen, when `root` does not scroll). All items are loaded: only the rows wait. When
 * `items` changes (a new sort or search), it starts again from `step`.
 */
export function useReveal<T>(
  items: T[],
  step: number,
  root: RefObject<HTMLElement | null>,
  end: RefObject<HTMLElement | null>,
) {
  const [count, setCount] = useState(step);
  const [from, setFrom] = useState(items);
  if (items !== from) {
    setFrom(items);
    setCount(step);
  }
  const more = count < items.length;
  useEffect(() => {
    if (!more || !end.current) return;
    const r = root.current;
    const observer = new IntersectionObserver((seen) => seen.some((s) => s.isIntersecting) && setCount(count + step), {
      root: r && r.scrollHeight > r.clientHeight ? r : null,
      rootMargin: '0px 0px 600px 0px',
    });
    observer.observe(end.current);
    return () => observer.disconnect();
  }, [more, count, step, root, end]);
  return { shown: more ? items.slice(0, count) : items, more };
}
