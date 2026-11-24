import { describe, expect, it } from 'vitest';
import { normalizeWebsite, safeReturnTo } from './urls';

describe('normalizeWebsite', () => {
  it('adds https:// when there is no scheme', () => {
    expect(normalizeWebsite(' example.com ')).toBe('https://example.com');
    expect(normalizeWebsite('www.lab.ac.uk/people/jlin')).toBe('https://www.lab.ac.uk/people/jlin');
    expect(normalizeWebsite('example.com:8080/x?y=1')).toBe('https://example.com:8080/x?y=1');
  });

  it('keeps an http(s) scheme as typed', () => {
    expect(normalizeWebsite('https://example.com')).toBe('https://example.com');
    expect(normalizeWebsite('HTTP://example.com/a')).toBe('http://example.com/a');
  });

  it('returns empty for empty input', () => {
    expect(normalizeWebsite('   ')).toBe('');
  });

  it('refuses what is not a web address', () => {
    for (const v of [
      'javascript:alert(1)',
      'mailto:a@example.com',
      'ftp://example.com',
      'data:text/html,hi',
      'localhost',
      'example',
      'exa mple.com',
      'https://user:pass@example.com',
    ]) {
      expect(normalizeWebsite(v), v).toBeNull();
    }
  });
});

describe('safeReturnTo', () => {
  it('keeps same-site paths', () => {
    expect(safeReturnTo('/settings?tab=keys')).toBe('/settings?tab=keys');
  });

  it('refuses other origins and empty values', () => {
    for (const v of ['https://evil.example', '//evil.example', '/\\evil.example', '', undefined, null]) {
      expect(safeReturnTo(v, '/home')).toBe('/home');
    }
  });
});
