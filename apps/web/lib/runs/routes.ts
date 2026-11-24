import { goodEnough, LADDERS, slotModels } from '@/lib/model-ladders';
import type { EvalRunner, FallbackUse, ModelRole, ModelSlot, ServingRoute } from '@openaudit/spec';
import judges from './judges.json';
import { PICKABLE_SLOT_MODELS } from './requests';
import { pinsMatch } from './runner-pins';

// Which evals the runner (apps/runner) can run, and the models of their slots.
// model-routes.ts finds the route of a target model.

/** OpenRouter models we know for slots (a judge or the other side). A slot's default is one. */
export const JUDGES: string[] = judges;

/** A model that a run can use in this slot: the slot's default, a model of its tier or a higher
 *  tier, or a cheap pickable model. */
export const slotAllows = (slot: ModelSlot, model: string) =>
  model === slot.default ||
  PICKABLE_SLOT_MODELS.includes(model) ||
  (!!slot.tier && goodEnough(slot.tier).includes(model));

/** The model a new run gets for the slot: its tier's first allowed model, else its default. */
export const slotModelFor = (slot: ModelSlot, target: string) => slotModels(slot, target)[0] ?? slot.default;

/** A slot model's route. The runner makes the same route for a slot's default. */
export function slotRoute(model: string): ServingRoute {
  return { kind: 'openrouter', model, allowFallbacks: true };
}

export const slotLabel = (s: Pick<ModelSlot, 'id' | 'label'>) =>
  s.label ?? s.id.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/**
 * Whether the runner can run this version: an Inspect task, no sandbox or GPU, the pinned package
 * versions, and a slot for each role besides the target, with a tier or a default we can reach.
 */
export function canRun(runner: EvalRunner | undefined): boolean {
  if (runner?.kind !== 'inspect' || !runner.task || runner.sandbox || runner.gpu || !pinsMatch(runner)) return false;
  const slots = runner.models ?? [];
  const filled = new Set<ModelRole>(['target', ...slots.map((s) => s.role)]);
  return (
    (runner.roles ?? ['target']).every((r) => filled.has(r)) &&
    slots.every(
      (s) => !!s.taskArg !== !!s.inspectRole && (s.tier ? s.tier in LADDERS.tiers : JUDGES.includes(s.default)),
    )
  );
}

/** "judge: openai/gpt-4o (fallback x/y: 3 calls)", as the runner writes `ResultSettings.otherModels`. */
export function otherModelsText(
  slots: ModelSlot[],
  models: Record<string, ServingRoute | undefined> | undefined,
  fallbacks: FallbackUse[] = [],
) {
  return slots
    .filter((s) => models?.[s.id])
    .map((s) => {
      const used = fallbacks
        .filter((f) => f.slot === s.id)
        .map((f) => `fallback ${f.model}: ${f.calls} call${f.calls > 1 ? 's' : ''}`);
      return `${s.id}: ${models![s.id]!.model}${used.length ? ` (${used.join(', ')})` : ''}`;
    })
    .join(', ');
}
