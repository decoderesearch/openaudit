import Link from '@/components/link';
import { OWN_WHEEL } from '@/lib/wheel-contain';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Boxes } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { NavMenu } from './nav-menu';

vi.mock('@/components/link', () => ({
  default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...p}>
      {children}
    </a>
  ),
}));

type Body = React.ComponentProps<typeof NavMenu<string[]>>['body'];

function menu(body: Body = ({ data }) => <p>{data.join(', ')}</p>) {
  render(
    <div>
      <NavMenu<string[]>
        label="Models"
        icon={Boxes}
        href="/models"
        active={false}
        api="/api/nav-models"
        initial={['Model A']}
        noun="models"
        body={body}
      />
      <button>Outside</button>
    </div>,
  );
  return screen.getByRole('link', { name: /Models/ });
}

/** Opens the panel from the keyboard, with no wait. */
const open = (link: HTMLElement) => fireEvent.keyDown(link, { key: 'ArrowDown' });

describe('NavMenu', () => {
  it('does not open on hover', () => {
    vi.useFakeTimers();
    try {
      const link = menu();
      fireEvent.pointerEnter(link.parentElement!);
      act(() => vi.advanceTimersByTime(500));
      expect(screen.queryByText('Model A')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens the panel on a click and closes it on the next, with no page change', () => {
    const link = menu();
    expect(fireEvent.click(link)).toBe(false);
    expect(screen.getByText('Model A')).toBeTruthy();
    expect(link.getAttribute('aria-expanded')).toBe('true');
    expect(fireEvent.click(link)).toBe(false);
    expect(screen.queryByText('Model A')).toBeNull();
  });

  it('closes on a click outside, on focus outside, and on Escape', () => {
    const link = menu();
    open(link);
    fireEvent.pointerDown(screen.getByText('Model A'));
    expect(screen.getByText('Model A')).toBeTruthy();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByText('Model A')).toBeNull();

    open(link);
    fireEvent.focusIn(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByText('Model A')).toBeNull();

    open(link);
    fireEvent.keyDown(link, { key: 'Escape' });
    expect(screen.queryByText('Model A')).toBeNull();
  });

  it('lets a modified click open the page', () => {
    const link = menu();
    expect(fireEvent.click(link, { metaKey: true })).toBe(true);
    expect(screen.queryByText('Model A')).toBeNull();
  });

  it('stays open after a modified click on a panel link, and closes after a plain click', () => {
    const link = menu(({ data, onPick }) => (
      // The evals menu calls onPick with no event, from a click handler on the list.
      <div onClick={() => onPick()}>
        <Link href="/models/a">{data[0]}</Link>
      </div>
    ));
    open(link);
    fireEvent.click(screen.getByText('Model A'), { ctrlKey: true });
    fireEvent.click(screen.getByText('Model A'), { metaKey: true });
    fireEvent.click(screen.getByText('Model A'), { shiftKey: true });
    expect(screen.getByText('Model A')).toBeTruthy();
    fireEvent.click(screen.getByText('Model A'));
    expect(screen.queryByText('Model A')).toBeNull();
  });

  it('does not let a wheel in the panel scroll the page', () => {
    const link = menu(({ data }) => (
      <div>
        <h2>Head</h2>
        <div data-testid="list" style={{ overflowY: 'auto' }}>
          <p>{data[0]}</p>
        </div>
      </div>
    ));
    open(link);
    const list = screen.getByTestId('list');
    Object.defineProperties(list, { scrollHeight: { value: 300 }, clientHeight: { value: 100 } });
    const row = screen.getByText('Model A');
    // The page's own wheel handlers skip the panel.
    expect(row.closest(OWN_WHEEL)).toBeTruthy();
    // A wheel event is not canceled while the list can scroll.
    expect(fireEvent.wheel(row, { deltaY: 50 })).toBe(true);
    expect(fireEvent.wheel(row, { deltaY: -50 })).toBe(false);
    list.scrollTop = 200;
    expect(fireEvent.wheel(row, { deltaY: 50 })).toBe(false);
    expect(fireEvent.wheel(row, { deltaY: -50 })).toBe(true);
    expect(fireEvent.wheel(screen.getByText('Head'), { deltaY: -50 })).toBe(false);
  });
});
