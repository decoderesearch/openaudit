import { evalSlugOf } from '@/lib/eval-links';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EvalLink } from './eval-link';

vi.mock('next/link', () => ({
  default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...p}>
      {children}
    </a>
  ),
}));

const fetchMock = vi.fn(async () =>
  Response.json({
    abstentionbench: {
      name: 'AbstentionBench',
      creator: 'Meta FAIR',
      date: '2025-06-10',
      summary: 'Tests whether the model abstains on questions it cannot answer.',
      topics: ['Hallucination', 'Honesty'],
    },
    bare: { name: 'Bare', creator: null, date: null, summary: null, topics: [] },
  }),
);

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function hover(name: string) {
  fireEvent.pointerEnter(screen.getByText(name), { pointerType: 'mouse' });
  await act(async () => void (await vi.advanceTimersByTimeAsync(500)));
}

describe('EvalLink', () => {
  it('shows the name, creator, date, summary and topics on hover, from one request', async () => {
    render(
      <>
        <EvalLink slug="abstentionbench">AbstentionBench</EvalLink>
        <EvalLink slug="bare">Bare</EvalLink>
      </>,
    );
    expect(screen.getByText('AbstentionBench').getAttribute('href')).toBe('/evaluations/abstentionbench');
    await hover('AbstentionBench');
    const card = () => [...document.querySelectorAll('[data-slot="hover-card-content"]')].at(-1)!;
    expect(card().textContent).toBe(
      'AbstentionBenchMeta FAIR·Jun 2025Tests whether the model abstains on questions it cannot answer.Hallucination·Honesty',
    );
    await hover('Bare');
    expect(card().textContent).toBe('Bare');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows no card when the eval is not public', async () => {
    render(
      <EvalLink slug="hidden" href="/evaluations/hidden#results">
        Hidden
      </EvalLink>,
    );
    await hover('Hidden');
    expect(document.querySelector('[data-slot="hover-card-content"]')).toBeNull();
    expect(screen.getByText('Hidden').getAttribute('href')).toBe('/evaluations/hidden#results');
  });
});

describe('evalSlugOf', () => {
  it.each([
    ['/evaluations/mask', 'mask'],
    ['/evaluations/mask#results', 'mask'],
    ['/evals/bbq?x=1', 'bbq'],
    ['/evaluations/mask/samples', null],
    ['/evaluations', null],
    ['/models/x', null],
    ['https://example.com/evaluations/mask', null],
  ])('%s', (href, slug) => {
    expect(evalSlugOf(href)).toBe(slug);
  });
});
