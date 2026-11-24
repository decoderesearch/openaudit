import { sortOrgs } from '@/lib/home-sorts';
import type { OrgDeparture } from '@openaudit/spec';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ prisma: {} }));

const { homeOrgs } = await import('./home-orgs');
type HomeOrg = ReturnType<typeof homeOrgs>[number];
type Entry = Parameters<typeof homeOrgs>[0][number];

const incident = (title: string, date: string) =>
  ({
    key: title,
    title,
    date,
    severity: 'red',
    category: 'data_exposed',
    status: 'ongoing',
    started: date,
    summary: '',
  }) as const;
const entry = (org: string, date: string, incidents: string[], departures: string[] = []): Entry => ({
  key: `${org} ${date}`,
  label: org,
  href: `/${org}`,
  date,
  incidents: incidents.map((t) => incident(t, date)),
  departures: departures.map((name) => ({ name, date, kind: 'resigned' })),
});

// Newest first, as `orgFeed` gives it.
const FEED = [
  entry('a', '2026-10-05', [], ['Ann']),
  entry('b', '2026-10-03', ['b1', 'b2']),
  entry('a', '2026-10-01', ['a1']),
  entry('c', '2026-09-30', [], ['Cy']),
  entry('b', '2026-09-01', ['b3', 'b4']),
  entry('a', '2026-08-01', ['a2', 'a3']),
  entry('d', '2026-07-01', ['d1']),
];
const leaver = (name: string) => ({ name, kind: 'resigned', sources: [] }) as unknown as OrgDeparture;
const INFO = new Map([
  ['/a', { incidents: 5, leavers: [leaver('Ann'), leaver('Bo')] }],
  ['/b', { incidents: 4, leavers: [] }],
  ['/d', { incidents: 1, leavers: [leaver('Di')] }],
]);

describe('homeOrgs', () => {
  const orgs = homeOrgs(FEED, INFO);

  it('sorts the orgs with departures first, then by the newest incident, with no incidents last', () => {
    expect(orgs.map((o) => [o.label, o.date])).toEqual([
      ['a', '2026-10-01'],
      ['d', '2026-07-01'],
      ['b', '2026-10-03'],
      ['c', '2026-09-30'],
    ]);
  });

  it('keeps the 3 newest incidents of each org', () => {
    expect(orgs.map((o) => o.recent.map((i) => i.title))).toEqual([['a1', 'a2', 'a3'], ['d1'], ['b1', 'b2', 'b3'], []]);
  });

  it('gives the incident count and the departures of each org, none with no info', () => {
    expect(orgs.map((o) => [o.incidents, o.leavers.map((d) => d.name)])).toEqual([
      [5, ['Ann', 'Bo']],
      [1, ['Di']],
      [4, []],
      [0, []],
    ]);
  });
});

describe('sortOrgs', () => {
  it('puts the most commitment points first, and none last', () => {
    const points = (label: string, p?: number) => ({
      label,
      date: '',
      incidents: 0,
      leavers: [],
      ...(p !== undefined && { commitments: { points: p } as HomeOrg['commitments'] }),
    });
    const list = [points('a'), points('b', 3), points('c', 0), points('d', 7.5)];
    expect(sortOrgs(list, 'commitments').map((o) => o.label)).toEqual(['d', 'b', 'c', 'a']);
  });

  const orgs = homeOrgs(FEED, INFO);
  const labels = (sort: Parameters<typeof sortOrgs>[1]) => sortOrgs(orgs, sort).map((o) => o.label);

  it('keeps the order for date, and puts the most incidents or departures first', () => {
    expect(labels('date')).toEqual(['a', 'd', 'b', 'c']);
    expect(labels('incidents')).toEqual(['a', 'b', 'd', 'c']);
    expect(labels('departures')).toEqual(['a', 'd', 'b', 'c']);
  });
});
