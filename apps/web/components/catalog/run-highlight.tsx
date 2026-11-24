'use client';

import { useEffect } from 'react';

/** Marks the result rows whose `data-run` is the URL fragment, and scrolls the first into view. */
export function RunHighlight() {
  useEffect(() => {
    const mark = () => {
      const run = decodeURIComponent(window.location.hash.slice(1));
      const rows = [...document.querySelectorAll<HTMLElement>('[data-run]')];
      for (const r of rows) r.toggleAttribute('data-active', !!run && r.dataset.run === run);
      rows.find((r) => r.hasAttribute('data-active'))?.scrollIntoView({ block: 'center' });
    };
    mark();
    window.addEventListener('hashchange', mark);
    return () => window.removeEventListener('hashchange', mark);
  }, []);
  return null;
}
