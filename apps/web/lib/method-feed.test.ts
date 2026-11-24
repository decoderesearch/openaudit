import type { MenuEval } from '@/components/nav/menu-evals';
import { mostFirsts, topOf } from '@/lib/method-feed';
import { describe, expect, it } from 'vitest';

const leader = (label: string) => ({ label, href: `/methods/m/${label}`, score: '0.5', bar: null });
const compares = { key: 'sae', label: 'Sparse Autoencoders', href: '/methods/sae', tagline: null, about: '' };
const evalOf = (slug: string, top: string[] | null, best: string[] = []): MenuEval => ({
  label: slug.toUpperCase(),
  slug,
  href: `/evaluations/${slug}`,
  creator: 'Lab',
  topic: null,
  worst: [],
  best: best.map(leader),
  top: top?.map(leader),
  compares,
  updated: '2026-10-16',
});
const labels = (top: { label: string }[]) => top.map((t) => t.label);

describe('topOf', () => {
  it('gives the top list, else the best list, as labels and links', () => {
    expect(topOf(evalOf('a', ['A', 'B']))).toEqual([
      { label: 'A', href: '/methods/m/A' },
      { label: 'B', href: '/methods/m/B' },
    ]);
    expect(labels(topOf(evalOf('b', null, ['C'])))).toEqual(['C']);
  });
});

describe('mostFirsts', () => {
  it('gives the 3 with the most first places, then by label', () => {
    const evals = [evalOf('a', ['X', 'Y']), evalOf('b', ['Y', 'X']), evalOf('c', ['X']), evalOf('d', ['Z']), evalOf('e', ['W'])];
    expect(labels(mostFirsts(evals))).toEqual(['X', 'W', 'Y']);
  });
});
