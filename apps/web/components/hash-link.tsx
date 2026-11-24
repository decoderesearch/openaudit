'use client';

import type { ReactNode } from 'react';

/** A link to an element on this page that scrolls to it smoothly. */
export function HashLink({ hash, className, children }: { hash: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={`#${hash}`}
      className={className}
      onClick={(e) => {
        const el = document.getElementById(hash);
        if (!el) return;
        e.preventDefault();
        history.pushState(null, '', `#${hash}`);
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }}
    >
      {children}
    </a>
  );
}
