import type { Message } from '@openaudit/spec';
import { describe, expect, it } from 'vitest';
import { messageAnchor, messageText, parseMessageAnchor } from './message-link';

describe('message links', () => {
  it('round-trips an anchor for each side', () => {
    expect(messageAnchor('target', 3)).toBe('message-3');
    expect(messageAnchor('auditor', 12)).toBe('auditor-message-12');
    expect(parseMessageAnchor('#message-3')).toEqual({ side: 'target', index: 3 });
    expect(parseMessageAnchor('#auditor-message-12')).toEqual({ side: 'auditor', index: 12 });
    expect(parseMessageAnchor('#other')).toBeUndefined();
    expect(parseMessageAnchor('')).toBeUndefined();
  });

  it('copies text parts and tool calls, not thinking', () => {
    const m = {
      id: 'm1',
      role: 'assistant',
      content: [
        { type: 'reasoning', kind: 'summary', text: 'hidden' },
        { type: 'text', text: 'Hello' },
      ],
      toolCalls: [{ id: 't1', function: 'search', arguments: { q: 'x' } }],
    } as unknown as Message;
    expect(messageText(m)).toBe('Hello\n\nTool call: search\n{\n  "q": "x"\n}');
  });
});
