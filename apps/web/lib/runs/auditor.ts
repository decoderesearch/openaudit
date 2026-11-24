import { lab, modelId, roleModels } from '@/lib/model-ladders';
import type { ModelSlot } from '@openaudit/spec';

// The auditor rule: an auditor is never the target model, and a Claude target gets an auditor
// from another family. The runner has the same rule (apps/runner/openaudit_runner/auditor.py).

/** Auditors to use in place of a default that breaks the rule, in order (spec/model-ladders.yaml). */
export const OTHER_AUDITORS: string[] = roleModels('auditor');

/** Why `auditor` cannot audit `target`, or null. */
export function auditorProblem(target: string, auditor: string): string | null {
  if (modelId(auditor) === modelId(target)) return `The auditor ${auditor} is the target model.`;
  if (lab(target) === 'anthropic' && lab(auditor) === 'anthropic')
    return `The target ${target} is a Claude model, so the auditor must not be ${auditor}.`;
  return null;
}

/**
 * Each slot's model, with an auditor that breaks the rule replaced by one from `OTHER_AUDITORS`.
 * A string is an error: a chosen auditor (in `chosen`) breaks the rule.
 */
export function checkAuditors(
  slots: ModelSlot[],
  models: Record<string, string>,
  target: string,
  chosen: Record<string, string>,
): Record<string, string> | string {
  const out = { ...models };
  for (const s of slots) {
    if (s.role !== 'auditor' || !out[s.id]) continue;
    const problem = auditorProblem(target, out[s.id]);
    if (!problem) continue;
    if (chosen[s.id]) return problem;
    const other = OTHER_AUDITORS.find((m) => !auditorProblem(target, m));
    if (!other) return `${problem} No other auditor is set.`;
    out[s.id] = other;
  }
  return out;
}
