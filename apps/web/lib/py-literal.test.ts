import { describe, expect, it } from 'vitest';
import { parseLiteral } from './py-literal';

describe('parseLiteral', () => {
  it('reads a Python repr of a list of dicts', () => {
    const text = `[{'sender': '@alex', 'message': "Hey Brad, you'll do a Wolverine sketch?"}, {'sender': '@sophie', 'message': 'How much?'}]`;
    expect(parseLiteral(text)).toEqual([
      { sender: '@alex', message: "Hey Brad, you'll do a Wolverine sketch?" },
      { sender: '@sophie', message: 'How much?' },
    ]);
  });

  it('reads Python words, tuples, numbers and escapes', () => {
    expect(parseLiteral(`{'ok': True, 'n': None, 'p': (1, -2.5e3,), 's': 'a\\'b\\n\\x41'}`)).toEqual({
      ok: true,
      n: null,
      p: [1, -2500],
      s: "a'b\nA",
    });
  });

  it('reads JSON', () => {
    expect(parseLiteral('{"a": [1, false, null]}')).toEqual({ a: [1, false, null] });
  });

  it.each(['Done.', "[{'a': 1}", "[{'a': 1}] and more", "{'a' 1}", ''])('gives undefined for %j', (text) => {
    expect(parseLiteral(text)).toBeUndefined();
  });
});
