import { CANARY, NO_TRAINING } from '@/lib/legal';
import { canReadHazard } from '@/lib/runs/hazard';
import { attemptRule } from '@/lib/runs/terms';
import type { EvalAttempt, EvalVersion, Message, TokenUsage } from '@openaudit/spec';

// "Open in J-Lens": a transcript goes to Neuronpedia's `/api/lens/share`, which runs the lens
// over it (no new tokens) and returns a share page. The browser posts it, so Neuronpedia's
// per-IP limits apply to each user, not to our server.

/** A Neuronpedia J-Lens model. `tokenLimit`: the lens limit of its servers. `charLimit`: a lower
 * transcript limit in characters, if its tokens are short. `lensColumns`: the lens columns a share
 * opens with. `thinkTags`: its chat template reads `<think>…</think>` in an assistant message as
 * the thinking. */
export interface JlensModel {
  id: string;
  label: string;
  hfRepoId: string;
  tokenLimit: number;
  charLimit?: number;
  lensColumns: string[];
  thinkTags: boolean;
}

// Server settings that `/api/global` does not give. 1024 is the inference server default.
const TOKEN_LIMITS: Record<string, number> = {
  'qwen3.6-27b': 4096,
  'qwen3-32b': 4096,
  'gpt-oss-20b': 4096,
  'deepseek-v4-flash': 2048,
};
const DEFAULT_TOKEN_LIMIT = 1024;
const CHAR_LIMITS: Record<string, number> = {
  'deepseek-v4-flash': 11000,
};
// Our models with no J-Lens of their own: the J-Lens model of an earlier version, by repo id.
const EARLIER_VERSIONS: Record<string, string> = {
  'deepseek-ai/deepseek-v4-flash-0731': 'deepseek-v4-flash',
};
const JPP_MODELS = ['qwen3.6-27b'];
// Chat models whose servers load no Jacobian lens.
const NO_JLENS = ['gemma-4-31b-it'];
const THINK_TAGS = /^(qwen|deepseek)/;
// No Neuronpedia lens server reads more than this. Above it, the transcript does not go to the client.
const MAX_TOKEN_LIMIT = 4096;

/** A model in Neuronpedia's `/api/global`. */
export interface NeuronpediaModel {
  id: string;
  displayName?: string;
  hfRepoId?: string | null;
  openRouterId?: string | null;
  inferenceEnabled?: boolean;
  instruct?: boolean;
}

function jlensModel(m: { id: string; displayName?: string; hfRepoId?: string | null }): JlensModel {
  return {
    id: m.id,
    label: m.displayName || m.id,
    hfRepoId: m.hfRepoId ?? '',
    tokenLimit: TOKEN_LIMITS[m.id] ?? DEFAULT_TOKEN_LIMIT,
    ...(CHAR_LIMITS[m.id] ? { charLimit: CHAR_LIMITS[m.id] } : {}),
    lensColumns: JPP_MODELS.includes(m.id) ? ['JPP_LENS'] : ['JACOBIAN_LENS'],
    thinkTags: THINK_TAGS.test(m.id),
  };
}

/** The model that a transcript from an unsupported model opens on. */
export const DEFAULT_JLENS_MODEL = jlensModel({
  id: 'qwen3.6-27b',
  displayName: 'Qwen3.6-27B',
  hfRepoId: 'Qwen/Qwen3.6-27B',
});

/** The J-Lens models in Neuronpedia's `/api/global`: the chat models that its servers run. */
export function jlensModelsFromGlobal(global: { models?: NeuronpediaModel[] }): JlensModel[] {
  return (global.models ?? [])
    .filter((m) => m.inferenceEnabled && m.instruct && m.hfRepoId && !NO_JLENS.includes(m.id))
    .map(jlensModel);
}

/**
 * The J-Lens model for a transcript: the model that wrote it (`same`), else an earlier version of
 * it (`earlier`), else the default model. `names`: our model's name and aliases. A name matches a
 * Hugging Face repo id without case.
 */
export function jlensModelFor(
  names: string[],
  models: JlensModel[],
): { model: JlensModel; same: boolean; earlier: boolean } {
  const wanted = names.map((n) => n.toLowerCase());
  const same = models.find((m) => wanted.includes(m.hfRepoId.toLowerCase()));
  if (same) return { model: same, same: true, earlier: false };
  const earlier = models.find((m) => wanted.some((n) => EARLIER_VERSIONS[n] === m.id));
  if (earlier) return { model: earlier, same: false, earlier: true };
  const fallback = models.find((m) => m.id === DEFAULT_JLENS_MODEL.id) ?? DEFAULT_JLENS_MODEL;
  return { model: fallback, same: false, earlier: false };
}

/** One message in Neuronpedia's lens chat shape. */
export interface JlensMessage {
  role: Message['role'];
  content: string;
  toolCalls?: { name: string; arguments?: Record<string, unknown>; id?: string }[];
  toolCallId?: string;
}

// Neuronpedia's share route limits (`/api/lens/share`).
const MAX_MESSAGES = 200;
const MAX_MESSAGE_CHARS = 10000;
const MAX_TOOL_CALLS = 64;
const MAX_ARGUMENT_CHARS = 10000;
const MAX_DESCRIPTION_CHARS = 512;
// Text is rarely more than 6 characters a token, so more than this is surely over the limit.
const MAX_CHARS_PER_TOKEN = 6;

// Encrypted reasoning (a Fernet token): no text for the lens to read.
const ENCRYPTED = /^gAAAAA[\w=.-]+$/;

export interface JlensChat {
  messages: JlensMessage[];
  hasToolCalls: boolean;
  hasThinking: boolean;
  /** Parts with no text (images, audio, files) that the lens cannot read. */
  dropped: number;
}

/**
 * A thread as lens chat. Thinking goes inline as `<think>…</think>`, which Qwen's template
 * reads as the turn's reasoning. `thinking: false` leaves it out.
 */
export function jlensChat(messages: Message[], { thinking }: { thinking: boolean }): JlensChat {
  let dropped = 0;
  let hasThinking = false;
  const out = messages.map((m): JlensMessage => {
    const text: string[] = [];
    const reasoning: string[] = [];
    for (const p of m.content) {
      if (p.type === 'text') text.push(p.text);
      else if (p.type === 'reasoning') {
        if (m.role === 'assistant' && p.text && !ENCRYPTED.test(p.text)) reasoning.push(p.text);
      } else dropped++;
    }
    hasThinking ||= reasoning.length > 0;
    let content = text.join('\n');
    // Qwen's template strips the newlines around the reasoning and before the reply. Neuronpedia
    // fails when the final message does not come out of the template as it went in.
    if (thinking && reasoning.length)
      content = `<think>\n${reasoning.join('\n').replace(/^\n+|\n+$/g, '')}\n</think>\n\n${content.replace(/^\n+/, '')}`;
    const message: JlensMessage = { role: m.role, content };
    if (m.role === 'assistant' && m.toolCalls?.length) {
      message.toolCalls = m.toolCalls.map((t) => ({
        name: t.function,
        ...(t.arguments ? { arguments: t.arguments as Record<string, unknown> } : {}),
        ...(t.id ? { id: t.id } : {}),
      }));
    }
    if (m.role === 'tool' && m.toolCallId) message.toolCallId = m.toolCallId;
    return message;
  });
  const hasToolCalls = out.some((m) => m.toolCalls || m.role === 'tool');
  return { messages: out, hasToolCalls, hasThinking, dropped };
}

/** About the tokens of an attempt's transcript without its thinking, from its token usage, or null.
 * It is high for a chat of many calls: each call counts its input again. */
export function jlensTokens(usage: TokenUsage | null | undefined): number | null {
  if (usage?.input == null || usage.output == null) return null;
  return usage.input + usage.output - (usage.reasoning ?? 0);
}

/** Why Neuronpedia would refuse this chat on a model with these lens limits, or null. */
export function jlensRefusal(messages: JlensMessage[], tokenLimit: number, charLimit?: number): string | null {
  if (!messages.length) return 'The transcript has no messages.';
  if (messages.length > MAX_MESSAGES) return `The transcript has more than ${MAX_MESSAGES} messages.`;
  const num = (n: number) => n.toLocaleString('en-US');
  const longest = Math.max(...messages.map((m) => m.content.length));
  if (longest > MAX_MESSAGE_CHARS)
    return `A message is longer than ${num(MAX_MESSAGE_CHARS)} characters (it has ${num(longest)}).`;
  if (
    messages.some(
      (m) =>
        (m.toolCalls?.length ?? 0) > MAX_TOOL_CALLS ||
        m.toolCalls?.some((t) => JSON.stringify(t.arguments ?? {}).length > MAX_ARGUMENT_CHARS),
    )
  )
    return 'A tool call is too large.';
  const chars = messages.reduce((n, m) => n + m.content.length + JSON.stringify(m.toolCalls ?? []).length, 0);
  if (charLimit && chars > charLimit)
    return `The transcript is longer than the ${num(charLimit)}-character limit (it has ${num(chars)} characters).`;
  if (chars > tokenLimit * MAX_CHARS_PER_TOKEN)
    return `The transcript is longer than the ${num(tokenLimit)}-token limit (it has ${num(chars)} characters, at least ${num(Math.ceil(chars / MAX_CHARS_PER_TOKEN))} tokens).`;
  return null;
}

/** Why a sample must not go to Neuronpedia, or null. Its shares are public to anyone with the link,
 * so only what any reader can read goes. */
export function jlensBlock(
  version: Pick<EvalVersion, 'sampleTerms'>,
  attempt: Pick<EvalAttempt, 'display' | 'hazard'> & { hidden?: true },
): string | null {
  if (!canReadHazard(attempt.hazard ?? null, { staff: false }))
    return 'This sample can give harmful help. Neuronpedia shares are public.';
  if (attempt.hidden || attemptRule(version, attempt) !== 'open')
    return 'The dataset terms limit who can read this sample. Neuronpedia shares are public.';
  return null;
}

/** One way to send a transcript: its messages, or why Neuronpedia would refuse it. */
export type JlensOption = { messages: JlensMessage[]; refusal: string | null };

/**
 * The transcript for the J-Lens button: with thinking (`full`) and, when it has thinking,
 * without (`bare`). The button checks each one against the token limit of its model. An option
 * that no model can read carries no messages.
 */
export function jlensProps(thread: Message[]) {
  const option = (chat: JlensChat): JlensOption => {
    const refusal = jlensRefusal(chat.messages, MAX_TOKEN_LIMIT);
    return { messages: refusal ? [] : chat.messages, refusal };
  };
  const full = jlensChat(thread, { thinking: true });
  return {
    hasToolCalls: full.hasToolCalls,
    full: option(full),
    ...(full.hasThinking ? { bare: option(jlensChat(thread, { thinking: false })) } : {}),
  };
}

/** What a share's description says about its sample. `modelName`: the model that wrote it. */
export interface JlensSource {
  evalName: string;
  sample: string;
  modelName: string;
  url: string;
}

/**
 * The share's description, as Markdown: the sample and its link, a warning when J-Lens runs on
 * another model than the one that wrote the transcript, then the request not to train on it,
 * with the canary. It cuts the first lines, not the last, to fit Neuronpedia's limit.
 */
export function jlensDescription(a: JlensSource & { model: JlensModel; same: boolean }): string {
  const lines = [`OpenAudit: ${a.evalName} ${a.sample} on ${a.modelName}. ${a.url}`];
  if (!a.same)
    lines.push(
      `**Warning:** ${a.modelName} wrote this transcript, but this J-Lens is running on ${a.model.label}. ` +
        `The lens shows how ${a.model.label} reads the text, not what ${a.modelName} computed.`,
    );
  // Two spaces before `\n` make a Markdown line break.
  const tail = `  \n${NO_TRAINING}  \n${CANARY}`;
  return lines.join('  \n').slice(0, MAX_DESCRIPTION_CHARS - tail.length) + tail;
}

/** The share request: a lens read-out over the chat as it is, with Neuronpedia's UI defaults. */
export function jlensShareBody(model: JlensModel, messages: JlensMessage[], description: string) {
  return {
    modelId: model.id,
    kind: 'chat',
    chat: messages,
    numCompletionTokens: 0,
    topN: 8,
    temperature: 0,
    lensColumns: model.lensColumns,
    hideNonWordTokens: true,
    description: description.slice(0, MAX_DESCRIPTION_CHARS),
  };
}
