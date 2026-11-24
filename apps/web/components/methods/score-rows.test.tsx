import type { Job, ScoreRow, VariantView } from '@/lib/methods';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ScoreRows } from './score-rows';

const variants: VariantView[] = [
  { id: 'a', slug: 'topk', displayName: 'TopK', baseline: false, access: 'white_box', author: 'Gao et al.' },
  { id: 'b', slug: 'gated', displayName: 'Gated', baseline: false, access: 'white_box' },
  { id: 'c', slug: 'relu', displayName: 'ReLU', baseline: false, access: 'white_box' },
  { id: 'r', slug: 'pca', displayName: 'PCA', baseline: true, access: 'white_box' },
];
const job = (slug: string, displayName: string): Job => ({
  eval: { slug, displayName, family: 'SAEBench', topics: [], version: '2025-01', links: [], metrics: [] },
  metric: { key: 'score', displayName: 'Score', aggregation: 'custom', direction: 'higher_is_better', headline: true },
  safety: false,
});
/** A row with each variant's value, ranked by the order given (best first). */
const row = (j: Job, values: [string, number][], baseline?: number): ScoreRow => ({
  job: j,
  cells: new Map(values.map(([id, value], i) => [id, { value, rank: i + 1 }])),
  count: values.length,
  baselines: baseline == null ? [] : [{ variant: variants[3]!, value: baseline }],
});
const heads = () => screen.getAllByRole('rowheader').map((h) => h.textContent);

describe('ScoreRows', () => {
  afterEach(cleanup);

  it('with one eval, puts the variants best first with medals, the ones with no value next, the baselines last', () => {
    const rows = [
      row(
        job('sae-bench-ravel', 'SAEBench RAVEL'),
        [
          ['b', 0.7],
          ['a', 0.6],
        ],
        0.65,
      ),
    ];
    render(<ScoreRows rows={rows} variants={variants} method="sparse-autoencoders" evalPage empty="No SAEs" />);
    expect(heads()).toEqual(['🥇Gated', '🥈TopKGao et al.', 'ReLU', 'PCA']);
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Method Variant', 'Score']);
    expect(screen.getByText('0.700')).toHaveClass('bg-emerald-50');
    expect(screen.getByText('0.650')).toHaveClass('italic');
    expect(screen.getByTitle('No SAEs')).toHaveTextContent('—');
    expect(screen.getByRole('link', { name: 'Gated' })).toHaveAttribute('href', '/methods/sparse-autoencoders/gated');
  });

  it('with more evals, goes by mean rank and links each eval', () => {
    const rows = [
      row(job('sae-bench-scr', 'SAEBench SCR'), [
        ['a', 0.9],
        ['b', 0.5],
        ['c', 0.1],
      ]),
      row(job('sae-bench-tpp', 'SAEBench TPP'), [
        ['c', 0.9],
        ['a', 0.5],
        ['b', 0.1],
      ]),
    ];
    render(<ScoreRows rows={rows} variants={variants} method="sparse-autoencoders" />);
    expect(heads()).toEqual(['🥇TopKGao et al.', '🥈ReLU', '🥉Gated']);
    expect(screen.queryByText('Mean Rank')).toBeNull();
    const first = screen.getAllByText('0.900')[0]!.closest('td');
    expect(first).toHaveClass('bg-emerald-50');
    expect(first).toHaveTextContent('1st0.900');
    expect(screen.getByRole('link', { name: 'TPP' })).toHaveAttribute('href', '/evaluations/sae-bench-tpp');
  });

  it('puts the place of a variant with no medal at its left, and with `only` shows only its row', () => {
    const more: VariantView[] = [
      ...variants,
      { id: 'd', slug: 'p-anneal', displayName: 'P-Anneal', baseline: false, access: 'white_box' },
    ];
    const order: [string, number][] = [
      ['a', 0.9],
      ['b', 0.8],
      ['c', 0.7],
      ['d', 0.6],
    ];
    const rows = [
      row(job('sae-bench-scr', 'SAEBench SCR'), order, 0.5),
      row(job('sae-bench-tpp', 'SAEBench TPP'), order),
    ];
    render(<ScoreRows rows={rows} variants={more} method="sparse-autoencoders" only="d" />);
    expect(heads()).toEqual(['4thP-Anneal']);
    expect(screen.getAllByRole('cell').map((c) => c.textContent)).toEqual(['4th of 40.600', '4th of 40.600']);
  });
});
