import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpenRouterEndpoint, OpenRouterModel } from './openrouter';

const openRouterModels = vi.hoisted(() => vi.fn());
const openRouterEndpoints = vi.hoisted(() => vi.fn());
vi.mock('./openrouter', () => ({ openRouterModels, openRouterEndpoints, PAGE_MAX_AGE: 300_000 }));
vi.mock('./route-overrides.json', () => ({
  default: {
    'blocked/model': null,
    'fixed/model': { kind: 'openrouter', model: 'x/fixed', providers: ['P'], allowFallbacks: false },
    'CohereLabs/c4ai-command-a-03-2025': { model: 'cohere/command-a' },
  },
}));

import { matchModel, pickRoute, routeFor } from './model-routes';

const or = (id: string, more: Partial<OpenRouterModel> = {}): OpenRouterModel => ({
  id,
  hfId: null,
  expires: null,
  text: true,
  price: null,
  reasoning: null,
  ...more,
});
const ep = (provider_name: string, quantization = 'unknown', status = 0): OpenRouterEndpoint => ({
  provider_name,
  quantization,
  status,
});

const LISTED = [
  or('qwen/qwen3.6-27b', { hfId: 'Qwen/Qwen3.6-27B' }),
  or('anthropic/claude-sonnet-5.5'),
  or('anthropic/claude-sonnet-5.5:batch'),
  or('~anthropic/claude-sonnet-latest'),
  or('mistralai/mistral-medium-3'),
  or('openai/gpt-old', { expires: '2020-01-01' }),
];

describe('matchModel', () => {
  it("matches OpenRouter's Hugging Face id, the same id, or the organization's OpenRouter name", () => {
    expect(matchModel({ name: 'Qwen/Qwen3.6-27B', source: 'hf', organization: 'qwen' }, LISTED)).toBe(
      'qwen/qwen3.6-27b',
    );
    expect(matchModel({ name: 'anthropic/claude-sonnet-5.5', source: 'api', organization: 'anthropic' }, LISTED)).toBe(
      'anthropic/claude-sonnet-5.5',
    );
    expect(matchModel({ name: 'mistral/mistral-medium-3', source: 'api', organization: 'mistralai' }, LISTED)).toBe(
      'mistralai/mistral-medium-3',
    );
  });

  it('skips variants, moving aliases and expired models', () => {
    const list = [...LISTED];
    expect(matchModel({ name: 'anthropic/claude-sonnet-latest', source: 'api', organization: 'anthropic' }, list)).toBe(
      null,
    );
    expect(matchModel({ name: 'openai/gpt-old', source: 'api', organization: 'openai' }, list)).toBeNull();
  });
});

describe('pickRoute', () => {
  const qwen = { name: 'Qwen/Qwen3.6-27B', source: 'hf', organization: 'qwen' };
  const claude = { name: 'anthropic/claude-sonnet-4', source: 'api', organization: 'anthropic' };
  const llama = { name: 'meta-llama/Llama-3.1-8B-Instruct', source: 'hf', organization: 'meta' };

  it("pins the organization's own provider with no fallbacks", () => {
    expect(pickRoute(qwen, 'qwen/qwen3.6-27b', [ep('Novita', 'bf16'), ep('Alibaba')])).toEqual({
      kind: 'openrouter',
      model: 'qwen/qwen3.6-27b',
      providers: ['Alibaba'],
      allowFallbacks: false,
      quantization: 'unknown',
    });
  });

  it('uses a licensed cloud for an API model, never another host', () => {
    expect(pickRoute(claude, 'c', [ep('Amazon Bedrock')])?.providers).toEqual(['Amazon Bedrock']);
    expect(pickRoute(claude, 'c', [ep('Amazon Bedrock', 'unknown', -5)])).toBeNull();
    expect(pickRoute(claude, 'c', [ep('SomeHost', 'bf16')])).toBeNull();
  });

  it('picks open-weight hosts by status, precision, then name', () => {
    const route = (eps: OpenRouterEndpoint[]) => pickRoute(llama, 'l', eps)?.providers?.[0] ?? null;
    expect(route([ep('B', 'fp8'), ep('C', 'bf16'), ep('A', 'bf16')])).toBe('A');
    expect(route([ep('A', 'bf16', -2), ep('B', 'fp8')])).toBe('B');
    expect(route([ep('A', 'int4'), ep('B', 'fp4'), ep('C', 'unknown')])).toBeNull();
  });
});

describe('routeFor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openRouterModels.mockResolvedValue([or('cohere/command-a'), ...LISTED]);
    openRouterEndpoints.mockResolvedValue([ep('Cohere'), ep('Anthropic'), ep('Alibaba')]);
  });

  it('follows the overrides', async () => {
    expect(await routeFor({ name: 'blocked/model', source: 'api', organization: 'x' })).toBeNull();
    expect((await routeFor({ name: 'fixed/model', source: 'api', organization: 'x' }))?.model).toBe('x/fixed');
    const cohere = await routeFor({ name: 'CohereLabs/c4ai-command-a-03-2025', source: 'hf', organization: 'cohere' });
    expect(cohere).toMatchObject({ model: 'cohere/command-a', providers: ['Cohere'] });
    expect(openRouterModels).not.toHaveBeenCalled();
  });

  it('passes the max age on, and gives null when OpenRouter does not answer', async () => {
    const claude = { name: 'anthropic/claude-sonnet-5.5', source: 'api', organization: 'anthropic' };
    expect(await routeFor(claude, 30_000)).toMatchObject({ providers: ['Anthropic'] });
    expect(openRouterEndpoints).toHaveBeenCalledWith('anthropic/claude-sonnet-5.5', 30_000);
    openRouterModels.mockResolvedValueOnce(null);
    expect(await routeFor(claude)).toBeNull();
  });
});
