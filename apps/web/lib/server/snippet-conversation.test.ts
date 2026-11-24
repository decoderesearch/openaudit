import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ prisma: {} }));
vi.mock('@/lib/server/r2', () => ({ r2Get: vi.fn() }));

import type { Transcript } from '@openaudit/spec';
import { conversationOf } from './snippet-conversation';

const transcript = (messages: unknown[]) =>
  ({
    id: 't',
    participants: [
      { id: 'a', role: 'auditor' },
      { id: 't', role: 'target' },
    ],
    threads: [
      {
        id: '1',
        participant: 'a',
        messages: [{ id: 'x', role: 'user', content: [{ type: 'text', text: 'auditor' }] }],
      },
      { id: '2', participant: 't', messages },
    ],
  }) as unknown as Transcript;

describe('conversationOf', () => {
  it('numbers the target thread as the flagger read it', () => {
    const out = conversationOf(
      transcript([
        { id: '1', role: 'user', content: [{ type: 'text', text: 'Hi' }] },
        {
          id: '2',
          role: 'assistant',
          content: [
            { type: 'reasoning', kind: 'summary', text: 'Think.' },
            { type: 'reasoning', kind: 'redacted', text: 'gAAAAABxyz' },
            { type: 'text', text: 'Hello' },
          ],
          toolCalls: [{ id: 'c', function: 'send', arguments: { to: 'b', cc: [1, 2] } }],
        },
      ]),
    );
    expect(out).toEqual([
      { index: 0, role: 'user', text: 'Hi' },
      {
        index: 1,
        role: 'assistant',
        text: '<thinking>\nThink.\n</thinking>\nHello\n[tool call send: {"to": "b", "cc": [1, 2]}]',
      },
    ]);
  });

  it('adds the output as the reply when the thread has none', () => {
    const out = conversationOf(transcript([{ id: '1', role: 'user', content: [{ type: 'text', text: 'Hi' }] }]), 'Bye');
    expect(out.at(-1)).toEqual({ index: 1, role: 'assistant', text: 'Bye' });
  });
});
