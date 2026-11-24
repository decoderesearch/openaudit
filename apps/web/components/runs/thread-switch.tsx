'use client';

import { messageAnchor, parseMessageAnchor, type ThreadSide as Side } from '@/lib/runs/message-link';
import { placeMessage } from '@/lib/snippet-focus';
import { cn } from '@/lib/utils';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/** Room for the navbar and the breadcrumbs above a page's content. */
const BARS = 84;
const SIDES: { value: Side; label: string }[] = [
  { value: 'target', label: 'Eval Chat' },
  { value: 'auditor', label: 'Auditor Side' },
];

const SideContext = createContext<[Side, (side: Side) => void]>(['target', () => {}]);

/** Shows one side of an audit: the eval chat (the target's thread) or the auditor's thread. */
export function ThreadSwitch({ children }: { children: ReactNode }) {
  const state = useState<Side>('target');
  return <SideContext.Provider value={state}>{children}</SideContext.Provider>;
}

/** The control that picks the side. */
export function ThreadSwitchControl() {
  const [side, setSide] = useContext(SideContext);
  return (
    <div
      role="group"
      aria-label="Transcript side"
      className="inline-flex rounded-full border border-slate-300 bg-white p-0.5 text-[11px] font-medium whitespace-nowrap"
    >
      {SIDES.map((s) => (
        <button
          key={s.value}
          type="button"
          aria-pressed={side === s.value}
          onClick={() => setSide(s.value)}
          className={cn(
            'cursor-pointer rounded-full px-2.5 py-0.5 transition-colors',
            side === s.value ? 'bg-sky-800 text-white' : 'text-slate-600 hover:text-slate-900',
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

/** For a URL hash that names a message: shows its side, marks it with a border, and scrolls it a
 * quarter of the way down the screen, so that some of the message before it shows. */
export function LinkedMessage() {
  const [side, setSide] = useContext(SideContext);
  const [linked, setLinked] = useState<{ side: Side; index: number }>();
  const placed = useRef<object>(undefined);
  useEffect(() => {
    const read = () => {
      const found = parseMessageAnchor(window.location.hash);
      setLinked(found);
      if (found) setSide(found.side);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, [setSide]);
  useEffect(() => {
    if (!linked) return;
    const el = document.querySelector<HTMLElement>(
      `[data-anchor="${CSS.escape(messageAnchor(linked.side, linked.index))}"]`,
    );
    if (!el) return;
    el.dataset.linked = '';
    if (side === linked.side && placed.current !== linked) {
      placed.current = linked;
      requestAnimationFrame(() => placeMessage(el, { top: BARS }));
    }
    return () => void delete el.dataset.linked;
  }, [linked, side]);
  return null;
}

/** The content of one side. It stays in the page while hidden. */
export function ThreadPanel({ side, children }: { side: Side; children: ReactNode }) {
  const [shown] = useContext(SideContext);
  return <div hidden={shown !== side}>{children}</div>;
}
