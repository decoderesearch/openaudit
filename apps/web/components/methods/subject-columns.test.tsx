import type { BoardRow, BoardVariant } from '@/lib/methods';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubjectColumns } from './subject-columns';

const push = vi.fn();
vi.mock('nextjs-toploader/app', () => ({ useRouter: () => ({ push }) }));
let openRun: ReturnType<typeof vi.fn> | undefined;
vi.mock('@/components/pdf-viewer', async (real) => ({
  ...(await real<typeof import('@/components/pdf-viewer')>()),
  useRunViewerIfAny: () => openRun,
}));

const variant = (id: string, baseline = false) =>
  ({
    id,
    slug: id,
    displayName: id.toUpperCase(),
    baseline,
    access: 'white_box',
    method: { slug: 'lenses', displayName: 'Lenses' },
  }) as BoardVariant;

const row = (subject: string, values: Record<string, number>, base: Record<string, number> = {}): BoardRow => ({
  subject,
  order: null,
  cells: new Map(Object.entries(values).map(([id, value], i) => [id, { value, rank: i + 1, artifactId: id }])),
  baselineValues: new Map(Object.entries(base)),
});

describe('SubjectColumns', () => {
  afterEach(cleanup);
  const rows = [row('m1', { a: 0.3, b: 0.9, c: 0.5 }, { z: 0.2 }), row('m2', { a: 0.4, b: 0.8, c: 0.6 }, { z: 0.1 })];
  const variants = [variant('a'), variant('b'), variant('c'), variant('z', true)];
  const subjects = { m1: { label: 'Model 1', href: '/runs/r1' }, m2: { label: 'Model 2' } };

  it('has a column for each model, and the variants by median, best first, with medals', () => {
    render(<SubjectColumns rows={rows} variants={variants} subjects={subjects} direction="higher_is_better" />);
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Method Variant',
      'Median',
      'Model 1',
      'Model 2',
    ]);
    expect(screen.getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['🥇B', '🥈C', '🥉A', 'Z']);
  });

  it('makes the best median green, and no other median', () => {
    render(<SubjectColumns rows={rows} variants={variants} subjects={subjects} direction="lower_is_better" />);
    const green = (text: string) => screen.getByText(text).className.includes('bg-emerald-50');
    expect(green('0.350')).toBe(true);
    expect([green('0.550'), green('0.850'), green('0.150')]).toEqual([false, false, false]);
  });

  it("opens a model's run from any cell of its column", () => {
    render(<SubjectColumns rows={rows} variants={variants} subjects={subjects} direction="higher_is_better" />);
    fireEvent.click(screen.getByText('0.900'));
    expect(push).toHaveBeenCalledWith('/runs/r1');
    push.mockClear();
    fireEvent.click(screen.getByText('0.800'));
    expect(push).not.toHaveBeenCalled();
  });

  it("with a viewer, opens a model's run in it", () => {
    openRun = vi.fn();
    render(<SubjectColumns rows={rows} variants={variants} subjects={subjects} direction="higher_is_better" filter />);
    fireEvent.click(screen.getByText('0.900'));
    expect(openRun).toHaveBeenCalledWith({ run: 'r1' });
    expect(push).not.toHaveBeenCalled();
    openRun = undefined;
  });

  it('with `only`, shows one row, and each cell has its place above its value', () => {
    render(
      <SubjectColumns rows={rows} variants={variants} subjects={subjects} direction="higher_is_better" only="c" />,
    );
    expect(screen.getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['🥈C']);
    expect(screen.getAllByRole('cell').map((c) => c.textContent)).toEqual(['2nd0.550', '3rd0.500', '3rd0.600']);
  });

  it('with core models, ranks on them only; a variant without a value on each has no rank', () => {
    const withD = [rows[0]!, row('m2', { a: 0.4, b: 0.8, c: 0.6, d: 0.99 })];
    render(
      <SubjectColumns
        rows={withD}
        variants={[...variants.slice(0, 3), variant('d')]}
        subjects={subjects}
        direction="higher_is_better"
        core={['m1']}
      />,
    );
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Method Variant',
      'Core Median',
      'CoreModel 1',
      'Model 2',
    ]);
    expect(screen.getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['🥇B', '🥈C', '🥉A', 'D']);
    expect(screen.getByText('0 of 1 core').title).toBe('Not ranked: a value on 0 of 1 core models');
  });

  it('puts the core models in the first columns', () => {
    render(
      <SubjectColumns rows={rows} variants={variants} subjects={subjects} direction="higher_is_better" core={['m2']} />,
    );
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Method Variant',
      'Core Median',
      'CoreModel 2',
      'Model 1',
    ]);
  });

  it('marks the highlighted variant row, and values are not links', () => {
    render(
      <SubjectColumns rows={rows} variants={variants} subjects={subjects} direction="higher_is_better" highlight="b" />,
    );
    expect(screen.getByText('0.900').closest('a')).toBeNull();
    const heads = screen.getAllByRole('rowheader');
    expect(heads.filter((h) => h.className.includes('font-semibold')).map((h) => h.textContent)).toEqual(['🥇B']);
  });
});
