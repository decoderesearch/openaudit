import type { MethodExpertView } from '@openaudit/spec';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DetailsButton, ExpertJudges, MoreSection } from './brief';

const view: MethodExpertView = {
  id: 'v1',
  slug: 'gdm',
  methodId: 'f',
  variantIds: ['m1', 'gone'],
  title: 'Probes beat SAEs',
  byline: 'A. Author and 2 others',
  organization: 'Lab',
  publishedDate: '2025-03-26',
  stance: 'negative',
  summary: 'SAE probes did **worse**.',
  points: ['They do not say that SAEs are useless.'],
  quotes: [{ text: 'Linear probes are good', sourceUrl: 'https://example.org/post' }],
  sources: [{ kind: 'blog', url: 'https://example.org/post', title: 'LessWrong' }],
  checkedDate: '2026-10-15',
};

describe('DetailsButton', () => {
  it('opens its sections in a modal', () => {
    render(
      <DetailsButton label="SAEBench">
        <MoreSection title="Open Questions">Nobody knows.</MoreSection>
      </DetailsButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByRole('dialog', { name: 'Details: SAEBench' })).toBeTruthy();
    expect(screen.getByText('Nobody knows.')).toBeTruthy();
  });
});

describe('ExpertJudges', () => {
  it('counts the views by stance, lists each view and shows the summary', () => {
    render(
      <ExpertJudges summary="Experts disagree." views={[view, { ...view, id: 'v2', slug: 'b', stance: 'positive' }]} />,
    );
    expect(screen.getAllByText('Probes beat SAEs')).toHaveLength(2);
    expect(screen.queryByText('Lab')).toBeNull();
    expect(screen.getByText('Negative').parentElement?.textContent).toBe('1Negative');
    expect(screen.getByText('Positive').parentElement?.textContent).toBe('1Positive');
    expect(screen.getByText('Mixed').parentElement?.textContent).toBe('0Mixed');
    expect(screen.getByText('Experts disagree.')).toBeTruthy();
  });

  it('shows 3 views of a stance, then all of them after "Show all"', () => {
    const many = [1, 2, 3, 4].map((n) => ({ ...view, id: `v${n}`, slug: `s${n}`, title: `View ${n}` }));
    render(<ExpertJudges views={many} />);
    expect(screen.queryByText('View 4')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show all (4)' }));
    expect(screen.getByText('View 4')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show less' })).toBeTruthy();
  });

  it('shows nothing without views', () => {
    render(<ExpertJudges summary="Parent views." views={[]} />);
    expect(screen.queryByText('Parent views.')).toBeNull();
  });
});
