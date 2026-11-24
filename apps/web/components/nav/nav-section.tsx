'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';

type PageSection = { path: string; href: string };

let current: PageSection | null = null;
const listeners = new Set<() => void>();

function publish(next: PageSection | null) {
  current = next;
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Puts the page in Safety Methods or Models in the mobile dock. Use it where the path does not
 * tell: an eval, its runs and its samples are in the section of what the eval scores. */
export function NavSection({ method }: { method: boolean }) {
  const pathname = usePathname();
  const href = method ? '/methods' : '/models';
  useEffect(() => {
    const mine = { path: pathname, href };
    publish(mine);
    return () => {
      if (current === mine) publish(null);
    };
  }, [pathname, href]);
  return null;
}

/** The section that the page at `pathname` set, if it set one. */
export function usePageSection(pathname: string) {
  const s = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
  return s?.path === pathname ? s.href : null;
}
