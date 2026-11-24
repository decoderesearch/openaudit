'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NOTICE_EVENT as EVENT, NOTICE_KEY } from '@/lib/first-visit';
import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** A modal on the visitor's first visit. Only "I Understand" closes it; after that, it does not show
 * again in this browser. */
export function FirstVisitNotice() {
  const seen = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(NOTICE_KEY) !== null,
    () => true,
  );
  const accept = () => {
    localStorage.setItem(NOTICE_KEY, '1');
    window.dispatchEvent(new Event(EVENT));
  };
  return (
    <Dialog open={!seen}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="gap-5 rounded-2xl sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="text-base sm:text-center">Before Proceeding</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed font-medium text-slate-600">
            AI evaluation is an immature field, incapable of providing the kinds of safety assurance expected in other
            safety-critical industries such as aviation. None of our findings should be understood to bound risks or
            verify safety properties of any AI system.
          </DialogDescription>
        </DialogHeader>
        <button
          type="button"
          onClick={accept}
          className="h-10 w-full cursor-pointer rounded-full bg-sky-800 px-6 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
        >
          I Understand
        </button>
      </DialogContent>
    </Dialog>
  );
}
