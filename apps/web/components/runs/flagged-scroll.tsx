'use client';

import { keepCentered } from '@/lib/snippet-focus';
import { useEffect } from 'react';

/** Room for the navbar and the breadcrumbs above a page's content. */
const BARS = 96;

/** Centers the message with `data-flagged={id}` in its scroll box (the side panel, else the page). */
export function FlaggedScroll({ id }: { id: string }) {
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-flagged="${CSS.escape(id)}"]`);
    if (el) return keepCentered(el, { top: BARS });
  }, [id]);
  return null;
}
