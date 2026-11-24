'use client';

import { useRouter } from 'nextjs-toploader/app';
import type { ReactNode } from 'react';

/** A table row that opens `href` on a click. A link in it keeps its own click. For the keyboard, the
 * row must also have a link to `href`. */
export function LinkRow({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <tr
      className={className}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if ((e.target as Element).closest('a, button')) return;
        router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
