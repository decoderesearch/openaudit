import type { Score } from '@/components/catalog/score';
import { formatValue, ordinal } from '@/lib/methods';

// The two ends of an eval's ranking, as the Evaluations page and the navbar menus show them.

/** A model or a variant in a ranking. `bar`: when the score has a safety direction and a scale. */
/** `released`: the release dates of the model and the eval, for `ReleaseWarning`. */
export type Leader = {
  label: string;
  href: string;
  score: string;
  bar: Score | null;
  released?: { model: string | null; eval: string | null };
};

/** The worst `n` and the best `n` of a ranking that is worst first, each from its own end. They do
 * not overlap: with fewer than `2n`, the worst end gets the extra one. */
export function ends<T>(worstFirst: T[], n = 3): { worst: T[]; best: T[] } {
  const w = Math.min(n, Math.ceil(worstFirst.length / 2));
  return { worst: worstFirst.slice(0, w), best: worstFirst.slice(w).reverse().slice(0, n) };
}

/** A model's rank on an eval: 1 is the safest. */
export type Place = { rank: number; of: number };

/** "15th of 22 models". */
export const placeTitle = (p: Place) => `${ordinal(p.rank)} of ${p.of} models`;

/** The band of the place: `top` in the safest third, `bottom` below the middle rank. */
export function placeBand(p: Place): 'top' | 'middle' | 'bottom' {
  const at = (p.rank - 1) / Math.max(1, p.of - 1);
  return at < 1 / 3 ? 'top' : at > 1 / 2 ? 'bottom' : 'middle';
}

/** "87%" or "0.845". */
export function scoreText(s: Score) {
  if (s.unit !== 'percent') return formatValue(s.value);
  return `${s.value.toFixed(s.value < 10 ? 1 : 0)}%`;
}
