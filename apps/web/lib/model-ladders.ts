import type { ModelLadders } from '@openaudit/spec';
import data from '@openaudit/spec/model-ladders.json';

// The default models of our own LLM jobs and the eval slot tiers, from spec/model-ladders.yaml.
// The runner has the same functions (apps/runner/openaudit_runner/ladders.py).

// The spec generator checked the file against `ModelLadders`.
export const LADDERS = data as unknown as ModelLadders;

// Inspect provider prefixes of a route model. `openai-api` also has a service name.
const PROVIDERS = new Set(['openrouter', 'vllm', 'sglang', 'hf', 'ollama', 'llama-cpp-python']);

/** `openrouter/anthropic/claude-x:beta` and `vllm/Anthropic/Claude-X` are `anthropic/claude-x`. */
export function modelId(model: string): string {
  let parts = model.toLowerCase().split(':')[0].split('/');
  if (parts[0] === 'openai-api') parts = parts.slice(2);
  else if (PROVIDERS.has(parts[0]) && parts.length > 2) parts = parts.slice(1);
  return parts.join('/');
}

/** `openrouter/meta-llama/llama-3.3-70b-instruct` is from the lab `meta`. */
export function lab(model: string) {
  const prefix = modelId(model).split('/')[0];
  return LADDERS.labs[prefix] ?? prefix;
}

const skipLab = (models: string[], target?: string) => models.filter((m) => !target || lab(m) !== lab(target));

/** The tier's models, best first, without the models of the target's lab. */
export function tierModels(tier: string, target?: string): string[] {
  return skipLab(LADDERS.tiers[tier]?.models ?? [], target);
}

/** The role's models, best first, without the models of the target's lab. */
export function roleModels(role: string, target?: string): string[] {
  const r = LADDERS.roles[role];
  if (!r) return [];
  return skipLab(r.models ?? LADDERS.tiers[r.tier ?? '']?.models ?? [], target);
}

/** The models of the tier and of the tiers above it (tiers are listed best first). */
export function goodEnough(tier: string): string[] {
  const names = Object.keys(LADDERS.tiers);
  const above = names.slice(0, names.indexOf(tier)).reverse();
  return [...new Set([tier, ...above].flatMap((t) => LADDERS.tiers[t]?.models ?? []))];
}

export type TierSlot = { id: string; default: string; tier?: string; labs?: string[]; sameLab?: boolean };

function allowed(slot: TierSlot, model: string, target: string): boolean {
  if (modelId(model) === modelId(target)) return false;
  return Boolean(slot.sameLab) || lab(model) !== lab(target);
}

/** The slot's model for the target and then its fallbacks: the slot's tier, without the
 *  models that the rules do not allow, and the slot's `labs` first, in order. Empty: the slot
 *  has no tier. */
export function slotModels(slot: TierSlot, target: string): string[] {
  if (!slot.tier) return [];
  const models = tierModels(slot.tier).filter((m) => allowed(slot, m, target));
  const labs = slot.labs ?? [];
  const off = (m: string) => (labs.includes(lab(m)) ? labs.indexOf(lab(m)) : labs.length);
  return models
    .map((m, i) => [m, i] as const)
    .sort((a, b) => off(a[0]) - off(b[0]) || a[1] - b[1])
    .map(([m]) => m);
}

/** Whether a run's model for the slot is still good enough for the target. */
export function slotOk(slot: TierSlot, model: string, target: string): boolean {
  if (!slot.tier) return model === slot.default;
  return goodEnough(slot.tier).includes(model) && allowed(slot, model, target);
}

export type TierRoute = { kind: 'openrouter'; model: string; allowFallbacks: true; fallbacks?: string[] };

/** Routes for the slots with a tier. A slot's fallbacks try models that no other slot uses
 *  first, so that a panel of judges keeps its labs apart. Throws when a slot has no model. */
export function tierRoutes(slots: TierSlot[], target: string): Record<string, TierRoute> {
  const picks = slots.filter((s) => s.tier).map((s) => [s.id, slotModels(s, target)] as const);
  const used = new Set(picks.flatMap(([, m]) => m.slice(0, 1)));
  const out: Record<string, TierRoute> = {};
  for (const [id, models] of picks) {
    if (!models.length) throw new Error(`No model of its tier can fill slot ${id} for ${target}.`);
    const rest = models
      .slice(1)
      .map((m, i) => [m, i] as const)
      .sort((a, b) => Number(used.has(a[0])) - Number(used.has(b[0])) || a[1] - b[1])
      .map(([m]) => m);
    out[id] = {
      kind: 'openrouter',
      model: models[0],
      allowFallbacks: true,
      ...(rest.length ? { fallbacks: rest } : {}),
    };
  }
  return out;
}
