// OpenRouter's public model data, kept in memory. Each caller says how old the data may be.

export type OpenRouterModel = {
  id: string;
  hfId: string | null;
  expires: string | null;
  text: boolean;
  price: { input: number; output: number } | null;
  /** How the model thinks. Null: it takes no `reasoning` parameter. */
  reasoning: OpenRouterReasoning | null;
};

/** OpenRouter's `reasoning` object of a model. Fields can be missing. */
export type OpenRouterReasoning = {
  /** Effort levels, highest first. Missing or null: no levels (on or off only). */
  supported_efforts?: string[] | null;
  default_effort?: string | null;
  default_enabled?: boolean;
  /** Thinking cannot be turned off. */
  mandatory?: boolean;
};

export type OpenRouterEndpoint = { provider_name: string; quantization?: string | null; status?: number };

const API = 'https://openrouter.ai/api/v1';
/** For page views. */
export const PAGE_MAX_AGE = 5 * 60_000;
/** For quotes and run starts. One fetch serves all the reads of one request. */
export const QUOTE_MAX_AGE = 30_000;

const cache = new Map<string, { at: number; data: Promise<unknown> }>();

/** The `data` of an OpenRouter response, changed by `shape`. Null: OpenRouter did not answer. */
function get<T>(path: string, maxAgeMs: number, shape: (data: never) => T): Promise<T | null> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.data as Promise<T | null>;
  const data = fetch(`${API}${path}`, { signal: AbortSignal.timeout(5000) })
    .then(async (res) => (res.ok ? shape(((await res.json()) as { data: never }).data) : null))
    .catch(() => null);
  const entry = { at: Date.now(), data };
  cache.set(path, entry);
  // Do not keep a failure: the next read tries again.
  void data.then((d) => d === null && cache.get(path) === entry && cache.delete(path));
  return data;
}

type RawModel = {
  id: string;
  hugging_face_id?: string | null;
  expiration_date?: string | null;
  architecture?: { output_modalities?: string[] };
  pricing?: { prompt?: string; completion?: string };
  supported_parameters?: string[];
  reasoning?: OpenRouterReasoning | null;
};

/** All models on OpenRouter, with only the fields we use. */
export function openRouterModels(maxAgeMs: number): Promise<OpenRouterModel[] | null> {
  return get('/models', maxAgeMs, (data: RawModel[]) =>
    data.map((m) => {
      const input = Number(m.pricing?.prompt);
      const output = Number(m.pricing?.completion);
      return {
        id: m.id,
        hfId: m.hugging_face_id || null,
        expires: m.expiration_date || null,
        text: !!m.architecture?.output_modalities?.includes('text'),
        price: input >= 0 && output >= 0 ? { input, output } : null,
        reasoning: m.supported_parameters?.includes('reasoning') ? (m.reasoning ?? {}) : null,
      };
    }),
  );
}

/** The providers that serve one OpenRouter model. */
export function openRouterEndpoints(model: string, maxAgeMs: number): Promise<OpenRouterEndpoint[] | null> {
  return get(`/models/${model}/endpoints`, maxAgeMs, (data: { endpoints?: OpenRouterEndpoint[] }) =>
    (data.endpoints ?? []).map(({ provider_name, quantization, status }) => ({ provider_name, quantization, status })),
  );
}
