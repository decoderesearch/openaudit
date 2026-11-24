import { describe, expect, it } from 'vitest';
import { clientIp } from './rate-limit';

describe('clientIp', () => {
  it('takes the first forwarded address, then x-real-ip, then loopback', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4');
    expect(clientIp(new Headers({ 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8');
    expect(clientIp(new Headers())).toBe('127.0.0.1');
  });

  it('on Workers, takes only cf-connecting-ip, never a client-sent x-forwarded-for', () => {
    const headers = new Headers({ 'x-forwarded-for': '6.6.6.6, 1.2.3.4', 'cf-connecting-ip': '1.2.3.4' });
    expect(clientIp(headers, ['cf-connecting-ip'])).toBe('1.2.3.4');
    expect(clientIp(new Headers({ 'x-forwarded-for': '6.6.6.6' }), ['cf-connecting-ip'])).toBe('127.0.0.1');
  });
});
