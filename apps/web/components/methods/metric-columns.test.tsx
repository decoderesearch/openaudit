import type { BoardRow, BoardVariant } from '@/lib/methods';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MetricColumns, partRow, type MetricBoard } from './metric-columns';

const query = vi.hoisted(() => ({ value: '' }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/evaluations/wsb',
  useSearchParams: () => new URLSearchParams(query.value),
}));
vi.mock('nextjs-toploader/app', () => ({ useRouter: () => ({ push: vi.fn() }) }));
const setParam = vi.hoisted(() => vi.fn());
vi.mock('@/lib/url-param', () => ({ replaceUrlParam: setParam }));

const variant = (id: string, baseline = false) =>
  ({
    id,
    slug: id,
    displayName: id.toUpperCase(),
    baseline,
    access: 'white_box',
    method: { slug: 'lenses', displayName: 'Lenses' },
  }) as BoardVariant;
const row = (subject: string, values: Record<string, number>): BoardRow => ({
  subject,
  order: null,
  cells: new Map(Object.entries(values).map(([id, value]) => [id, { value, rank: 1, artifactId: id }])),
  baselineValues: new Map(),
});
const board = (key: string, values: Record<string, number>[]): MetricBoard => ({
  key,
  name: key.toUpperCase(),
  direction: 'higher_is_better',
  rows: values.map((v, i) => row(`m${i + 1}`, v)),
});

const variants = [variant('a'), variant('b')];
const boards = [
  { ...board('all', [{ a: 0.2, b: 0.6 }]), count: 30 },
  board('poetry', [{ a: 0.9, b: 0.1 }]),
  board('typo', [{ a: 0.3, b: 0.5 }]),
];
const subjects = { m1: { label: 'Model 1' } };
const view = () =>
  render(<MetricColumns boards={boards} variants={variants} subjects={subjects} info="" part="Sample Set" />);

describe('MetricColumns', () => {
  afterEach(() => {
    cleanup();
    query.value = '';
    setParam.mockClear();
  });

  it('shows a column for each model with ?board=models, under a bar with the metric menu and the switch', () => {
    query.value = 'board=models';
    view();
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Variant', 'Median', 'Model 1']);
    expect(screen.getByRole('button', { name: 'Metric' })).toHaveTextContent('ALL30');
    fireEvent.click(screen.getByRole('radio', { name: 'By Sample Set' }));
    expect(setParam).toHaveBeenCalledWith('board', undefined);
  });

  it('shows a column for each subset by default, ranked by the first metric; a click picks its metric', () => {
    view();
    fireEvent.click(screen.getByRole('radio', { name: 'By Model' }));
    expect(setParam).toHaveBeenCalledWith('board', 'models');
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Variant', 'ALL', 'POETRY', 'TYPO']);
    expect(screen.getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['🥇B', '🥈A']);
    fireEvent.click(screen.getByText('POETRY'));
    expect(setParam).toHaveBeenCalledWith('metric', 'poetry');
  });

  it('takes one model, else the median over the models', () => {
    const b = board('x', [{ a: 0.2 }, { a: 0.4 }, { a: 0.9 }]);
    expect(partRow(b, variants, null).cells.get('a')?.value).toBe(0.4);
    expect(partRow(b, variants, 'm3').cells.get('a')?.value).toBe(0.9);
  });
});
