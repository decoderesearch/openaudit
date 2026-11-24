import type { Message } from '@openaudit/spec';

export type ThreadSide = 'target' | 'auditor';

/** The URL hash of a message: "message-3" in the eval chat, "auditor-message-3" on the auditor side. */
export const messageAnchor = (side: ThreadSide, index: number) =>
  `${side === 'auditor' ? 'auditor-' : ''}message-${index}`;

/** The side and message number in a URL hash, else undefined. */
export function parseMessageAnchor(hash: string): { side: ThreadSide; index: number } | undefined {
  const m = /^#?(auditor-)?message-(\d{1,6})$/.exec(hash);
  return m ? { side: m[1] ? 'auditor' : 'target', index: Number(m[2]) } : undefined;
}

/** A message as plain text to copy: its text parts, then each tool call with its arguments. */
export function messageText(m: Message): string {
  const text = m.content.flatMap((p) => (p.type === 'text' ? [p.text] : []));
  const calls = (m.toolCalls ?? []).map(
    (t) => `Tool call: ${t.function}\n${JSON.stringify(t.arguments ?? {}, null, 2)}`,
  );
  return [...text, ...calls].join('\n\n');
}
