// The statement that each request for eval content must carry: who sends it (a person, or an AI
// agent and its name) and the no-training promise. Headers for API calls; the same names as query
// parameters for downloads, which a browser cannot send headers with.

export const CLIENT_HEADER = 'x-openaudit-client';
export const AGENT_HEADER = 'x-openaudit-ai-agent';
export const NO_TRAINING_HEADER = 'x-openaudit-no-training';

export const EVAL_ACCESS_TURNSTILE_ACTION = 'eval-access';

/** The exact text of the promise. Changes to it need a new terms date. */
export const NO_TRAINING_PROMISE = 'I will not use this content to train, fine-tune or distill AI models';

/** The harm promise, in the same form checkbox as the one above. Changes need a new terms date. */
export const HARM_PROMISE = 'Evals may have harmful content. I agree to view and not misuse these evals';

const AGENT_MAX = 200;

export type Attestation = { client: 'human' } | { client: 'ai'; agent: string };

const PARAMS = { client: 'client', agent: 'ai_agent', promise: 'no_training' } as const;

/** The statement in a request's headers, else in its query parameters, or the problem with it. */
export function readAttestation(request: Request): { ok: true; value: Attestation } | { ok: false; error: string } {
  const h = request.headers;
  const q = new URL(request.url).searchParams;
  const client = (h.get(CLIENT_HEADER) ?? q.get(PARAMS.client))?.trim().toLowerCase();
  const agent = (h.get(AGENT_HEADER) ?? q.get(PARAMS.agent))?.trim();
  const promise = (h.get(NO_TRAINING_HEADER) ?? q.get(PARAMS.promise))?.trim();
  if (client !== 'human' && client !== 'ai') return { ok: false, error: `Set ${CLIENT_HEADER} to "human" or "ai".` };
  if (client === 'ai' && !agent)
    return {
      ok: false,
      error: `AI agents must name themselves in ${AGENT_HEADER}: the agent, its model and its operator.`,
    };
  if (agent && agent.length > AGENT_MAX)
    return { ok: false, error: `${AGENT_HEADER} must be at most ${AGENT_MAX} characters.` };
  if (promise?.toLowerCase() !== NO_TRAINING_PROMISE.toLowerCase())
    return { ok: false, error: `Set ${NO_TRAINING_HEADER} to exactly: ${NO_TRAINING_PROMISE}` };
  return { ok: true, value: client === 'ai' ? { client, agent: agent! } : { client } };
}

export function attestationHeaders(a: Attestation): Record<string, string> {
  return {
    [CLIENT_HEADER]: a.client,
    ...(a.client === 'ai' && { [AGENT_HEADER]: a.agent }),
    [NO_TRAINING_HEADER]: NO_TRAINING_PROMISE,
  };
}

/** `url` with the statement as query parameters, for a download link. */
export function withAttestation(url: string, a: Attestation): string {
  const q = new URLSearchParams({ [PARAMS.client]: a.client, [PARAMS.promise]: NO_TRAINING_PROMISE });
  if (a.client === 'ai') q.set(PARAMS.agent, a.agent);
  return `${url}${url.includes('?') ? '&' : '?'}${q}`;
}

/** The 428 answer when the statement is missing or wrong. */
export function attestationRequired(error: string, termsUrl: string): Response {
  return Response.json(
    {
      code: 'statement',
      error,
      required: {
        [CLIENT_HEADER]: '"human" or "ai"',
        [AGENT_HEADER]:
          'when ai: the agent, its model and its operator, for example "Claude Code (claude-opus-5) for Example Lab"',
        [NO_TRAINING_HEADER]: NO_TRAINING_PROMISE,
      },
      terms: termsUrl,
    },
    { status: 428, headers: { 'cache-control': 'no-store' } },
  );
}
