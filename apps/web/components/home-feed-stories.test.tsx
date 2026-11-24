import { HomeOrgStory } from '@/components/home-feed-stories';
import type { HomeOrg } from '@/lib/server/home-orgs';
import type { OrgDeparture } from '@openaudit/spec';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('HomeOrgStory', () => {
  const org: HomeOrg = {
    key: '/acme',
    label: 'Acme',
    href: '/acme',
    date: '2026-10-15',
    incidents: 7,
    audits: 0,
    recent: [
      {
        key: 'acme/a',
        title: 'Incident a',
        href: 'https://news.example/a',
        date: '2026-10-15',
        severity: 'red',
        category: 'model_hacking',
        status: 'ongoing',
        started: '2026-10-15',
        summary: '',
      },
    ],
    leavers: [],
  };
  const leaver = (name: string) =>
    ({
      name,
      kind: 'resigned',
      departedDate: '2026-09-02',
      datePrecision: 'day',
      sources: [],
    }) as unknown as OrgDeparture;

  it('shows the org, its incident count, and each incident under its category and date', () => {
    const { container } = render(<HomeOrgStory org={org} />);
    expect(screen.getByRole('link', { name: 'Acme' }).getAttribute('href')).toBe('/acme');
    expect(screen.getByRole('link', { name: '7 Incidents' }).getAttribute('href')).toBe('/acme');
    const rows = [...container.querySelectorAll('li')];
    expect(rows.map((li) => li.querySelector('span')!.textContent)).toEqual([
      expect.stringMatching(/^Model Hacking·Oct 15/),
    ]);
    expect(rows[0].hasAttribute('data-own-link')).toBe(true);
    expect(screen.queryByRole('list', { name: 'Departures' })).toBeNull();
  });

  it('shows all departures, the newest first', () => {
    const names = Array.from({ length: 21 }, (_, i) => `Person ${i}`);
    render(<HomeOrgStory org={{ ...org, leavers: names.map(leaver) }} />);
    const items = [...screen.getByRole('list', { name: 'Departures' }).children];
    expect(items).toHaveLength(21);
    expect(items[0].querySelector('[aria-label]')!.getAttribute('aria-label')).toBe('Person 0: Resigned');
  });
});
