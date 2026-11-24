import { jobsFor, scorecard, valueKey, type ArtifactPoint, type VariantView } from '@/lib/methods';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jobLabel, Scorecard } from './scorecard';
import { niceTicks } from './sparsity-charts';

const push = vi.fn();
vi.mock('nextjs-toploader/app', () => ({ useRouter: () => ({ push }) }));

const variants: VariantView[] = [
  { id: 'a', slug: 'topk', displayName: 'TopK', baseline: false, access: 'white_box' },
  { id: 'b', slug: 'p-anneal', displayName: 'P-anneal', baseline: false, access: 'white_box' },
  { id: 'c', slug: 'gated', displayName: 'Gated', baseline: false, access: 'white_box' },
  { id: 'r', slug: 'raw', displayName: 'Raw activations', baseline: true, access: 'white_box' },
];
const point = (id: string, variantId: string, l0: number, score: number): ArtifactPoint => ({
  id,
  key: id,
  displayName: id,
  variantId,
  subject: 'google/gemma-2-2b',
  sites: [],
  params: {},
  sourceUrl: null,
  values: { [valueKey('sae-bench-core', 'l0')]: l0, [valueKey('sae-bench-scr', 'scr_k20')]: score },
});
const evals = [
  {
    slug: 'sae-bench-scr',
    displayName: 'SAEBench Spurious Correlation Removal',
    family: 'SAEBench',
    topics: [],
    version: '2025-01',
    links: [],
    metrics: [
      {
        key: 'scr_k20',
        displayName: 'SCR (top 20 latents)',
        aggregation: 'custom' as const,
        direction: 'higher_is_better' as const,
        headline: true,
      },
    ],
  },
];

describe('Scorecard', () => {
  afterEach(cleanup);

  it('marks first place, shows a dash out of range and lists baselines', () => {
    const artifacts = [
      point('a1', 'a', 40, 0.2),
      point('a2', 'a', 160, 0.4),
      point('b1', 'b', 50, 0.1),
      point('b2', 'b', 200, 0.2),
      point('c1', 'c', 100, 0.5),
      point('c2', 'c', 200, 0.6),
      point('r1', 'r', 2300, 0.05),
    ];
    const L0 = valueKey('sae-bench-core', 'l0');
    const rows = scorecard({ variants, artifacts, jobs: jobsFor(evals), xKey: L0, at: 80 });
    render(
      <Scorecard
        rows={rows}
        variants={variants}
        method="sparse-autoencoders"
        empty="No SAEs on both sides of this L0"
      />,
    );
    expect(screen.getByRole('link', { name: 'Spurious Correlation Removal' })).toHaveAttribute(
      'href',
      '/evaluations/sae-bench-scr',
    );
    expect(screen.getByText('0.300')).toHaveClass('bg-emerald-50');
    expect(screen.getByText('0.134')).not.toHaveClass('bg-emerald-50');
    expect(screen.getByTitle('No SAEs on both sides of this L0')).toHaveTextContent('—');
    expect(screen.getByText('Raw activations 0.050')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'P\u2011anneal' })).toHaveAttribute(
      'href',
      '/methods/sparse-autoencoders/p-anneal',
    );
    fireEvent.click(screen.getByText('0.300'));
    expect(push).toHaveBeenCalledWith('/evaluations/sae-bench-scr');
  });

  it('with one row, puts the variants best first with medals, and the ones with no value last', () => {
    const artifacts = [
      point('a1', 'a', 40, 0.2),
      point('a2', 'a', 160, 0.4),
      point('b1', 'b', 50, 0.1),
      point('b2', 'b', 200, 0.2),
      point('c1', 'c', 100, 0.5),
    ];
    const L0 = valueKey('sae-bench-core', 'l0');
    const rows = scorecard({ variants, artifacts, jobs: jobsFor(evals), xKey: L0, at: 80 });
    render(<Scorecard rows={rows} variants={variants} method="sparse-autoencoders" />);
    const heads = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(heads).toEqual(['Evaluation', '🥇TopK', '🥈P\u2011anneal', 'Gated', 'Baselines']);
  });

  it('drops the family from eval names', () => {
    expect(jobLabel(evals[0])).toBe('Spurious Correlation Removal');
    expect(jobLabel({ ...evals[0], family: undefined })).toBe('SAEBench Spurious Correlation Removal');
  });
});

describe('niceTicks', () => {
  it('uses round steps inside the range', () => {
    expect(niceTicks(0.0049, 0.37)).toEqual([0.1, 0.2, 0.3]);
    expect(niceTicks(0.961, 1.0)).toEqual([0.97, 0.98, 0.99, 1]);
    expect(niceTicks(-0.02, 0.19)).toEqual([0, 0.05, 0.1, 0.15]);
  });
});
