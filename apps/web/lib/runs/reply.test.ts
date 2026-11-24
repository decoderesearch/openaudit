import type { Message } from '@openaudit/spec';
import { describe, expect, it } from 'vitest';
import { OUTPUT_ID, withReply } from './reply';

const user: Message = { id: 'm1', role: 'user', content: [{ type: 'text', text: 'Yes or no?' }] };
const reply: Message = { id: 'm2', role: 'assistant', content: [{ type: 'text', text: 'No.' }] };

describe('withReply', () => {
  it('adds the attempt output when the transcript has no reply', () => {
    const out = withReply([user], 'Yes');
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ id: OUTPUT_ID, role: 'assistant', content: [{ type: 'text', text: 'Yes' }] });
  });

  it('keeps the transcript when it has a reply or there is no output', () => {
    expect(withReply([user, reply], 'Yes')).toEqual([user, reply]);
    expect(withReply([user], null)).toEqual([user]);
    expect(withReply([user, reply, user], 'Yes').at(-1)).toMatchObject({ id: OUTPUT_ID });
  });
});
