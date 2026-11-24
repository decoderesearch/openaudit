import { describe, expect, it } from 'vitest';
import { handleError, normalizeHandle, suggestHandle } from './handles';

describe('handles', () => {
  it('accepts lowercase letters, digits and underscores', () => {
    for (const h of ['jlin', 'decode_research', 'a1b', 'x'.repeat(30)]) {
      expect(handleError(h)).toBeNull();
    }
  });

  it('refuses bad length, characters, edges and reserved names', () => {
    expect(handleError('ab')).toMatch(/3 to 30/);
    expect(handleError('x'.repeat(31))).toMatch(/3 to 30/);
    expect(handleError('j-lin')).toMatch(/lowercase/);
    expect(handleError('JLin')).toMatch(/lowercase/);
    expect(handleError('_jlin')).toMatch(/underscore/);
    expect(handleError('admin')).toMatch(/reserved/);
  });

  it('normalizes case and whitespace', () => {
    expect(normalizeHandle('  JLin ')).toBe('jlin');
  });

  it('suggests a valid handle from a display name', () => {
    expect(suggestHandle('Decode Research!')).toBe('decode_research');
    expect(suggestHandle('  --Acme  AI--  ')).toBe('acme_ai');
    const long = suggestHandle('The Very Long Name Of A Research Group Somewhere');
    expect(handleError(long)).toBeNull();
  });
});
