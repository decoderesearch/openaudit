import { InfiniteFeed, useWheelFromSide } from '@/components/infinite-feed';
import { render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('nextjs-toploader/app', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const ENTRIES = [{ key: 'a' }, { key: 'b' }];

/** The feed box at x 100 to 500, y 100 to 700, and its list, which can scroll 1000 px down. */
function feed(wide = true, right = false) {
  vi.stubGlobal('matchMedia', () => ({ matches: wide }));
  render(
    <InfiniteFeed
      title="Recent Updates"
      all={ENTRIES}
      wheelFrom={right ? 'right' : 'left'}
      renderEntry={(e) => <li key={e.key}>{e.key}</li>}
    />,
  );
  const section = screen.getByRole('region', { name: 'Recent Updates' });
  section.getBoundingClientRect = () => ({ left: 100, right: 500, top: 100, bottom: 700 }) as DOMRect;
  const box = section.querySelector<HTMLDivElement>('.overflow-y-auto')!;
  Object.defineProperties(box, {
    scrollHeight: { value: 1600, configurable: true },
    clientHeight: { value: 600, configurable: true },
  });
  box.scrollBy = vi.fn(({ top }: ScrollToOptions) => {
    box.scrollTop += top ?? 0;
  }) as unknown as typeof box.scrollBy;
  return box;
}

const wheel = (clientX: number, clientY: number, deltaY: number) => {
  const e = new WheelEvent('wheel', { deltaY, cancelable: true });
  Object.defineProperties(e, { clientX: { value: clientX }, clientY: { value: clientY } });
  window.dispatchEvent(e);
  return e;
};

describe('InfiniteFeed wheelFrom', () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it('scrolls the box on a wheel to its left, and not the page', () => {
    const box = feed();
    const e = wheel(40, 400, 300);
    expect(box.scrollTop).toBe(300);
    expect(e.defaultPrevented).toBe(true);
  });

  it('leaves the wheel to the page above the box and on the box', () => {
    const box = feed();
    expect(wheel(40, 50, 300).defaultPrevented).toBe(false);
    expect(wheel(200, 400, 300).defaultPrevented).toBe(false);
    expect(box.scrollTop).toBe(0);
  });

  it('leaves the wheel to the page when the box cannot scroll that way', () => {
    feed();
    expect(wheel(40, 400, -300).defaultPrevented).toBe(false);
  });

  it('does nothing on a narrow screen', () => {
    const box = feed(false);
    expect(wheel(40, 400, 300).defaultPrevented).toBe(false);
    expect(box.scrollTop).toBe(0);
  });

  it('with wheelFrom right, scrolls the box on a wheel to its right, and not to its left', () => {
    const box = feed(true, true);
    expect(wheel(40, 400, 300).defaultPrevented).toBe(false);
    expect(wheel(600, 400, 300).defaultPrevented).toBe(true);
    expect(box.scrollTop).toBe(300);
  });
});

function Middle() {
  const area = useRef<HTMLElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useWheelFromSide('gaps', area, box);
  return (
    <section ref={area} aria-label="Middle">
      <div ref={box} />
    </section>
  );
}

/** Three columns at x 0 to 100, 112 to 212 and 224 to 324, y 0 to 600. The middle box can scroll. */
function columns() {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  render(
    <div>
      <section aria-label="Left" />
      <Middle />
      <section aria-label="Right" />
    </div>,
  );
  ['Left', 'Middle', 'Right'].forEach((name, i) => {
    const left = i * 112;
    screen.getByRole('region', { name }).getBoundingClientRect = () =>
      ({ left, right: left + 100, top: 0, bottom: 600 }) as DOMRect;
  });
  const box = screen.getByRole('region', { name: 'Middle' }).firstElementChild as HTMLDivElement;
  Object.defineProperties(box, {
    scrollHeight: { value: 1600, configurable: true },
    clientHeight: { value: 600, configurable: true },
  });
  box.scrollBy = vi.fn(({ top }: ScrollToOptions) => {
    box.scrollTop += top ?? 0;
  }) as unknown as typeof box.scrollBy;
  return box;
}

describe('useWheelFromSide gaps', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('scrolls the box on a wheel in the gaps at its left and right', () => {
    const box = columns();
    expect(wheel(106, 300, 100).defaultPrevented).toBe(true);
    expect(wheel(218, 300, 100).defaultPrevented).toBe(true);
    expect(box.scrollTop).toBe(200);
  });

  it('leaves the wheel on the other columns and past them', () => {
    const box = columns();
    expect(wheel(50, 300, 100).defaultPrevented).toBe(false);
    expect(wheel(270, 300, 100).defaultPrevented).toBe(false);
    expect(wheel(400, 300, 100).defaultPrevented).toBe(false);
    expect(box.scrollTop).toBe(0);
  });
});
