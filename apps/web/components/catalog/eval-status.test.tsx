import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EvalStatusNote, EvalStatusTag } from './eval-status';

describe('EvalStatusTag', () => {
  it('shows nothing for an active eval', () => {
    const { container } = render(<EvalStatusTag status="active" />);
    expect(container.textContent).toBe('');
  });

  it('names the other statuses', () => {
    render(
      <>
        <EvalStatusTag status="legacy" />
        <EvalStatusTag status="saturated" />
        <EvalStatusTag status="retired" />
      </>,
    );
    for (const name of ['Legacy', 'Saturated', 'Retired']) expect(screen.getByText(name)).toBeTruthy();
  });
});

describe('EvalStatusNote', () => {
  it('shows the status, the reason and a link to the newer eval', () => {
    const { container } = render(
      <EvalStatusNote
        eval={{
          status: 'legacy',
          legacyReason: 'Built for base models',
          legacyDecisionDate: '2026-10-05',
          supersededBy: 'strongreject',
        }}
        newerName="StrongREJECT"
      />,
    );
    expect(container.textContent).toMatch(/^Legacy \(Oct 5, 2026\): Built for base models\.\s+Newer: StrongREJECT\.$/);
    expect(screen.getByRole('link', { name: 'StrongREJECT' }).getAttribute('href')).toBe('/evaluations/strongreject');
  });

  it('shows the saturated decision of a legacy eval', () => {
    const { container } = render(
      <EvalStatusNote
        eval={{
          status: 'legacy',
          legacyReason: 'Use the new set',
          saturatedReason: 'Models score at the ceiling',
          saturatedDecisionDate: '2026-09-01',
        }}
      />,
    );
    expect(container.textContent).toMatch(
      /^Legacy: Use the new set\.\s*Saturated \(Sep 1, 2026\): Models score at the ceiling\.\s*$/,
    );
  });

  it('shows only the reason of the current status', () => {
    const { container } = render(
      <EvalStatusNote eval={{ status: 'saturated', saturatedReason: 'At the ceiling', legacyReason: 'Old' }} />,
    );
    expect(container.textContent?.trim()).toBe('Saturated: At the ceiling.');
  });

  it('shows only the parts that exist', () => {
    const { container } = render(<EvalStatusNote eval={{ status: 'saturated', saturatedReason: null }} />);
    expect(container.textContent?.trim()).toBe('Saturated.');
    expect(container.querySelector('a')).toBeNull();
  });

  it('shows nothing for an active eval', () => {
    const { container } = render(<EvalStatusNote eval={{ status: 'active' }} />);
    expect(container.textContent).toBe('');
  });
});
