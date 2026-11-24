import { afterEach, describe, expect, it, vi } from 'vitest';
import { openRouterEndpoints, openRouterModels } from './openrouter';

const answer = (data: unknown) => Promise.resolve(new Response(JSON.stringify({ data })));

afterEach(() => vi.unstubAllGlobals());

describe('openRouterModels', () => {
  it('keeps the fields we use, and reuses data younger than the max age', async () => {
    const fetch = vi.fn(() =>
      answer([
        {
          id: 'a/b',
          hugging_face_id: 'A/B',
          architecture: { output_modalities: ['text'] },
          pricing: { prompt: '0.000001', completion: '0.000002' },
          description: 'dropped',
        },
        { id: 'c/d', supported_parameters: ['reasoning'], reasoning: { mandatory: true } },
        { id: 'e/f', supported_parameters: ['reasoning'] },
      ]),
    );
    vi.stubGlobal('fetch', fetch);
    const first = await openRouterModels(0);
    expect(first).toEqual([
      {
        id: 'a/b',
        hfId: 'A/B',
        expires: null,
        text: true,
        price: { input: 0.000001, output: 0.000002 },
        reasoning: null,
      },
      { id: 'c/d', hfId: null, expires: null, text: false, price: null, reasoning: { mandatory: true } },
      { id: 'e/f', hfId: null, expires: null, text: false, price: null, reasoning: {} },
    ]);
    await openRouterModels(60_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    await openRouterModels(0);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('openRouterEndpoints', () => {
  it('gives null when OpenRouter does not answer, and does not keep the failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')));
    expect(await openRouterEndpoints('x/y', 60_000)).toBeNull();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => answer({ endpoints: [{ provider_name: 'P', quantization: 'bf16', status: 0 }] })),
    );
    expect(await openRouterEndpoints('x/y', 60_000)).toEqual([{ provider_name: 'P', quantization: 'bf16', status: 0 }]);
  });
});
