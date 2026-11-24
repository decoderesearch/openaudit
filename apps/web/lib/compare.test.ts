import { bestOf, compareHref, compareLatestHref, compareParams, modelNameOf } from '@/lib/compare';
import { describe, expect, it } from 'vitest';

describe('compareParams', () => {
  it('reads id1 to id5 in order, with no empty or repeated names', () => {
    expect(compareParams({ id2: 'b/b', id1: 'a/a', id3: '', id4: 'a/a', id5: ' c/c ', id6: 'd/d' })).toEqual([
      'a/a',
      'b/b',
      'c/c',
    ]);
  });

  it('skips values that are not strings', () => {
    expect(compareParams({ id1: ['a/a', 'b/b'], id2: 'b/b' })).toEqual(['b/b']);
  });
});

describe('compareHref', () => {
  it('numbers the names from 1 and keeps the slash', () => {
    expect(compareHref(['NousResearch/Arete-27B', 'x/a b'])).toBe(
      '/models/compare?id1=NousResearch/Arete-27B&id2=x/a%20b',
    );
  });

  it('is the bare page with no names', () => {
    expect(compareHref([])).toBe('/models/compare');
  });

  it('reads back as the same names', () => {
    const names = ['a/b&c', 'd/e=f'];
    const q = new URLSearchParams(compareHref(names).split('?')[1]);
    expect(compareParams(Object.fromEntries(q))).toEqual(names);
  });
});

describe('compareLatestHref', () => {
  it('compares the 2 newest cards, the newest first', () => {
    const cards = [
      { href: '/a/old', date: '2026-01-01' },
      { href: '/b/new%20one', date: '2026-03-01' },
      { href: '/c/mid', date: '2026-02-01' },
    ];
    expect(compareLatestHref(cards)).toBe('/models/compare?id1=b/new%20one&id2=c/mid');
    expect(modelNameOf(cards[1]!.href)).toBe('b/new one');
  });
});

describe('bestOf', () => {
  it('marks each lowest or highest value', () => {
    expect(bestOf([3, 1, 1, null], 'min')).toEqual([false, true, true, false]);
    expect(bestOf([3, 1, undefined], 'max')).toEqual([true, false, false]);
  });

  it('marks nothing with fewer than 2 values, or when all values are the same', () => {
    expect(bestOf([5, null], 'min')).toEqual([false, false]);
    expect(bestOf([2, 2, null], 'max')).toEqual([false, false, false]);
  });
});
