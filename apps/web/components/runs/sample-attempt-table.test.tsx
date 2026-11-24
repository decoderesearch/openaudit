import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PassFilterProvider, PassTally } from './pass-filter';
import { Call, SampleAttemptTable, type SampleAttemptRow } from './sample-attempt-table';

vi.mock('next/link', () => ({
  default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...p}>
      {children}
    </a>
  ),
}));

/** An attempt with a harmful score (lower is better), or an error when `n` is null. */
const row = (name: string, n: number | null, passed?: boolean, model = name, epoch = 1): SampleAttemptRow => ({
  id: `${model} ${name}`,
  href: `/a/${name}`,
  run: `run ${model}`,
  model: { name: model, displayName: model },
  epoch,
  result: { status: n === null ? 'error' : 'success', ...(passed !== undefined && { passed }) },
  ...(n !== null && {
    score: {
      n,
      text: n.toFixed(2),
      bar: { metric: 'harmful', value: n, unit: 'fraction', safetyDirection: 'lower_is_better' },
    },
  }),
  reply: 'Reply',
});

const names = () => screen.getAllByRole('link').map((a) => a.textContent);

describe('SampleAttemptTable', () => {
  const rows = [row('Error', null), row('Safe', 0, true), row('Harmful', 1, false), row('Half', 0.5)];

  it('puts the least safe scores first and the errors last', () => {
    render(<SampleAttemptTable rows={rows} score={{ label: 'Harmful action rate' }} />);
    expect(names()).toEqual(['Harmful', 'Half', 'Safe', 'Error']);
  });

  it('shows no Pass / Fail column when the score is the only result', () => {
    render(<SampleAttemptTable rows={[row('Half', 0.5), row('Error', null)]} score={{ label: 'Concerning' }} />);
    expect(screen.queryByRole('columnheader', { name: /Pass \/ Fail/ })).toBeNull();
    expect(screen.getByRole('columnheader', { name: /Concerning/ })).toBeInTheDocument();
    const errorRow = screen.getByRole('link', { name: 'Error' }).closest('tr')!;
    expect(errorRow.cells[1]!.textContent).toMatch(/error/i);
  });

  it('shows the score column before the Pass / Fail column', () => {
    render(<SampleAttemptTable rows={rows} score={{ label: 'Harmful action rate' }} />);
    const heads = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(heads.findIndex((h) => h?.includes('Harmful action rate'))).toBeLessThan(
      heads.findIndex((h) => h?.includes('Pass / Fail')),
    );
  });

  it('shows only the passed or failed models after a click on a count, and all after a second click', () => {
    render(
      <PassFilterProvider>
        <PassTally passed={1} failed={1} />
        <SampleAttemptTable rows={rows} score={{ label: 'Harmful action rate' }} />
      </PassFilterProvider>,
    );
    expect(names()).toHaveLength(4);
    const failed = screen.getByRole('button', { name: /1 Model Failed/i });
    fireEvent.click(failed);
    expect(failed).toHaveAttribute('aria-pressed', 'true');
    expect(names()).toEqual(['Harmful']);
    fireEvent.click(screen.getByRole('button', { name: /1 Model Passed/i }));
    expect(names()).toEqual(['Safe']);
    fireEvent.click(screen.getByRole('button', { name: /1 Model Passed/i }));
    expect(names()).toHaveLength(4);
  });

  it('groups the attempts of each model in a closed row with their summary', () => {
    const many = [
      row('Attempt 1', 0, true, 'Safe model', 1),
      row('Attempt 2', 0, true, 'Safe model', 2),
      row('Attempt 1', 1, false, 'Bad model', 1),
      row('Attempt 2', 0, true, 'Bad model', 2),
      row('Attempt 3', null, undefined, 'Bad model', 3),
      row('Once', 0.5, undefined, 'Single model'),
    ];
    render(<SampleAttemptTable rows={many} score={{ label: 'Harmful action rate' }} />);
    const toggles = screen.getAllByRole('button', { expanded: false });
    expect(toggles.map((b) => b.textContent)).toEqual([
      expect.stringContaining('Bad model'),
      expect.stringContaining('Safe model'),
    ]);
    // Closed: only the model with one attempt has a link.
    expect(names()).toEqual(['Single model']);
    const bad = toggles[0]!.closest('tr')!;
    expect(bad.textContent).not.toContain('error');
    expect(bad.textContent).toContain('0.50');

    fireEvent.click(toggles[0]!);
    expect(toggles[0]).toHaveAttribute('aria-expanded', 'true');
    expect(names()).toEqual(['Attempt 1', 'Attempt 2', 'Attempt 3', 'Single model']);
  });

  it('shows one Not Scored cell with its reason in place of the detector calls, and no Reply column', () => {
    const detectors = [
      { key: 'a', label: 'Lens A' },
      { key: 'b', label: 'Lens B' },
    ];
    const scored = { ...row('Scored', 0), calls: { a: { answer: '1/2 Missed', value: 0.5, right: false } } };
    const fit = { ...row('Fit', 0), calls: {}, notScored: 'The lens fitted on this sample.' };
    render(<SampleAttemptTable rows={[scored, fit]} detectors={detectors} />);
    expect(screen.queryByRole('columnheader', { name: /Reply/ })).toBeNull();
    const cells = screen.getByRole('link', { name: 'Fit' }).closest('tr')!.cells;
    expect(cells).toHaveLength(2);
    expect(cells[1]).toHaveAttribute('colspan', '2');
    expect(cells[1]!.textContent).toBe('Not ScoredThe lens fitted on this sample.');
    expect(screen.getByRole('link', { name: 'Scored' }).closest('tr')!.cells).toHaveLength(3);
  });

  it('shows a Passed or Missed call in small caps, green or red', () => {
    render(<Call call={{ answer: 'Passed', value: null, right: true }} />);
    expect(screen.getByText('Passed')).toHaveClass('text-emerald-600', 'uppercase');
    render(<Call call={{ answer: 'Missed', value: null, right: false }} />);
    expect(screen.getByText('Missed')).toHaveClass('text-rose-700', 'uppercase');
    render(<Call call={{ answer: 'lie', value: 0.9, right: true }} />);
    expect(screen.getByText('lie')).not.toHaveClass('uppercase');
  });
});
