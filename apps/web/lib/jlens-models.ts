'use client';

import { NEXT_PUBLIC_NEURONPEDIA_URL } from '@/lib/env';
import { jlensModelsFromGlobal, type JlensModel } from '@/lib/jlens';
import { useEffect, useState } from 'react';

// One fetch for each page load. Only the J-Lens models stay in memory; the full reply is large.
let models: Promise<JlensModel[] | null> | null = null;

/** Neuronpedia's J-Lens models, or null if `/api/global` fails. */
export function loadJlensModels(): Promise<JlensModel[] | null> {
  models ??= fetch(`${NEXT_PUBLIC_NEURONPEDIA_URL}/api/global`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`/api/global: ${r.status}`))))
    .then(jlensModelsFromGlobal)
    .catch(() => null);
  return models;
}

/** Clears the cache. For tests. */
export function resetJlensModels() {
  models = null;
}

/** Neuronpedia's J-Lens models: undefined while they load, null if they do not. With `load` false,
 * they do not load yet (undefined). */
export function useJlensModels(load = true): JlensModel[] | null | undefined {
  const [state, setState] = useState<JlensModel[] | null | undefined>(undefined);
  useEffect(() => {
    if (!load) return;
    let live = true;
    void loadJlensModels().then((m) => live && setState(m));
    return () => {
      live = false;
    };
  }, [load]);
  return state;
}
