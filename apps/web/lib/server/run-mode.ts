import { PUBLIC_RUNS_ENABLED, RUNS_ENABLED, SIGN_IN_ENABLED } from '@/lib/env';
import { canSpend, type Viewer } from '@/lib/server/viewer';

/** `run`: on our key (moderators). `request`: free; an admin approves each run. */
export type RunMode = 'run' | 'request';

/** How this viewer starts runs, or null. A guest in `request` mode must sign in first. With
 * `PUBLIC_RUNS_ENABLED` off, only `canSpend` viewers get a mode. */
export function runMode(viewer: Viewer | null): RunMode | null {
  if (!RUNS_ENABLED || viewer?.banned) return null;
  if (canSpend(viewer)) return 'run';
  if (!PUBLIC_RUNS_ENABLED) return null;
  return SIGN_IN_ENABLED ? 'request' : null;
}
