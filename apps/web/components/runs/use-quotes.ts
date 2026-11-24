'use client';

import { quoteItems, type StartRunInput } from '@/app/runs/actions';
import { requestKey } from '@/lib/runs/batch';
import type { ItemQuote } from '@/lib/server/run-quotes';
import { useEffect, useState } from 'react';

/** Costs, times and busy states for run requests, by `requestKey`. Empty until they come. */
export function useQuotes(inputs: StartRunInput[], active = true): Map<string, ItemQuote> {
  const keys = inputs.map(requestKey).join('\n');
  const [quotes, setQuotes] = useState<{ keys: string; byKey: Map<string, ItemQuote> } | null>(null);

  useEffect(() => {
    if (!active || !keys) return;
    let live = true;
    const list = keys.split('\n');
    const id = setTimeout(() => {
      const sent = list.map((k) => inputs.find((i) => requestKey(i) === k)!);
      quoteItems(sent)
        .catch(() => sent.map((): ItemQuote => ({ ok: false, error: 'We could not get an estimate.' })))
        .then((q) => live && setQuotes({ keys, byKey: new Map(list.map((k, i) => [k, q[i]])) }));
    }, 300);
    return () => {
      live = false;
      clearTimeout(id);
    };
    // `keys` holds all that the request needs from `inputs`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, active]);

  return quotes?.keys === keys ? quotes.byKey : new Map();
}
