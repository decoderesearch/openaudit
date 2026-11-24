import { describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ method: { findMany: vi.fn() } }));
vi.mock('@/lib/db', () => ({ prisma: db }));

import { methodDate, methodsWithVariants } from './nav-methods';

const link = (title: string, url = 'https://example.com') => ({ kind: 'paper' as const, title, url });

describe('methodDate', () => {
  it('takes the newest date of the method links', () => {
    const links = [link('A (2020)'), link('B et al., Title', 'https://arxiv.org/abs/2606.12618'), link('C (2026)')];
    expect(methodDate(links, [{ date: '2027-01' }])).toBe('2026-06');
  });

  it('takes the newest variant date when no method link has a date', () => {
    expect(methodDate([link('Code')], [{ date: '2024-06' }, { date: null }, { date: '2025-02' }])).toBe('2025-02');
    expect(methodDate([], [{ date: null }])).toBeNull();
  });
});

describe('methodsWithVariants', () => {
  it('puts the newest method first, and methods with no date last', async () => {
    const method = (slug: string, links: object[], variantLinks: object[] = []) => ({
      slug,
      displayName: slug.toUpperCase(),
      group: 'white_box',
      summary: '',
      links,
      variants: [{ slug: 'v', displayName: 'V', summary: null, links: variantLinks }],
    });
    db.method.findMany.mockResolvedValue([
      method('a', [link('A (2023)')]),
      method('b', []),
      method('c', [link('Code')], [link('V (March 2026)')]),
      method('d', [link('D (July 2026)')]),
    ]);
    expect((await methodsWithVariants()).map((m) => m.label)).toEqual(['D', 'C', 'A', 'B']);
  });
});
