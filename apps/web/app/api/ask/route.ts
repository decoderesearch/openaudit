import { ASK_SYSTEM_PROMPT } from '@/lib/ask-prompt';
import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL, ASK_ENABLED } from '@/lib/env';
import { roleModels } from '@/lib/model-ladders';
import { clientIp } from '@/lib/rate-limit';
import { pageContext, type Screen } from '@/lib/server/ask-data';
import { checkAskLimit, MAX_MESSAGE_CHARS, MAX_MESSAGES, MAX_OUTPUT_TOKENS } from '@/lib/server/ask-limits';
import { ASK_TOOLS } from '@/lib/server/ask-tools';
import { createAnthropic } from '@ai-sdk/anthropic';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type LanguageModelUsage,
  type UIMessage,
} from 'ai';

// The site assistant. The system prompt has two blocks: the instructions and the site knowledge,
// which are the same for each request, then the page the reader has open. Each block is cached:
// the first for all readers, the second while the reader stays on the same part of the page.

type AskRequest = { messages?: UIMessage[]; path?: string; screen?: Screen };

/** The `site_assistant` model, as an Anthropic API id: "anthropic/claude-haiku-5.5" is
 * "claude-haiku-5-5". */
const MODEL =
  ANTHROPIC_MODEL || (roleModels('site_assistant')[0] ?? '').replace(/^anthropic\//, '').replaceAll('.', '-');

const CACHE = { anthropic: { cacheControl: { type: 'ephemeral' as const } } };

export async function POST(request: Request) {
  if (!ASK_ENABLED) return problem(404, 'Not found.');
  if (!ANTHROPIC_API_KEY || !MODEL) return problem(503, 'The assistant is not set up on this site.');
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) return problem(413, 'The question is too long.');
  let body: AskRequest;
  try {
    body = (await request.json()) as AskRequest;
  } catch {
    return problem(400, 'Malformed request.');
  }
  const messages = accept(body.messages);
  if (messages === null) return problem(400, 'Ask something first.');
  if (messages === TOO_LONG) return problem(400, `Ask something shorter than ${MAX_MESSAGE_CHARS} characters.`);

  const verdict = await checkAskLimit(clientIp(request.headers));
  if (!verdict.ok) return problem(429, verdict.reason, { 'retry-after': String(verdict.retryAfter) });

  const path = typeof body.path === 'string' && body.path.startsWith('/') ? body.path.slice(0, 300) : '/';
  const result = streamText({
    model: createAnthropic({ apiKey: ANTHROPIC_API_KEY })(MODEL),
    system: [
      { role: 'system', content: ASK_SYSTEM_PROMPT, providerOptions: CACHE },
      { role: 'system', content: await pageContext(path, screenOf(body.screen)), providerOptions: CACHE },
    ],
    messages: await convertToModelMessages(messages),
    tools: ASK_TOOLS,
    stopWhen: isStepCount(6),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    temperature: 0.2,
    // The answers are lookups in data that is already in the prompt; thinking only adds delay.
    providerOptions: { anthropic: { thinking: { type: 'disabled' } } },
    onFinish: ({ totalUsage }) => logUsage(totalUsage),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools: ASK_TOOLS,
      onError: (error) => {
        console.error('[ask] stream failed', error);
        return 'The assistant lost that answer. Ask again.';
      },
    }),
  });
}

/** The screen fields as strings, or nothing: the client sends them, so they are not trusted. */
function screenOf(s: unknown): Screen {
  if (!s || typeof s !== 'object') return {};
  const { title, section, text } = s as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  return { title: str(title), section: str(section), text: str(text) };
}

/** The largest request: the thread (`MAX_THREAD_CHARS`), the page text and some room. */
const MAX_BODY_BYTES = 200_000;

const TOO_LONG = Symbol('too long');

/** Most characters in the whole thread that is sent on. The page text is apart from it. */
const MAX_THREAD_CHARS = 60_000;

/**
 * The end of the thread, starting at a question, or why not. User messages keep only their text.
 * The client sends the thread, so it is not trusted: its size is capped too.
 */
function accept(messages: UIMessage[] | undefined): UIMessage[] | typeof TOO_LONG | null {
  if (!Array.isArray(messages) || messages.length === 0) return null;
  let recent = messages
    .slice(-MAX_MESSAGES)
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => (m.role === 'user' ? { ...m, parts: (m.parts ?? []).filter((p) => p.type === 'text') } : m));
  const first = recent.findIndex((m) => m.role === 'user');
  if (first < 0) return null;
  recent = recent.slice(first);
  const last = recent[recent.length - 1];
  if (last.role !== 'user') return null;
  const chars = (m: UIMessage) => (m.parts ?? []).reduce((n, p) => n + (p.type === 'text' ? p.text.length : 0), 0);
  const length = chars(last);
  if (length === 0) return null;
  if (length > MAX_MESSAGE_CHARS) return TOO_LONG;
  while (recent.length > 1 && JSON.stringify(recent).length > MAX_THREAD_CHARS) {
    recent = recent.slice(recent.findIndex((m, i) => i > 0 && m.role === 'user'));
  }
  return recent;
}

/** One line per answer. "write" on every answer means the cached blocks change per request. */
function logUsage(usage: LanguageModelUsage) {
  const read = usage.inputTokenDetails?.cacheReadTokens ?? 0;
  const written = usage.inputTokenDetails?.cacheWriteTokens ?? 0;
  const state = read > 0 ? 'hit' : written > 0 ? 'write' : 'uncached';
  console.log(
    `[ask] cache ${state} read=${read} write=${written} in=${usage.inputTokens ?? 0} out=${usage.outputTokens ?? 0}`,
  );
}

function problem(status: number, error: string, headers: HeadersInit = {}) {
  return Response.json({ error }, { status, headers: { 'cache-control': 'no-store', ...headers } });
}
