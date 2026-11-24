import type { ModelTableRow } from '@/components/catalog/model-list';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelBrowser } from './model-browser';

let observers: FakeObserver[] = [];

class FakeObserver {
  disconnected = false;
  constructor(
    private cb: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit,
  ) {
    observers.push(this);
  }
  fire() {
    this.cb([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
  observe() {}
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
}

/** The list's own observers (`next/link` can make others). */
const live = () => observers.filter((o) => !o.disconnected && o.options?.rootMargin === '0px 0px 600px 0px');

const rows: ModelTableRow[] = Array.from({ length: 250 }, (_, i) => ({
  id: `m${i}`,
  displayName: i < 120 ? `Alpha ${i}` : `Beta ${i}`,
  name: `org/m${i}`,
  path: `/org/m${i}`,
  organization: { displayName: 'Org', path: '/org' },
  released: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
  evals: { openAudit: 0, systemCard: 0, flagged: 0 },
}));

describe('ModelBrowser', () => {
  beforeEach(() => {
    observers = [];
    vi.stubGlobal('IntersectionObserver', FakeObserver);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders 100 rows, then 100 more each time the end shows', () => {
    const { container } = render(<ModelBrowser rows={rows} embedded />);
    const count = () => container.querySelectorAll('tbody tr').length;
    expect(count()).toBe(100);
    act(() => live()[0].fire());
    expect(count()).toBe(200);
    act(() => live()[0].fire());
    expect(count()).toBe(250);
    expect(live()).toHaveLength(0);
  });

  it('starts again at 100 rows after a new search', () => {
    const { container } = render(<ModelBrowser rows={rows} embedded />);
    const count = () => container.querySelectorAll('tbody tr').length;
    act(() => live()[0].fire());
    expect(count()).toBe(200);
    fireEvent.click(screen.getByLabelText('Show search'));
    fireEvent.change(screen.getByLabelText('Search models'), { target: { value: 'alpha' } });
    expect(count()).toBe(100);
    act(() => live()[0].fire());
    expect(count()).toBe(120);
  });

  it('shows the search box on a click, and a second click hides it and clears the search', () => {
    const { container } = render(<ModelBrowser rows={rows.slice(100, 150)} embedded allHref="/models" />);
    const count = () => container.querySelectorAll('tbody tr').length;
    expect(screen.queryByLabelText('Search models')).toBeNull();
    expect(screen.getByRole('link', { name: 'Models' }).getAttribute('href')).toBe('/models');
    const toggle = screen.getByLabelText('Show search');
    fireEvent.click(toggle);
    fireEvent.change(screen.getByLabelText('Search models'), { target: { value: 'alpha' } });
    expect(count()).toBe(20);
    fireEvent.click(toggle);
    expect(screen.queryByLabelText('Search models')).toBeNull();
    expect(count()).toBe(50);
  });
});
