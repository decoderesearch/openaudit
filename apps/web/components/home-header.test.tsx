import { HERO_SMALL_COOKIE } from '@/lib/home-hero';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomeHeader } from './home-header';

vi.mock('@/components/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock('@/components/home-tour', () => ({
  useHomeTourStart: () => {},
}));

const root = () => document.scrollingElement ?? document.documentElement;

/** A wide screen, with a page that can scroll 1000px further, and a hero 400px high. `small`: the
 * hero starts as the small bar. */
function page(small = false) {
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400);
  const root = document.scrollingElement ?? document.documentElement;
  Object.defineProperties(root, {
    scrollHeight: { value: 1800, configurable: true },
    clientHeight: { value: 800, configurable: true },
    scrollTop: { value: 0, configurable: true, writable: true },
  });
  const scrollBy = vi.fn();
  root.scrollBy = scrollBy as unknown as typeof root.scrollBy;
  render(
    <div>
      <HomeHeader title="OpenAudit" small={small} />
      <p>List</p>
      <div data-wheel-contain>
        <p>Panel</p>
      </div>
    </div>,
  );
  return scrollBy;
}

describe('HomeHeader', () => {
  afterEach(() => vi.restoreAllMocks());

  it('scrolls the page on a wheel down until the hero is gone', () => {
    const scrollBy = page();
    expect(fireEvent.wheel(screen.getByText('List'), { deltaY: 50 })).toBe(false);
    expect(scrollBy).toHaveBeenCalledWith({ top: 50 });
  });

  it('is small at the bar height, and large again at the top of the page', () => {
    page();
    root().scrollTop = 200;
    fireEvent.scroll(window);
    expect(document.cookie).not.toContain(`${HERO_SMALL_COOKIE}=1`);

    // At 336px (400 less the 64px bar), the hero is the bar. The page does not move.
    root().scrollTop = 350;
    fireEvent.scroll(window);
    expect(document.cookie).toContain(`${HERO_SMALL_COOKIE}=1`);
    expect(root().scrollTop).toBe(350);

    root().scrollTop = 0;
    fireEvent.scroll(window);
    expect(document.cookie).not.toContain(`${HERO_SMALL_COOKIE}=1`);
    expect(screen.getByRole('heading', { name: 'OpenAudit' })).toBeTruthy();
  });

  it('starts as the small bar, and gets large on a click on the title', () => {
    document.cookie = `${HERO_SMALL_COOKIE}=1; Path=/`;
    page(true);
    fireEvent.click(screen.getByRole('button', { name: 'OpenAudit' }));
    expect(document.cookie).not.toContain(`${HERO_SMALL_COOKIE}=1`);
    expect(screen.queryByRole('button', { name: 'OpenAudit' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'OpenAudit' })).toBeTruthy();
  });

  it('leaves a wheel in a box with its own wheel to that box', () => {
    const scrollBy = page();
    expect(fireEvent.wheel(screen.getByText('Panel'), { deltaY: 50 })).toBe(true);
    expect(scrollBy).not.toHaveBeenCalled();
  });
});
