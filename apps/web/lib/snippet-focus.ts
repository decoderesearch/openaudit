import type { SnippetExcerpt } from '@/lib/openaudit-card';

/** The assistant message that holds the quote, else the last assistant message of the excerpt. */
export function focusIndex(excerpt: SnippetExcerpt): number | undefined {
  const squash = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const quote = excerpt.quote ? squash(excerpt.quote) : undefined;
  const replies = excerpt.messages.filter((m) => m.role === 'assistant');
  return (
    (quote ? replies.find((m) => squash(m.text).includes(quote))?.index : undefined) ??
    replies.at(-1)?.index ??
    excerpt.messages.at(-1)?.index
  );
}

/** The nearest `[data-scroll]` that scrolls now: a box can scroll only on wide screens. */
const scrollBox = (el: HTMLElement) => {
  const box = el.parentElement?.closest<HTMLElement>('[data-scroll]');
  return box && getComputedStyle(box).overflowY !== 'visible' ? box : undefined;
};

/** The least space above a centered message, so that some of the chat before it shows. */
const CONTEXT = 100;

/** Scrolls `el` (a chat message) to the middle of its scroll box: the nearest `[data-scroll]`, else
 * the window. A message taller than the box starts `CONTEXT` below its top. `top`: room for fixed
 * bars. The box's content gets bottom padding, so that a message near the end can come to the middle
 * too. */
export function centerMessage(el: HTMLElement, { top = 8 } = {}) {
  const box = scrollBox(el);
  const height = box ? box.clientHeight : window.innerHeight - top;
  const margin = Math.max(CONTEXT, (height - el.offsetHeight) / 2) + (box ? 0 : top);
  let content: HTMLElement | null = el;
  while (box && content && content.parentElement !== box) content = content.parentElement;
  if (content && content !== el) {
    content.style.removeProperty('padding-bottom');
    const pad = parseFloat(getComputedStyle(content).paddingBottom) || 0;
    if (pad < margin) content.style.paddingBottom = `${margin}px`;
  }
  const offset = el.getBoundingClientRect().top - (box ? box.getBoundingClientRect().top : 0) - margin;
  if (box) box.scrollTop += offset;
  else window.scrollTo({ top: window.scrollY + offset });
}

/** Scrolls `el` so that its top is `at` (a part of the height) down its scroll box, if the page
 * can scroll that far. `top`: room for fixed bars. */
export function placeMessage(el: HTMLElement, { top = 8, at = 0.25 } = {}) {
  const box = scrollBox(el);
  const height = box ? box.clientHeight : window.innerHeight - top;
  const margin = height * at + (box ? 0 : top);
  const offset = el.getBoundingClientRect().top - (box ? box.getBoundingClientRect().top : 0) - margin;
  if (box) box.scrollTop += offset;
  else window.scrollTo({ top: window.scrollY + offset });
}

/** Centers `el` now, and again when its scroll box changes size (for example a card that gets its
 * height cap late), until the reader scrolls. Returns a function that stops it. */
export function keepCentered(el: HTMLElement, opts?: { top?: number }): () => void {
  const box = scrollBox(el);
  if (!box || typeof ResizeObserver === 'undefined') {
    centerMessage(el, opts);
    return () => {};
  }
  const sizes = new ResizeObserver(() => centerMessage(el, opts));
  const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
  const stop = () => {
    sizes.disconnect();
    for (const e of events) box.removeEventListener(e, stop);
  };
  for (const e of events) box.addEventListener(e, stop, { passive: true });
  sizes.observe(box);
  return stop;
}
