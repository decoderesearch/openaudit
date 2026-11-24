'use client';

import { AskPanel } from '@/components/ask/ask-panel';
import { ASK_PANEL_ID, setAsk, useAsk } from '@/components/ask/ask-store';
import { HelpButtons } from '@/components/hero-buttons';
import { X } from 'lucide-react';
import { useEffect } from 'react';

// The site assistant panel. Its entry points are the navbar's help menu on large screens and the
// tab bar's Help tab (`MobileNav`) on small ones, where it also shows the help menu's buttons. It
// starts closed.

export function AskLauncher() {
  const { open } = useAsk();
  useEffect(() => {
    setAsk({ on: true });
    return () => setAsk({ on: false, open: false });
  }, []);
  const close = () => setAsk({ open: false });
  // Hidden, not unmounted, when closed: the thread stays across pages.
  return (
    <AskPanel
      id={ASK_PANEL_ID}
      open={open}
      onClose={close}
      head={
        <div className="shrink-0 bg-sky-800 px-3 pt-2 pb-3 lg:hidden">
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={close}
              className="flex items-center gap-x-1 rounded-full px-2.5 py-1 text-xs font-semibold text-sky-100 transition-colors hover:bg-sky-700 hover:text-white"
            >
              <X aria-hidden className="size-3.5" />
              Close Help
            </button>
          </div>
          <HelpButtons onPick={close} slot="h-8 text-xs" />
        </div>
      }
    />
  );
}
