import { ModelBrowser } from '@/components/catalog/model-browser';
import type { ModelTableRow } from '@/components/catalog/model-list';
import { ModelStats } from '@/components/catalog/model-stats';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const counts = { openAudit: 1, systemCard: 0, flagged: 5, deploymeter: 45 };

describe('ModelStats', () => {
  it('shows the score, with no flagged chats and no links', () => {
    const { container } = render(<ModelStats evals={counts} />);
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('45');
    expect(container.textContent).not.toContain('Flagged');
  });
});

describe('ModelBrowser with stats', () => {
  const row: ModelTableRow = {
    id: 'm',
    displayName: 'Model',
    name: 'model',
    path: '/org/model',
    organization: { displayName: 'Org', path: '/org' },
    evals: counts,
  };

  it('shows each model as one link to its page, with a "View Report" tab', () => {
    render(<ModelBrowser rows={[row]} embedded stats />);
    const links = screen.getAllByRole('link').filter((a) => a.getAttribute('href') === '/org/model');
    expect(links).toHaveLength(1);
    expect(links[0]!.textContent).toContain('Org');
    expect(links[0]!.querySelector('a')).toBeNull();
    expect(links[0]!.parentElement!.textContent).toContain('View Report');
  });
});
