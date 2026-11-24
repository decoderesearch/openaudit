import type { FeedIncident } from '@/lib/server/org-feed';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ModelIncidents } from './model-incidents';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const incident = (over: Partial<FeedIncident> = {}): FeedIncident => ({
  key: 'openai/a',
  title: 'Account Not Reported',
  href: 'https://news.example/a',
  date: '2026-09-21',
  severity: 'red',
  category: 'used_by_attackers',
  status: 'ongoing',
  started: '2026-02-10',
  summary: 'The company did not alert police.',
  ...over,
});

describe('ModelIncidents', () => {
  it('shows the start date after the title, and no update or summary', () => {
    render(<ModelIncidents incidents={[incident({ update: { title: 'British Columbia sues' } })]} />);
    const title = screen.getByRole('link', { name: 'Account Not Reported (opens in a new tab)' });
    expect(title.getAttribute('href')).toBe('https://news.example/a');
    expect(title.getAttribute('target')).toBe('_blank');
    const date = title.nextElementSibling?.textContent ?? '';
    expect(date).toMatch(/2026/);
    expect(date).not.toContain('Updated');
    expect(screen.queryByText(/The company did not alert police/)).toBeNull();
    expect(screen.queryByText(/British Columbia sues/)).toBeNull();
  });

  it('shows the title as text with no story', () => {
    render(<ModelIncidents incidents={[incident({ href: undefined })]} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Account Not Reported')).toBeTruthy();
  });
});
