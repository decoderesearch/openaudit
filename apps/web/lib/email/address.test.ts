import { describe, expect, it } from 'vitest';
import { inboxKey } from './address';

describe('inboxKey', () => {
  it('lowercases and trims', () => {
    expect(inboxKey('  Jane@Example.ORG ')).toBe('jane@example.org');
  });

  it('removes a +tag on any domain', () => {
    expect(inboxKey('jane+openaudit@example.org')).toBe('jane@example.org');
  });

  it('removes dots for Gmail only', () => {
    expect(inboxKey('q.e.j.u.w.o@gmail.com')).toBe('qejuwo@gmail.com');
    expect(inboxKey('j.lin+x@googlemail.com')).toBe('jlin@gmail.com');
    expect(inboxKey('j.lin@example.org')).toBe('j.lin@example.org');
  });

  it('keeps a value with no @ as it is', () => {
    expect(inboxKey('Not-An-Email')).toBe('not-an-email');
  });
});
