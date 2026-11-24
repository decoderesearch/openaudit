import { describe, expect, it } from 'vitest';
import { MODEL_SORTS, ORG_SORTS, sortCards, sortedEndpoint, sortOf, type ModelSort } from './home-sorts';

describe('sortOf', () => {
  it('keeps a known sort, and uses the first for others', () => {
    expect(sortOf(MODEL_SORTS, 'rating-asc')).toBe('rating-asc');
    expect(sortOf(MODEL_SORTS, null)).toBe('date');
    expect(sortOf(MODEL_SORTS, 'toString')).toBe('date');
    expect(sortOf(ORG_SORTS, 'departures')).toBe('departures');
  });
});

describe('sortedEndpoint', () => {
  it('adds the sort, but not the default', () => {
    expect(sortedEndpoint('/api/home-models', MODEL_SORTS, 'date')).toBe('/api/home-models');
    expect(sortedEndpoint('/api/home-models', MODEL_SORTS, 'flagged')).toBe('/api/home-models?sort=flagged');
    expect(sortedEndpoint('/api/home-orgs?size=12', ORG_SORTS, 'incidents')).toBe(
      '/api/home-orgs?size=12&sort=incidents',
    );
  });
});

const card = (key: string, date: string, flagged: number, meter: number | null) => ({
  key,
  date,
  meter,
  counts: { high: flagged, medium: 0, low: 0 },
});
const CARDS = [card('a', '2026-10-01', 5, 0.4), card('b', '2026-10-03', 2, null), card('c', '2026-09-01', 5, 0.9)];
const keys = (sort: ModelSort) => sortCards(CARDS, sort).map((c) => c.key);

describe('sortCards', () => {
  it('sorts by date, the newest first', () => {
    expect(keys('date')).toEqual(['b', 'a', 'c']);
  });

  it('sorts by flagged chats, the newest first on a tie', () => {
    expect(keys('flagged')).toEqual(['a', 'c', 'b']);
    expect(keys('flagged-asc')).toEqual(['b', 'a', 'c']);
  });

  it('sorts by rating, with no rating last both ways', () => {
    expect(keys('rating')).toEqual(['c', 'a', 'b']);
    expect(keys('rating-asc')).toEqual(['a', 'c', 'b']);
  });
});
