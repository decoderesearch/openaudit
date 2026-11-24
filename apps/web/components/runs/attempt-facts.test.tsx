import type { Message } from '@openaudit/spec';
import { describe, expect, it } from 'vitest';
import { fullInput } from './attempt-facts';

const text = (role: Message['role'], t: string): Message => ({
  id: `${role}-${t}`,
  role,
  content: [{ type: 'text', text: t }],
});

describe('fullInput', () => {
  const whole = 'Read the document.\n\n' + 'x'.repeat(100);
  const clipped = whole.slice(0, 40) + '…';

  it("gives the target's first user message when the input is clipped", () => {
    expect(fullInput(clipped, [text('system', 'Be brief.'), text('user', whole)])).toBe(whole);
  });

  it('keeps the input when it is whole, or when the message does not start with it', () => {
    expect(fullInput('Hi…', [text('user', 'Hi… there')])).toBe('Hi… there');
    expect(fullInput('Short.', [text('user', whole)])).toBe('Short.');
    expect(fullInput(clipped, [text('user', 'Answer this: ' + whole)])).toBe(clipped);
    expect(fullInput(clipped, [])).toBe(clipped);
  });
});
