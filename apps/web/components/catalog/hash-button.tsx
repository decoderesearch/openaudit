'use client';

import { Button } from '@/components/ui/button';
import type { ReactNode } from 'react';

/** A button that sets the URL fragment to `hash`, and opens the `HashMenu` with that anchor, also
 * when the fragment is already `hash`. */
export function HashButton({ hash, className, children }: { hash: string; className?: string; children: ReactNode }) {
  return (
    <Button
      size="sm"
      className={className}
      onClick={() => {
        history.pushState(null, '', `#${hash}`);
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      }}
    >
      {children}
    </Button>
  );
}
