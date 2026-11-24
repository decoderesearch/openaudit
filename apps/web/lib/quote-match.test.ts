import { quoteMatches } from '@/lib/quote-match';
import { describe, expect, it } from 'vitest';

describe('quoteMatches', () => {
  it('ignores case, spacing and punctuation', () => {
    const text = 'Table 3: MASK   honesty — 91.2%\nrate on the API.';
    expect(quoteMatches(text, 'mask honesty 91.2% rate')).toEqual([{ index: 9, length: 27 }]);
  });

  it('skips zero-width spaces', () => {
    expect(quoteMatches('Sys\u200Btem Card', 'System card')).toEqual([{ index: 0, length: 12 }]);
  });

  it('finds every place, and nothing for an empty quote', () => {
    expect(quoteMatches('ab ab', 'ab').map((m) => m.index)).toEqual([0, 3]);
    expect(quoteMatches('ab', '...')).toEqual([]);
  });
});
