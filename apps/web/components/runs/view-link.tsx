import Link from '@/components/link';
import { PanelLink } from '@/components/pdf-viewer';
import { panelPath, type Panel } from '@/lib/run-panel';
import type { ComponentProps } from 'react';

/** Where a run, attempt or sample view shows: its own page, or the side panel. */
export type ViewMode = 'page' | 'panel';

/** A link from a view to a run, attempt or sample. On a page it goes to that page (with `hash`);
 * in the panel it changes the panel. */
export function ViewLink({
  to,
  mode,
  hash = '',
  ...rest
}: Omit<ComponentProps<'a'>, 'href'> & { to: Panel; mode: ViewMode; hash?: string }) {
  return mode === 'panel' ? <PanelLink to={to} {...rest} /> : <Link href={panelPath(to) + hash} {...rest} />;
}
