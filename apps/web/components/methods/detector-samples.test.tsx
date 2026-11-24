import { fewestOf } from '@/lib/runs/detectors';
import type { DetectorSampleItem } from '@/lib/server/runs';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DetectorSamples } from './detector-samples';

const query = vi.hoisted(() => ({ value: '' }));
const load = vi.hoisted(() => vi.fn(async () => ({ samples: [] as DetectorSampleItem[], more: false, cleared: true })));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(query.value) }));
vi.mock('@/app/evaluations/actions', () => ({ detectorSamples: load }));

// The list loads when its end comes into view.
beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private cb: (e: { isIntersecting: boolean }[]) => void) {}
      observe() {
        this.cb([{ isIntersecting: true }]);
      }
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  load.mockClear();
  query.value = '';
});

const metrics = [
  { key: 'macro_score', name: 'Macro', data: true },
  { key: 'poetry', name: 'Poetry', data: false, split: true },
  { key: 'other', name: 'Other', data: false },
];
const view = () =>
  render(<DetectorSamples slug="wsb" kind="hit" detectors={[{ key: 'a', label: 'A' }]} metrics={metrics} canary="x" />);

describe('DetectorSamples', () => {
  it('shows only the split of a metric that names one', async () => {
    query.value = 'metric=poetry';
    view();
    await waitFor(() => expect(load).toHaveBeenCalled());
    expect(load.mock.calls[0]).toEqual(['wsb', 0, ['a'], undefined, undefined, undefined, 'poetry']);
    expect(screen.getByRole('button', { name: 'Metric' })).toHaveTextContent('Poetry');
    expect(screen.queryByText(/has no score on each sample/)).toBeNull();
  });

  it('counts the headline for a metric with no scores and no split', async () => {
    query.value = 'metric=other';
    view();
    await waitFor(() => expect(load).toHaveBeenCalled());
    expect(load.mock.calls[0]?.slice(5)).toEqual([undefined, undefined]);
    expect(screen.getByText(/Other has no score on each sample/)).toBeInTheDocument();
  });

  it('shows Missed or Passed for one scored model, else the misses of all', async () => {
    const sample = (id: string, missed: Record<string, { mean: number | null; scored: number }>) => ({
      id,
      href: `/evaluations/wsb/samples/${id}`,
      split: 'poetry',
      sourceId: id,
      input: `Prompt ${id}`,
      hidden: false,
      known: false,
      missed,
      all: { mean: 0.5, scored: 2 },
      total: 0.5,
    });
    load.mockResolvedValueOnce({
      samples: [
        sample('s1', { a: { mean: 1, scored: 1 }, b: { mean: 0, scored: 1 } }),
        sample('s2', { a: { mean: 0.5, scored: 2 }, b: { mean: null, scored: 0 } }),
      ],
      more: false,
      cleared: true,
    });
    render(
      <DetectorSamples
        slug="wsb"
        kind="hit"
        detectors={[
          { key: 'a', label: 'A' },
          { key: 'b', label: 'B' },
        ]}
        metrics={metrics}
        canary="x"
      />,
    );
    expect(await screen.findByText('1/2')).toBeInTheDocument();
    const word = (text: string) => screen.getAllByText(text, { selector: 'td span' }).find((e) => !e.children.length);
    expect(word('Missed')).toHaveClass('text-rose-700', 'uppercase');
    expect(word('Passed')).toHaveClass('text-emerald-600', 'uppercase');
    expect(screen.queryByText('1/1')).toBeNull();
  });

  it('starts with Fail on each column, sets each column on its own, and Reset goes back', async () => {
    render(
      <DetectorSamples
        slug="wsb"
        kind="hit"
        detectors={[
          { key: 'a', label: 'A' },
          { key: 'b', label: 'B' },
        ]}
        canary="x"
      />,
    );
    await waitFor(() => expect(load).toHaveBeenCalled());
    const toggle = (group: string, name: string) =>
      within(screen.getByRole('group', { name: group })).getByRole('button', { name });
    expect(screen.queryByRole('group', { name: 'Sort by all methods' })).toBeNull();
    const by = () => (load.mock.calls.at(-1) as unknown[] | undefined)?.[2];
    expect(by()).toEqual(['a', 'b']);
    expect(toggle('Sort by A', 'Fail')).toHaveAttribute('aria-pressed', 'true');
    expect(toggle('Sort by B', 'Fail')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
    fireEvent.click(toggle('Sort by A', 'Pass'));
    await waitFor(() => expect(by()).toEqual([fewestOf('a'), 'b']));
    expect(toggle('Sort by B', 'Fail')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(toggle('Sort by B', 'Fail'));
    await waitFor(() => expect(by()).toEqual([fewestOf('a')]));
    fireEvent.click(toggle('Sort by A', 'Pass'));
    await waitFor(() => expect(by()).toEqual([]));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(by()).toEqual(['a', 'b']));
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
  });
});
