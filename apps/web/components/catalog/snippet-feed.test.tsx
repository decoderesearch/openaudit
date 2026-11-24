import { SnippetFeedRow } from '@/components/catalog/snippet-feed';
import type { SnippetRef } from '@/components/evidence-hover';
import type { SnippetFeedEntry } from '@/lib/server/snippet-feed';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

const chat = (id: string, title: string, locked: boolean): SnippetRef => ({
  id,
  href: `/runs/r/attempts/${id}`,
  evalName: 'FORTRESS',
  ordinal: 1,
  sample: { id: '1' },
  category: 'harmful_requests',
  topics: [],
  severity: 'medium',
  title,
  reason: 'x',
  locked,
});

const entry: SnippetFeedEntry = {
  key: 'v1',
  label: 'Model',
  href: '/org/model',
  org: { label: 'Org', href: '/org' },
  date: `${new Date().getFullYear()}-10-01`,
  version: 1,
  evals: [
    {
      slug: 'fortress',
      label: 'FORTRESS',
      href: '/runs/r1',
      result: { metric: 'refusal', value: 80, unit: 'percent' },
      place: null,
      flags: { high: 0, medium: 0 },
    },
    { slug: 'mask', label: 'MASK', href: '/runs/r2', result: null, place: null, flags: { high: 0, medium: 0 } },
  ],
  meter: 62,
  judges: [{ name: 'Judge', score: 62 }],
  summary: 'The panel agrees.',
  counts: { high: 0, medium: 2, low: 0 },
  topics: [{ topic: 'harmful_requests', counted: 2, low: 0 }],
  snippets: [chat('a', 'Open chat', false), chat('b', 'Locked chat', true)],
};

const high = (id: string, title: string): SnippetRef => ({ ...chat(id, title, true), severity: 'high' });
const lockedHigh = {
  ...entry,
  counts: { high: 2, medium: 2, low: 0 },
  snippets: [high('h1', 'Locked high 1'), high('h2', 'Locked high 2'), ...entry.snippets],
};

describe('SnippetFeedRow', () => {
  it('puts a lock before the title of a chat that the reader cannot open', () => {
    render(<SnippetFeedRow entry={entry} />);
    const locks = screen.getAllByLabelText('Restricted');
    expect(locks).toHaveLength(1);
    expect(locks[0]!.closest('li')!.textContent).toContain('Locked chat');
  });

  it('shows the score and links the row to the model', () => {
    render(<SnippetFeedRow entry={entry} />);
    expect(screen.getByRole('link', { name: /^Deploymeter: 62 of 100/ }).getAttribute('href')).toBe('/org/model');
    expect(screen.getByRole('link', { name: 'Model' }).hasAttribute('data-row-link')).toBe(true);
  });

  it('heads the chats and the evals with their numbers (short above 999), as links to the model page', () => {
    const { rerender } = render(<SnippetFeedRow entry={{ ...entry, counts: { high: 1, medium: 1209, low: 2 } }} />);
    expect(screen.queryByText(/more flagged/)).toBeNull();
    const chats = screen.getByRole('link', { name: '1.2K Flagged Chats' });
    expect(chats.getAttribute('href')).toBe('/org/model');
    const evals = screen.getAllByText('2 Evaluations').find((x) => x.tagName === 'A');
    expect(evals!.getAttribute('href')).toBe('/org/model');
    rerender(<SnippetFeedRow entry={{ ...entry, counts: { high: 0, medium: 1, low: 0 } }} />);
    expect(screen.getByRole('link', { name: '1 Flagged Chat' })).toBeTruthy();
  });

  it('shows the panel summary by the Deploymeter', () => {
    const { rerender } = render(<SnippetFeedRow entry={entry} />);
    expect(screen.getByText('The panel agrees.')).toBeTruthy();
    rerender(<SnippetFeedRow entry={{ ...entry, summary: null }} />);
    expect(screen.queryByText('The panel agrees.')).toBeNull();
  });

  it('has one column of chats with no severity icons, also in an org list', () => {
    const chats = () => screen.getByRole('list', { name: 'Flagged chats' }).querySelectorAll(':scope > li');
    const { rerender } = render(<SnippetFeedRow entry={entry} />);
    expect(chats()).toHaveLength(entry.snippets.length);
    expect(screen.queryByLabelText('Medium severity')).toBeNull();
    rerender(<SnippetFeedRow entry={entry} inOrg />);
    expect(chats()).toHaveLength(entry.snippets.length);
  });

  it('shows the date and org name, but not in an org list', () => {
    const { rerender } = render(<SnippetFeedRow entry={entry} />);
    expect(screen.getByText('Oct 1')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Org' })).toBeTruthy();
    rerender(<SnippetFeedRow entry={entry} inOrg />);
    expect(screen.queryByText('Oct 1')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Org' })).toBeNull();
  });

  it('shows the number of evals, also in an org list, and none when there are no evals', () => {
    const { rerender } = render(<SnippetFeedRow entry={entry} />);
    expect(screen.getAllByText('2 Evaluations').length).toBeGreaterThan(0);
    rerender(<SnippetFeedRow entry={entry} inOrg />);
    expect(screen.getAllByText('2 Evaluations').length).toBeGreaterThan(0);
    rerender(<SnippetFeedRow entry={{ ...entry, evals: [] }} />);
    expect(screen.queryByText(/Evaluations?$/)).toBeNull();
  });

  it('lists at most 3 evals at the right, the worst for safety first, with bars and no numbers', () => {
    const result = (value: number) => ({
      metric: 'refusal',
      value,
      unit: 'percent' as const,
      safetyDirection: 'higher_is_better' as const,
    });
    const evals = [
      { slug: 'a', label: 'A', href: '/runs/a', result: result(90), place: null, flags: { high: 0, medium: 0 } },
      { slug: 'b', label: 'B', href: '/runs/b', result: null, place: null, flags: { high: 0, medium: 0 } },
      { slug: 'c', label: 'C', href: '/runs/c', result: result(20), place: null, flags: { high: 0, medium: 0 } },
      { slug: 'd', label: 'D', href: '/runs/d', result: result(50), place: null, flags: { high: 0, medium: 0 } },
    ];
    render(<SnippetFeedRow entry={{ ...entry, evals }} />);
    const list = screen.getByRole('list', { name: 'Evaluations' });
    const links = [...list.querySelectorAll('a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/runs/c', '/runs/d', '/runs/a']);
    expect(links[0]!.textContent).not.toContain('20');
    expect(links[0]!.querySelector('[role="img"]')!.getAttribute('aria-label')).toBe('20% good for safety');
    expect(links[0]!.querySelector('svg.lucide-book-check')).toBeNull();
  });

  it('shows the place among the models in place of the bar, the lowest place first', () => {
    const result = {
      metric: 'refusal',
      value: 90,
      unit: 'percent' as const,
      safetyDirection: 'higher_is_better' as const,
    };
    const evals = [
      { slug: 'a', label: 'A', href: '/runs/a', result, place: { rank: 2, of: 22 }, flags: { high: 0, medium: 0 } },
      { slug: 'b', label: 'B', href: '/runs/b', result, place: { rank: 15, of: 22 }, flags: { high: 0, medium: 0 } },
    ];
    render(<SnippetFeedRow entry={{ ...entry, evals }} />);
    const links = [...screen.getByRole('list', { name: 'Evaluations' }).querySelectorAll('a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/runs/b', '/runs/a']);
    expect(links[0]!.textContent).toContain('15th of 22');
    expect(links[0]!.textContent).not.toContain('90');
    expect(links[0]!.querySelector('[role="img"]')).toBeNull();
    expect(screen.getByTitle('15th of 22 models')).toBeInTheDocument();
  });

  it('shows no eval names in the chat list', () => {
    render(<SnippetFeedRow entry={entry} />);
    const chats = screen.getByRole('list', { name: 'Flagged chats' });
    const titles = [...chats.querySelectorAll('li span.truncate')].map((s) => s.textContent);
    expect(titles).not.toContain('FORTRESS');
  });

  it('links each chat to its attempt, which the viewer opens', () => {
    render(<SnippetFeedRow entry={entry} />);
    const chats = screen.getByRole('list', { name: 'Flagged chats' });
    const hrefs = [...chats.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/runs/r/attempts/a?snippet=a', '/runs/r/attempts/b?snippet=b']);
  });

  it('puts open chats first', () => {
    render(<SnippetFeedRow entry={lockedHigh} />);
    const chats = screen.getByRole('list', { name: 'Flagged chats' });
    const titles = [...chats.querySelectorAll('li span.truncate')].map((s) => s.textContent);
    expect(titles).toEqual(['Open chat', 'Locked high 1', 'Locked high 2']);
  });
});
