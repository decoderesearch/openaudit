import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CSS = "src: url(https://fonts.example/inter.ttf) format('truetype');";

let fetches = 0;
let fail = false;

beforeEach(() => {
  vi.resetModules();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  fetches = 0;
  fail = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      fetches++;
      if (fail) throw new Error('down');
      return url.includes('googleapis') ? new Response(CSS) : new Response(new ArrayBuffer(4));
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ogFonts', () => {
  it('gives each call at the same time its own load, then keeps the loaded fonts', async () => {
    const { ogFonts } = await import('./fonts');
    const [a, b] = await Promise.all([ogFonts(), ogFonts()]);
    expect(a.map((f) => f.weight)).toEqual([400, 600, 700]);
    expect(b).toHaveLength(3);
    expect(fetches).toBe(12);
    await ogFonts();
    expect(fetches).toBe(12);
  });

  it('gives no fonts when the load fails, and tries again on the next call', async () => {
    const { ogFonts } = await import('./fonts');
    fail = true;
    expect(await ogFonts()).toEqual([]);
    fail = false;
    expect(await ogFonts()).toHaveLength(3);
  });
});
