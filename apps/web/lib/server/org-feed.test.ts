import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ prisma: {} }));

const { filterFeed } = await import('./org-feed');
type Entry = Parameters<typeof filterFeed>[0][number];

const incident = (title: string, severity: 'red' | 'orange' | 'yellow') =>
  ({
    key: `o/${title}`,
    title,
    href: `https://news.example/${title}`,
    date: '',
    severity,
    category: 'data_exposed',
    status: 'ongoing',
    started: '',
    summary: '',
  }) as const;
const entry = (key: string, date: string, incidents: Entry['incidents'], departures: string[] = []): Entry => ({
  key,
  label: key,
  href: `/${key}`,
  date,
  incidents,
  departures: departures.map((name) => ({ name, href: '', date, kind: 'resigned' })),
});

const FEED = [
  entry('a', '2026-10-01', [incident('a1', 'red'), incident('a2', 'yellow')], ['Ann']),
  entry('b', '2026-09-01', [incident('b1', 'orange')]),
  entry('c', '2026-08-01', [incident('c1', 'red')]),
];

describe('filterFeed', () => {
  it('keeps all with no filter', () => {
    expect(filterFeed(FEED, null)).toBe(FEED);
  });

  it('keeps only departures', () => {
    const left = filterFeed(FEED, 'departure');
    expect(left.map((e) => [e.key, e.incidents.length, e.departures.map((d) => d.name)])).toEqual([['a', 0, ['Ann']]]);
  });
});
