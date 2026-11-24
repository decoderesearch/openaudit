import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CrumbMenu } from './crumb-menu';

vi.mock('next/link', () => ({
  default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...p}>
      {children}
    </a>
  ),
}));

const head = { creator: null, date: null };
const about = {
  name: 'AbstentionBench',
  ...head,
  summary: 'Tests whether the model abstains.',
  topics: ['Hallucination', 'Honesty'],
};
const tip = () => document.querySelector('[data-slot="tooltip-content"]');

describe('CrumbMenu', () => {
  it("shows the eval's summary and topics on the crumb, and hides them while the menu is open", async () => {
    render(
      <CrumbMenu
        label="AbstentionBench"
        href="/evaluations/abstentionbench"
        current
        about={about}
        groups={[
          {
            links: [
              {
                label: 'MASK',
                href: '/evaluations/mask',
                about: { name: 'MASK', ...head, summary: 'Lies.', topics: [] },
              },
            ],
          },
        ]}
      />,
    );
    const trigger = screen.getByRole('button', { name: /AbstentionBench/ });
    await act(async () => void fireEvent.focus(trigger));
    expect(tip()?.textContent).toContain('Tests whether the model abstains.');
    expect(tip()?.textContent).toContain('Hallucination·Honesty');
    await act(async () => void fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' }));
    expect(screen.getByText('MASK')).toBeTruthy();
    expect(tip()?.textContent ?? '').not.toContain('abstains');
  });
});
