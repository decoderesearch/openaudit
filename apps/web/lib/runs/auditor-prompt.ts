import type { Message } from '@openaudit/spec';

/** The seed instructions in the auditor's seed prompt, else the whole prompt. */
export const seedOf = (text: string) =>
  /<seed_instructions>([\s\S]*?)<\/seed_instructions>/.exec(text)?.[1]?.trim() ?? text;

/** The auditor's instructions: its messages before its first reply, as text. */
export function promptOf(messages: Message[]) {
  const end = messages.findIndex((m) => m.role === 'assistant');
  return messages.slice(0, end < 0 ? undefined : end).map((m) => ({
    role: m.role,
    text: m.content.flatMap((p) => (p.type === 'text' ? [p.text] : [])).join('\n\n'),
  }));
}
