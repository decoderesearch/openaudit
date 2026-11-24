import { describe, expect, it } from 'vitest';
import { parseEmail, parseLists } from './updates';

describe('parseEmail', () => {
  it('trims and lowers an address', () => {
    expect(parseEmail('  Ana@Example.COM ')).toBe('ana@example.com');
  });

  it('refuses what is not an address', () => {
    for (const v of ['', 'ana', 'ana@', 'ana@example', 'a b@example.com', 42, null, `${'a'.repeat(250)}@x.io`])
      expect(parseEmail(v)).toBeNull();
  });
});

describe('parseLists', () => {
  it('keeps known lists once each, in list order', () => {
    expect(parseLists(['evals', 'nope', 'incidents', 'evals'])).toEqual(['incidents', 'evals']);
  });

  it('gives none for a value that is not an array', () => {
    expect(parseLists('incidents')).toEqual([]);
    expect(parseLists(undefined)).toEqual([]);
  });
});
