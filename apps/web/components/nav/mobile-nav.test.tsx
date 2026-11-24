import { MobileNav, sectionOf } from '@/components/nav/mobile-nav';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('nextjs-toploader/app', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }) }));

describe('sectionOf', () => {
  it('puts organization pages in Organizations and model pages in Models', () => {
    expect(sectionOf('/')).toBe('/');
    expect(sectionOf('/models')).toBe('/models');
    expect(sectionOf('/organizations')).toBe('/organizations');
    expect(sectionOf('/evaluations/petri')).toBe('/evaluations');
    expect(sectionOf('/anthropic')).toBe('/organizations');
    expect(sectionOf('/anthropic/incidents/some-incident')).toBe('/organizations');
    expect(sectionOf('/openai/gpt-6-luna')).toBe('/models');
    expect(sectionOf('/openai/gpt-6-luna/system-card')).toBe('/models');
    expect(sectionOf('/settings')).toBe('/settings');
  });
});

describe('Help tab', () => {
  it('without the assistant, opens and closes the help buttons', () => {
    render(<MobileNav account={null} signedIn={false} />);
    const tab = screen.getByRole('button', { name: /Help$/ });
    const panel = document.getElementById(tab.getAttribute('aria-controls')!)!;
    expect(panel.hidden).toBe(true);
    fireEvent.click(tab);
    expect(tab.getAttribute('aria-expanded')).toBe('true');
    expect(panel.hidden).toBe(false);
    expect(panel.textContent).toContain('Get Started');
    fireEvent.click(screen.getByRole('button', { name: 'Close Help' }));
    expect(panel.hidden).toBe(true);
  });
});
