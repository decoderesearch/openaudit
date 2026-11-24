// Finds an extracted quote in page text. Like spec/scripts/sources.mjs (keep the two the same), it
// ignores case, spaces, punctuation and zero-width marks, so a PDF's layout does not matter.

const SKIP = /[\p{P}\p{S}\p{Z}\p{Cf}\s]+/gu;

/** Each place `quote` is in `text`, as indexes into `text`. */
export function quoteMatches(text: string, quote: string): { index: number; length: number }[] {
  const q = quote.normalize('NFKC').toLowerCase().replace(SKIP, '');
  if (!q) return [];
  // The squashed text, and for each of its code units, the index in `text` it came from.
  let squashed = '';
  const from: number[] = [];
  for (let i = 0; i < text.length;) {
    const ch = String.fromCodePoint(text.codePointAt(i)!);
    const kept = ch.normalize('NFKC').toLowerCase().replace(SKIP, '');
    squashed += kept;
    for (let j = 0; j < kept.length; j++) from.push(i);
    i += ch.length;
  }
  const out: { index: number; length: number }[] = [];
  for (let at = squashed.indexOf(q); at !== -1; at = squashed.indexOf(q, at + 1)) {
    const start = from[at];
    out.push({ index: start, length: from[at + q.length - 1] - start + 1 });
  }
  return out;
}
