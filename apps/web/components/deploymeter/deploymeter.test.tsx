import type { DeploymeterView, DeployReviewView } from '@/lib/server/deploymeter';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/deploymeter/panel-review-buttons', () => ({ PanelReviewButtons: () => null }));
vi.mock('@/components/deploymeter/human-review-form', () => ({ HumanReviewForm: () => null }));

import { Deploymeter } from './deploymeter';

const review = (judge: string, over: Partial<DeployReviewView> = {}): DeployReviewView => ({
  id: judge,
  judge: `lab/${judge}`,
  judgeName: judge,
  openWeights: false,
  sameLab: false,
  self: false,
  score: 60,
  abstain: false,
  enoughEvidence: true,
  headline: `${judge} says so.`,
  summary: null,
  reasonsFor: [],
  reasonsAgainst: [],
  samples: [60],
  guess: null,
  error: null,
  evidence: 'full',
  href: `/judges/lab/${judge}/${judge}`,
  ...over,
});

const view = (reviews: DeployReviewView[]) =>
  ({
    panel: null,
    publishedNumber: null,
    ai: 60,
    reviews,
    counted: reviews.filter((r) => r.score !== null).length,
    humans: [],
    human: null,
    meter: 60,
  }) as unknown as DeploymeterView;

const model = { id: 'm', displayName: 'M', path: '/lab/m' };

describe('Deploymeter votes', () => {
  it('shows three verdicts when no judge abstains', () => {
    render(<Deploymeter view={view([review('a'), review('b')])} model={model} signedIn={false} admin={false} />);
    expect(screen.getAllByRole('button', { name: '2 Limited: show the reviews' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Abstain/ })).toBeNull();
  });

  it('shows abstains only in the bar, with only judges of other labs', () => {
    const reviews = [
      review('a'),
      review('b', { score: null, abstain: true }),
      review('c', { score: null, abstain: true, sameLab: true }),
    ];
    render(<Deploymeter view={view(reviews)} model={model} signedIn={false} admin={false} />);
    expect(screen.getAllByRole('button', { name: '1 Abstain: show the reviews' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: '1 Limited: show the reviews' })).toHaveLength(2);
  });
});
