import type { Message } from '@openaudit/spec';

export const OUTPUT_ID = 'attempt-output';

/** Some solvers (MASK, RealToxicityPrompts) keep the reply out of the messages; the attempt has it. */
export function withReply(messages: Message[], output?: string | null): Message[] {
  if (!output || !messages.length || messages.at(-1)?.role === 'assistant') return messages;
  return [...messages, { id: OUTPUT_ID, role: 'assistant', content: [{ type: 'text', text: output }] }];
}
