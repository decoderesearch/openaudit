import type { ServingRoute } from '@openaudit/spec';
import { effortChoice, type EffortChoice } from './effort';
import {
  openRouterEndpoints,
  openRouterModels,
  PAGE_MAX_AGE,
  type OpenRouterEndpoint,
  type OpenRouterModel,
} from './openrouter';
import overrides from './route-overrides.json';

// How we reach a model to run evals on it, from OpenRouter's data. A model matches by OpenRouter's
// Hugging Face id, or by the same model id. The route pins one provider with no fallbacks: the
// organization's own; else, for API models, a licensed cloud; else, for open weights, a provider that
// states bf16, fp16, fp32 or fp8 weights. route-overrides.json changes the result: a full route is
// used as it is, `{ "model": id }` sets the OpenRouter model, and null gives the model no route.

/** A model as the rule reads it. `organization` is the organization's slug. */
export type RouteModel = { name: string; source: string; organization: string };

type Override = ServingRoute | { model: string } | null;

/** Organization slug to its OpenRouter author names, when they are not the same. */
const AUTHORS: Record<string, string[]> = {
  bytedance: ['bytedance-seed', 'bytedance'],
  meta: ['meta-llama', 'meta'],
  reka: ['rekaai'],
  'zai-org': ['z-ai'],
};

/** Organization slug to the OpenRouter providers that the organization runs, best first. */
const OWN_PROVIDERS: Record<string, string[]> = {
  amazon: ['Amazon Bedrock'],
  anthropic: ['Anthropic'],
  baidu: ['Baidu'],
  bytedance: ['Seed'],
  cohere: ['Cohere'],
  deepseek: ['DeepSeek'],
  google: ['Google AI Studio', 'Google'],
  kwaipilot: ['StreamLake'],
  meta: ['Meta'],
  minimax: ['Minimax'],
  mistralai: ['Mistral'],
  moonshotai: ['Moonshot AI'],
  openai: ['OpenAI'],
  perplexity: ['Perplexity'],
  qwen: ['Alibaba'],
  reka: ['Reka'],
  stepfun: ['StepFun'],
  tencent: ['Tencent'],
  'x-ai': ['xAI'],
  xiaomi: ['Xiaomi'],
  'zai-org': ['Z.AI'],
};

/** Clouds that the makers of API models license to serve them, best first. */
const CLOUD_HOSTS = ['Amazon Bedrock', 'Claude Platform on AWS', 'Google', 'Azure'];

/** Weights we accept from a provider that is not the organization, best first. */
const PRECISION: Record<string, number> = { fp32: 0, bf16: 0, fp16: 0, fp8: 1 };

export function routeOverride(name: string): Override | undefined {
  return (overrides as Record<string, Override>)[name];
}

const indexes = new WeakMap<OpenRouterModel[], { byId: Map<string, string>; byHf: Map<string, string> }>();

/** The OpenRouter model id for a model, or null. */
export function matchModel(model: RouteModel, listed: OpenRouterModel[], today = new Date()): string | null {
  let index = indexes.get(listed);
  if (!index) {
    const day = today.toISOString().slice(0, 10);
    const usable = listed.filter(
      (m) => !m.id.includes(':') && !m.id.startsWith('~') && m.text && !(m.expires && m.expires <= day),
    );
    index = {
      byId: new Map(usable.map((m) => [m.id.toLowerCase(), m.id])),
      byHf: new Map(usable.filter((m) => m.hfId).map((m) => [m.hfId!.toLowerCase(), m.id])),
    };
    indexes.set(listed, index);
  }
  const lower = model.name.toLowerCase();
  const byHf = index.byHf.get(lower);
  if (byHf) return byHf;
  const name = lower.split('/').slice(1).join('/');
  const authors = AUTHORS[model.organization] ?? [model.organization];
  const id = [lower, ...authors.map((a) => `${a}/${name}`)].find((i) => index.byId.has(i));
  return id ? index.byId.get(id)! : null;
}

/** The pinned route on an OpenRouter model, or null when no provider passes the rule. */
export function pickRoute(model: RouteModel, orModel: string, endpoints: OpenRouterEndpoint[]): ServingRoute | null {
  const find = (names: string[], up = false) =>
    names.map((p) => endpoints.find((e) => e.provider_name === p && (!up || e.status === 0))).find(Boolean);
  let pick = find(OWN_PROVIDERS[model.organization] ?? []);
  if (!pick && model.source === 'api') pick = find(CLOUD_HOSTS, true);
  if (!pick && model.source === 'hf') {
    pick = endpoints
      .filter((e) => (e.quantization ?? '') in PRECISION)
      .sort(
        (a, b) =>
          (a.status === 0 ? 0 : 1) - (b.status === 0 ? 0 : 1) ||
          PRECISION[a.quantization!] - PRECISION[b.quantization!] ||
          a.provider_name.localeCompare(b.provider_name),
      )[0];
  }
  if (!pick) return null;
  return {
    kind: 'openrouter',
    model: orModel,
    providers: [pick.provider_name],
    allowFallbacks: false,
    quantization: pick.quantization || 'unknown',
  };
}

/** The thinking efforts a route's model takes. */
export async function effortsFor(route: ServingRoute, maxAgeMs = PAGE_MAX_AGE): Promise<EffortChoice> {
  if (route.kind !== 'openrouter') return effortChoice(undefined);
  const listed = await openRouterModels(maxAgeMs);
  return effortChoice(listed ? listed.find((m) => m.id === route.model)?.reasoning : undefined);
}

/** How we reach a model. Null: we cannot run it, or OpenRouter did not answer. */
export async function routeFor(model: RouteModel, maxAgeMs = PAGE_MAX_AGE): Promise<ServingRoute | null> {
  const override = routeOverride(model.name);
  if (override === null) return null;
  if (override && 'kind' in override) return override;
  let orModel = override?.model ?? null;
  if (!orModel) {
    const listed = await openRouterModels(maxAgeMs);
    orModel = listed && matchModel(model, listed);
  }
  if (!orModel) return null;
  const endpoints = await openRouterEndpoints(orModel, maxAgeMs);
  return endpoints && pickRoute(model, orModel, endpoints);
}
