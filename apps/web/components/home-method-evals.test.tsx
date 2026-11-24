import { HomeMethodEvals } from '@/components/home-method-evals';
import type { MenuEval } from '@/components/nav/menu-evals';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('nextjs-toploader/app', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const lenses = { label: 'Lenses', href: '/methods/lenses', summary: 'Read activations.' };
const probes = { label: 'Probes', href: '/methods/probes', summary: 'Linear reads.' };
const monitors = { label: 'Monitors', href: '/methods/monitors', summary: 'An LLM reads the chat.' };

const evalOf = (slug: string, compares: MenuEval['compares']): MenuEval => ({
  label: slug.toUpperCase(),
  slug,
  href: `/evaluations/${slug}`,
  creator: null,
  topic: null,
  worst: [],
  best: [],
  compares,
});

describe('HomeMethodEvals', () => {
  afterEach(cleanup);

  it('shows the trees with evals first, then each other method once, as a head only', () => {
    render(
      <HomeMethodEvals
        evals={[
          evalOf('readout', { key: 'lenses', label: 'Lenses', href: lenses.href, tagline: null, about: '' }),
          evalOf('deception', { key: 'topic:honesty', label: 'Honesty', href: null, tagline: null, about: '' }),
        ]}
        methods={[probes, lenses, monitors]}
      />,
    );
    const trees = screen.getAllByRole('region').map((s) => s.getAttribute('aria-label'));
    expect(trees).toEqual(['Safety Methods', 'Lenses', 'Honesty', 'Other methods']);
    expect(screen.getAllByRole('link', { name: 'Lenses' })).toHaveLength(1);
    const other = screen.getByRole('region', { name: 'Other methods' });
    expect([...other.querySelectorAll('h3')].map((h) => h.textContent)).toEqual(['Probes', 'Monitors']);
    expect(other.textContent).not.toContain('Linear reads.');
    expect(other.textContent).toBe('MethodProbesMethodMonitors');
  });

  it('shows the evals of a tree with the newest results first, and no dates', () => {
    const compares = { key: 'lenses', label: 'Lenses', href: lenses.href, tagline: null, about: '' };
    render(
      <HomeMethodEvals
        evals={[
          { ...evalOf('readout', compares), updated: '2026-11-03T00:00:00.000Z' },
          { ...evalOf('swap', compares), updated: '2026-11-03T00:00:00.000Z' },
          { ...evalOf('bench', compares), updated: '2026-11-15T00:00:00.000Z' },
        ]}
      />,
    );
    const tree = screen.getByRole('region', { name: 'Lenses' });
    const names = [...tree.querySelectorAll('a[href^="/evaluations/"]')].map((a) => a.textContent).filter(Boolean);
    expect([...new Set(names)]).toEqual(['BENCH', 'READOUT', 'SWAP']);
    expect(tree.textContent).not.toMatch(/Nov/);
  });
});
