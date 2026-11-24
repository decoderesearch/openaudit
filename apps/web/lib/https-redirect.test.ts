import { describe, expect, it } from 'vitest';
import { httpsRedirect } from './https-redirect';

describe('httpsRedirect', () => {
  it('sends http to https with the same path and query', () => {
    const res = httpsRedirect(new Request('http://openaudit.com/meta?tab=departures'));
    expect(res?.status).toBe(308);
    expect(res?.headers.get('location')).toBe('https://openaudit.com/meta?tab=departures');
  });

  it('lets https and local previews through', () => {
    expect(httpsRedirect(new Request('https://openaudit.com/meta'))).toBeNull();
    expect(httpsRedirect(new Request('http://localhost:8787/'))).toBeNull();
    expect(httpsRedirect(new Request('http://127.0.0.1:8787/'))).toBeNull();
  });
});
