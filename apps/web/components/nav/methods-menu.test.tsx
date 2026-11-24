import type { NavMethods } from '@/lib/server/nav-methods';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MethodsMenu } from './methods-menu';

vi.mock('@/components/link', () => ({
  default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...p}>
      {children}
    </a>
  ),
}));

const method = { label: 'Probes', href: '/methods/probes', group: 'white_box', summary: 'Reads activations.' };
const leader = (label: string, score: string) => ({ label, href: `/methods/probes/${label}`, score, bar: null });

async function open(data: unknown) {
  vi.stubGlobal('fetch', () => Promise.resolve({ ok: true, json: () => Promise.resolve(data) }));
  render(<MethodsMenu active={false} methods={null} />);
  fireEvent.keyDown(screen.getByRole('link', { name: /Methods/ }), { key: 'ArrowDown' });
  await screen.findByText('Probes');
}

afterEach(() => vi.unstubAllGlobals());

describe('MethodsMenu', () => {
  it('shows the variants of each method, with medal icons and author, and no summary or date', async () => {
    const variants = [
      {
        label: 'Did-You-Lie Probe',
        href: '/methods/probes/dyl',
        summary: 'Asks "did you lie?".',
        author: 'Cooney, Africa and Irving',
        date: '2026-06',
        medals: [{ label: 'Varied Deception', slug: 'varied-deception', place: 2 }],
      },
    ];
    await open({ methods: [{ ...method, variants }], evals: [] });
    const link = screen.getByRole('link', { name: 'Did-You-Lie Probe' });
    expect(link.getAttribute('href')).toBe('/methods/probes/dyl');
    expect(screen.queryByText('Asks "did you lie?".')).toBeNull();
    expect(screen.getByText('Cooney, Africa and Irving')).toBeTruthy();
    expect(screen.queryByText(/Jun 2026/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Varied Deception' })).toBeNull();
    expect(screen.getByLabelText('Rank 2 in Varied Deception').textContent).toBe('🥈');
    expect(screen.queryByText('Reads activations.')).toBeNull();
    expect(screen.getByRole('link', { name: 'Probes' })).toBeTruthy();
  });

  it('shows each method eval with what it compares above its name, its creator and best 3 with medals, and no summary, date, topic or worst', async () => {
    const data: NavMethods = {
      methods: [{ ...method, variants: [] } as NavMethods['methods'][number]],
      evals: [
        {
          label: 'Varied Deception',
          slug: 'varied-deception',
          href: '/evaluations/varied-deception',
          creator: 'Apollo Research',
          date: '2026-06',
          summary: 'Tests if lie detectors find the lies.',
          topic: 'Honesty',
          compares: {
            key: 'topic:honesty',
            label: 'Honesty',
            href: null,
            tagline: null,
            about: 'Compares LLM Monitors and Probes.',
            topic: true,
          },
          worst: [leader('Linear', '0.61')],
          best: [leader('Apollo Probe', '0.845')],
          top: [leader('Apollo Probe', '0.845'), leader('DYL Probe', '0.81')],
        },
      ],
    };
    await open(data);
    expect(screen.getByText('Apollo Research')).toBeTruthy();
    expect(screen.queryByText(/Jun 2026/)).toBeNull();
    // Only above the name: the row does not also show its topic.
    expect(screen.getAllByText('Honesty')).toHaveLength(1);
    expect(screen.queryByRole('link', { name: 'Honesty' })).toBeNull();
    expect(screen.queryByText('Tests if lie detectors find the lies.')).toBeNull();
    expect(screen.getByText('Apollo Probe')).toBeTruthy();
    expect(screen.getByText('DYL Probe')).toBeTruthy();
    expect(screen.getByLabelText('Rank 1')).toBeTruthy();
    expect(screen.queryByText('Linear')).toBeNull();
  });

  it('shows a suite with its medals overall, and its evals as a tree under it', async () => {
    const suite = {
      slug: 'saebench',
      label: 'SAEBench',
      summary: '',
      creator: 'Karvonen et al.',
      date: null,
      order: [],
    };
    const sae = { key: '/methods/sae', label: 'Sparse Autoencoders', href: '/methods/sae', tagline: null, about: '' };
    const ev = (slug: string, first: string) => ({
      label: `SAEBench ${slug}`,
      slug,
      href: `/evaluations/${slug}`,
      creator: null,
      topic: null,
      suite,
      compares: sae,
      worst: [],
      best: [leader(first, '0.9')],
    });
    await open({ methods: [method], evals: [ev('scr', 'TopK'), ev('tpp', 'TopK'), ev('absorption', 'ReLU')] });
    expect(screen.getByRole('link', { name: 'Sparse Autoencoders' })).toBeTruthy();
    const tree = screen.getByRole('list', { name: 'SAEBench evaluations' });
    expect(tree.querySelectorAll(':scope > li')).toHaveLength(3);
    // The suite's medals: the most first places first.
    const medals = tree.parentElement!.querySelector('ol')!;
    expect([...medals.querySelectorAll('a')].map((a) => a.textContent)).toEqual(['TopK', 'ReLU']);
  });

  it('skips evals in an older form that the browser kept, and methods with no variants list', async () => {
    await open({
      methods: [method],
      benchmarks: [{ label: 'Old Benchmark', href: '/x', topic: 'Honesty', metric: 'AUROC', top: [] }],
      evals: [{ label: 'Old Eval', href: '/y', top: [] }],
    });
    expect(screen.queryByText('Old Benchmark')).toBeNull();
    expect(screen.queryByText('Old Eval')).toBeNull();
  });
});
