'use client';

import { useSyncExternalStore } from 'react';

// The site assistant's shared state: on (the launcher is mounted) and open. The mobile tab bar
// reads it, so the navbar needs no prop for the assistant.

/** The panel's id, for `aria-controls` on its buttons. */
export const ASK_PANEL_ID = 'ask-openaudit';

type AskState = { on: boolean; open: boolean };

let state: AskState = { on: false, open: false };
const OFF: AskState = { on: false, open: false };
const listeners = new Set<() => void>();

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function setAsk(next: Partial<AskState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export const useAsk = () =>
  useSyncExternalStore(
    subscribe,
    () => state,
    () => OFF,
  );
