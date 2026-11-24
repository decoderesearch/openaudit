import type { WsbSettings } from './wsb-readout';

/** A model that the eval uses besides the tested one, as the run set it. */
export type AttemptRole = {
  id: string;
  label?: string;
  role?: string;
  scoring?: boolean;
  model: string;
  fallbacks?: string[];
};

/**
 * The run's settings, as each attempt keeps them (`eval_attempt.settings`; the runner's
 * `attempt_settings.py` writes them). `sample`: the sample's own settings, from its log.
 */
export type AttemptSettings = {
  runId: string;
  eval: { slug: string; name: string; version: string };
  model: { name: string; route?: Record<string, unknown> };
  origin?: string;
  sourceRunId?: string;
  roles?: AttemptRole[];
  generation?: Record<string, unknown>;
  task?: string;
  harness?: { tool?: string; version?: string };
  metrics?: Record<string, unknown>[];
  sample?: WsbSettings;
};
