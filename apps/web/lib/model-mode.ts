/** What the model page shows. OpenAudit also shows system card data. `?tab=` sets it. */
export const MODEL_MODES = ['openaudit', 'system-card'] as const;
export type ModelMode = (typeof MODEL_MODES)[number];

/** The mode from `?tab=`. Any other value is `openaudit`. */
export function modelMode(tab: string | string[] | undefined): ModelMode {
  return tab === 'system-card' ? tab : 'openaudit';
}

/** The model page path in a mode. `openaudit` has no `?tab=`. */
export function modelModePath(path: string, mode: ModelMode) {
  return mode === 'openaudit' ? path : `${path}?tab=${mode}`;
}

/** True when a page path is a model page in System Card mode. */
export const isSystemCardPath = (path: string) => /[?&]tab=system-card(&|$)/.test(path);
