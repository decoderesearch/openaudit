import { ModelFeed } from '@/components/catalog/model-feed';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('nextjs-toploader/app', () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(cleanup);

describe('ModelFeed', () => {
  it('shows "Requires Newer Model Evaluation Types" instead of "Not audited" for a model newer than most evals', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    render(
      <ModelFeed
        entries={[]}
        initial="date"
        unaudited={[
          { key: 'new', label: 'New Model', href: '/a/new', evalsTooOld: true },
          { key: 'old', label: 'Old Model', href: '/a/old' },
        ]}
      />,
    );
    const row = (name: string) => screen.getByRole('link', { name }).closest('li')!;
    expect(within(row('New Model')).getByText('Requires Newer Model Evaluation Types')).toBeTruthy();
    expect(within(row('New Model')).getByText(/released after our existing public evaluations/)).toBeTruthy();
    expect(within(row('New Model')).queryByText('Not audited')).toBeNull();
    expect(within(row('Old Model')).getByText('Not audited')).toBeTruthy();
    expect(within(row('Old Model')).queryByText('Requires Newer Model Evaluation Types')).toBeNull();
  });
});
