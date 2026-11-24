import { compact } from '@/lib/compact-json';
import { ipBucket } from '@/lib/rate-limit';
import { describe, expect, it } from 'vitest';

describe('ipBucket', () => {
  it('keeps an IPv4 address whole', () => {
    expect(ipBucket('203.0.113.7')).toBe('203.0.113.7');
  });
  it('puts IPv6 addresses in the same /64 together', () => {
    expect(ipBucket('2001:db8:1:2:aaaa::1')).toBe('2001:db8:1:2::/64');
    expect(ipBucket('2001:db8:1:2:bbbb:cccc:dddd:eeee')).toBe('2001:db8:1:2::/64');
  });
  it('expands :: before it takes the prefix', () => {
    expect(ipBucket('2001:db8::1')).toBe('2001:db8:0:0::/64');
  });
});

describe('compact', () => {
  it('drops ids, extraction details and empty values', () => {
    const out = JSON.parse(
      compact({ id: 'x', name: 'A', extraction: { by: 'y' }, tags: [], note: '', gone: null, nested: { pdfPage: 3 } }),
    );
    expect(out).toEqual({ name: 'A' });
  });
  it('keeps pages, quotes and zero values', () => {
    expect(JSON.parse(compact({ source: { page: '44', quote: 'q' }, value: 0, safe: false }))).toEqual({
      source: { page: '44', quote: 'q' },
      value: 0,
      safe: false,
    });
  });
});
