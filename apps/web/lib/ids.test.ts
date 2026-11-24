import { describe, expect, it } from 'vitest';
import { fromUrlId, isUuid, newId, parseId, toUrlId, URL_ID_LENGTH } from './ids';

describe('ids', () => {
  it('makes time-ordered UUIDv7s', () => {
    const a = newId();
    const b = newId();
    expect(isUuid(a)).toBe(true);
    expect(a[14]).toBe('7');
    expect(a < b).toBe(true);
  });

  it('round-trips through the URL form at a fixed length', () => {
    for (const uuid of [
      newId(),
      '00000000-0000-0000-0000-000000000000',
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
      '01999999-0000-7000-8000-000000000001',
    ]) {
      const url = toUrlId(uuid);
      expect(url).toHaveLength(URL_ID_LENGTH);
      expect(fromUrlId(url)).toBe(uuid);
    }
  });

  it('keeps sort order in the URL form', () => {
    const ids = Array.from({ length: 50 }, newId);
    const urls = ids.map(toUrlId);
    expect([...urls].sort()).toEqual(urls);
  });

  it('refuses values that are not ids', () => {
    expect(fromUrlId('short')).toBeNull();
    expect(fromUrlId('0'.repeat(URL_ID_LENGTH))).toBeNull();
    expect(fromUrlId('z'.repeat(URL_ID_LENGTH))).toBeNull();
    expect(parseId('jlin-honesty-4')).toBeNull();
    expect(() => toUrlId('nope')).toThrow();
  });

  it('parses either form', () => {
    const uuid = newId();
    expect(parseId(uuid.toUpperCase())).toBe(uuid);
    expect(parseId(toUrlId(uuid))).toBe(uuid);
  });
});
