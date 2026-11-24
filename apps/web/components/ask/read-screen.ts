import { readablePage } from '@/lib/ask/pages';

// What the reader sees, for the site assistant: the page title, the heading in view, and the
// visible text of `<main>`, with links as [text](/path). Eval content is left out: pages in
// `NO_TEXT` send no text, and elements with `data-ask-skip` are skipped.

/** Most characters of page text. The server cuts at the same length. */
const MAX_CHARS = 16_000;
/** The navbar and the breadcrumbs: a heading above this line has scrolled past. */
const TOP = 160;

const SKIP = 'script, style, noscript, nav, [data-ask-skip], [aria-hidden="true"], [role="dialog"]';
const BLOCK = 'p, li, tr, h1, h2, h3, h4, h5, h6, div, section, dt, dd, pre, blockquote, figcaption, summary';
const CELL = 'td, th';

const headingText = (h: Element) => (h.textContent ?? '').replace(/\s+/g, ' ').replace(/#$/, '').trim();

/** The heading of the part of the page in view, with its anchor. */
function sectionInView(main: Element): string | undefined {
  const headings = [...main.querySelectorAll('h1, h2, h3, h4')].filter((h) => h.getClientRects().length > 0);
  const above = headings.filter((h) => h.getBoundingClientRect().top <= TOP);
  const h = above.at(-1) ?? headings[0];
  if (!h) return undefined;
  const id = h.id || h.closest('[id]')?.id;
  return id ? `${headingText(h)} (#${id})` : headingText(h);
}

export function readScreen(path: string): { title: string; section?: string; text?: string } {
  const main = document.querySelector('main');
  const title = document.title;
  if (!main) return { title };
  const section = sectionInView(main);
  if (!readablePage(path)) return { title, section };

  let text = '';
  let block: Element | null = null;
  let link: HTMLAnchorElement | null = null;
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node && text.length < MAX_CHARS; node = walker.nextNode()) {
    const el = node.parentElement;
    const words = node.textContent?.replace(/\s+/g, ' ');
    if (!el || !words?.trim() || el.closest(SKIP) || !el.checkVisibility()) continue;
    const a = el.closest<HTMLAnchorElement>('a[href^="/"]');
    if (a !== link && link) text += `](${link.getAttribute('href')})`;
    const b = el.closest(`${BLOCK}, ${CELL}`);
    if (b !== block) {
      const cell = b?.matches(CELL) && block?.matches(CELL) && b.parentElement === block.parentElement;
      text = text.trimEnd() + (cell ? ' | ' : '\n');
      const level = b?.matches('h1, h2, h3, h4') ? Number(b.tagName[1]) : 0;
      if (level) text += `${'#'.repeat(level)} `;
      block = b;
    }
    if (a !== link && a) text += '[';
    link = a;
    text += words;
  }
  if (link) text += `](${link.getAttribute('href')})`;
  return {
    title,
    section,
    text: text
      .replace(/\n{2,}/g, '\n')
      .trim()
      .slice(0, MAX_CHARS),
  };
}
