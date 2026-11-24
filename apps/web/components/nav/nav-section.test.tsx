import { MobileNav } from '@/components/nav/mobile-nav';
import { NavSection } from '@/components/nav/nav-section';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const pathname = { value: '/evaluations/workspace-lens-readout' };
vi.mock('next/navigation', () => ({
  usePathname: () => pathname.value,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('nextjs-toploader/app', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const selected = () =>
  screen.getByRole('navigation', { name: 'Sections' }).querySelector('[aria-current="page"]')?.textContent?.trim() ??
  null;

afterEach(() => {
  pathname.value = '/evaluations/workspace-lens-readout';
});

describe('NavSection', () => {
  it('selects Methods for a method eval and Models for a model eval', () => {
    const { rerender } = render(
      <>
        <MobileNav account={null} signedIn={false} />
        <NavSection method />
      </>,
    );
    expect(selected()).toBe('Methods');
    rerender(
      <>
        <MobileNav account={null} signedIn={false} />
        <NavSection method={false} />
      </>,
    );
    expect(selected()).toBe('Models');
  });

  it('selects no tab after the page that set it goes', () => {
    const { rerender } = render(
      <>
        <MobileNav account={null} signedIn={false} />
        <NavSection method />
      </>,
    );
    expect(selected()).toBe('Methods');
    rerender(<MobileNav account={null} signedIn={false} />);
    expect(selected()).toBeNull();
  });

  it('follows the page to a new path, then uses the path rule when the page goes', () => {
    const { rerender } = render(
      <>
        <MobileNav account={null} signedIn={false} />
        <NavSection method />
      </>,
    );
    pathname.value = '/organizations';
    rerender(
      <>
        <MobileNav account={null} signedIn={false} />
        <NavSection method />
      </>,
    );
    expect(selected()).toBe('Methods');
    rerender(<MobileNav account={null} signedIn={false} />);
    expect(selected()).toBe('Orgs');
  });
});
