'use client';

import { cn } from '@/lib/utils';
import { useSyncExternalStore } from 'react';

// Whether the reader has started the Full or the Short Tutorial. Until then, red dots mark the
// buttons that lead to them: Get Started, the navbar's help button and the mobile Help tab.

const SEEN = 'oa-get-started-seen';
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  window.addEventListener('storage', l);
  return () => {
    listeners.delete(l);
    window.removeEventListener('storage', l);
  };
};

export function markTutorialSeen() {
  localStorage.setItem(SEEN, '1');
  listeners.forEach((l) => l());
}

/** True after the reader starts the Full or the Short Tutorial. True on the server. */
export const useTutorialSeen = () =>
  useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(SEEN) === '1',
    () => true,
  );

/** A red dot that sends out waves, until the reader starts a tutorial. Its parent must be
 * `relative`. `className`: its place and size. */
export function NewDot({ className }: { className?: string }) {
  const seen = useTutorialSeen();
  if (seen) return null;
  return (
    <span role="img" aria-label="New" className={cn('pointer-events-none absolute', className)}>
      <span className="absolute inset-0 animate-ping rounded-full bg-red-500" />
      <span className="absolute inset-0 rounded-full bg-red-500" />
    </span>
  );
}
