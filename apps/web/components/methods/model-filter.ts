'use client';

import { replaceUrlParam } from '@/lib/url-param';
import { useSearchParams } from 'next/navigation';

const PARAM = 'model';

/** The model that a methods eval page filters its samples by (`?model=`, a model name), and a
 * function that sets it. Null: all models. */
export function useModelFilter(): [string | null, (name: string | null) => void] {
  const model = useSearchParams()?.get(PARAM) ?? null;
  return [model, (name) => replaceUrlParam(PARAM, name ?? undefined)];
}
