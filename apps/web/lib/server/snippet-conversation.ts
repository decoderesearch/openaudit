import { prisma } from '@/lib/db';
import type { SnippetExcerpt } from '@/lib/openaudit-card';
import { r2Get } from '@/lib/server/r2';
import type { Message, Transcript } from '@openaudit/spec';

// Encrypted reasoning (a Fernet token, maybe with a "." and a suffix).
const ENCRYPTED = /^gAAAAA[\w=.-]+$/;
/** A longer message keeps its head and tail, so that a long agent transcript stays small. */
const MESSAGE_CHARS = 20_000;

/** JSON as Python's `json.dumps` writes it (a space after each `,` and `:`), as the runner wrote it. */
function pyJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(pyJson).join(', ')}]`;
  if (v && typeof v === 'object')
    return `{${Object.entries(v)
      .map(([k, x]) => `${JSON.stringify(k)}: ${pyJson(x)}`)
      .join(', ')}}`;
  return JSON.stringify(v) ?? 'null';
}

/** A message as the flagger read it: text, thinking in `<thinking>` tags, then tool calls. */
export function messageText(m: Pick<Message, 'content' | 'toolCalls'>): string {
  const parts = (m.content ?? []).map((c) => {
    if (c.type === 'text') return c.text ?? '';
    if (c.type === 'reasoning' && c.text && !ENCRYPTED.test(c.text.trim())) return `<thinking>\n${c.text}\n</thinking>`;
    return '';
  });
  for (const call of m.toolCalls ?? []) parts.push(`[tool call ${call.function}: ${pyJson(call.arguments ?? {})}]`);
  return parts.filter(Boolean).join('\n');
}

function cut(text: string) {
  if (text.length <= MESSAGE_CHARS) return text;
  const half = MESSAGE_CHARS / 2;
  return `${text.slice(0, half)}\n[…]\n${text.slice(-half)}`;
}

/**
 * All messages of the thread the flagger read, numbered as the excerpt numbers them: the target's
 * thread (else the first), with the attempt's output as the reply when the thread has none.
 */
export function conversationOf(transcript: Transcript, output?: string | null): SnippetExcerpt['messages'] {
  const target = new Set(transcript.participants.filter((p) => p.role === 'target').map((p) => p.id));
  const thread = transcript.threads.find((t) => target.has(t.participant)) ?? transcript.threads[0];
  const messages: Pick<Message, 'role' | 'content' | 'toolCalls'>[] = [...(thread?.messages ?? [])];
  if (!messages.some((m) => m.role === 'assistant') && output)
    messages.push({ role: 'assistant', content: [{ type: 'text', text: output }] });
  return messages.map((m, index) => ({ index, role: m.role, text: cut(messageText(m)) }));
}

/** The whole conversation of a snippet's attempt. Check the reader's access first (`snippetExcerpt`). */
export async function snippetConversation(id: string): Promise<SnippetExcerpt['messages'] | null> {
  const snippet = await prisma.openAuditSnippet.findUnique({ where: { id }, select: { attemptId: true } });
  if (!snippet) return null;
  const attempt = await prisma.evalAttempt.findUnique({
    where: { id: snippet.attemptId },
    select: { bodyKey: true, output: true },
  });
  if (!attempt?.bodyKey) return null;
  const res = await r2Get(attempt.bodyKey);
  if (!res.ok) return null;
  return conversationOf((await res.json()) as Transcript, attempt.output);
}
