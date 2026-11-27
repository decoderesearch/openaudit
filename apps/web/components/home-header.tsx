'use client';

import { EvalOfTheDay } from '@/components/eval-of-the-day';
import { heroButtons } from '@/components/hero-buttons';
import { LaunchPostLink } from '@/components/launch-post-link';
import { HERO_SMALL_COOKIE } from '@/lib/home-hero';
import type { DayRow } from '@/lib/server/eval-list-rows';
import { cn } from '@/lib/utils';
import { canScroll, OWN_WHEEL } from '@/lib/wheel-contain';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

/** The small bar's height in px, as `h-16`. */
const BAR = 64;
/** Two in a row, with `gap-4`, must fit a 375px screen. */
const LARGE = 'h-11 w-40 text-sm sm:w-44 lg:h-14 lg:w-56 lg:text-base xl:w-60 xl:text-lg';
const SMALL = 'h-7 w-36 text-[11px]';

/** "Get Started" and "Contribute", each in a slot of `size`. */
function HeroButtons({ size, slots }: { size: string; slots?: RefObject<(HTMLElement | null)[]> }) {
  return heroButtons(
    (i, button) => (
      <div
        key={i}
        ref={(el) => {
          if (slots) slots.current[i] = el;
        }}
        className={cn('relative shrink-0', size)}
      >
        {button}
      </div>
    ),
    false,
    size === SMALL,
  );
}

/** The small bar's row: the title at the left, and the buttons in a row at the right. Under `sm`,
 * the title is small, on two lines above the buttons. `tour`: the tutorial highlights the grid. */
function SmallRow({ title, buttons, tour }: { title: ReactNode; buttons: ReactNode; tour?: boolean }) {
  return (
    <div className="mx-auto flex h-full w-full max-w-page items-center justify-between gap-4 px-4 pr-6 max-sm:flex-col max-sm:justify-center max-sm:gap-1 max-sm:pr-4 sm:px-6 sm:pr-9">
      <div className="min-w-0 font-display font-bold text-white max-sm:max-w-full max-sm:text-center max-sm:text-[10px]/3 max-sm:font-semibold max-sm:text-sky-100 sm:pl-4 sm:text-base">
        {title}
      </div>
      <div data-tour={tour ? 'hero-buttons' : undefined} className="grid shrink-0 grid-cols-2 gap-1.5 max-sm:mx-auto">
        {buttons}
      </div>
    </div>
  );
}

/** Keeps the hero small on later visits, or not. */
function remember(small: boolean) {
  document.cookie = small
    ? `${HERO_SMALL_COOKIE}=1; Path=/; Max-Age=${365 * 86400}; SameSite=Lax`
    : `${HERO_SMALL_COOKIE}=; Path=/; Max-Age=0`;
}

type Box = { x: number; y: number; w: number; h: number };
type Parts = {
  bigBox: HTMLElement;
  bigTitle: HTMLElement;
  smallBox: HTMLElement;
  smallTitle: HTMLElement;
  bigSlots: HTMLElement[];
  smallSlots: HTMLElement[];
  card: HTMLElement | null;
  post: HTMLElement | null;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 0 until `a`, 1 from `b`, and a smooth curve between. */
function ease(a: number, b: number, t: number) {
  const u = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return u * u * (3 - 2 * u);
}
function boxIn(el: Element, root: Element): Box {
  const [r, o] = [el.getBoundingClientRect(), root.getBoundingClientRect()];
  return { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height };
}
const fontOf = (el: Element) => parseFloat(getComputedStyle(el).fontSize);

/** Moves the large hero's title and buttons `p` of the way (0 to 1) to their places in the small
 * bar. The title shrinks to the small title's place and fades out; then the small title fades in.
 * Under `sm`, the titles only fade, each in its place. The `card` and the `post` link fade out first. */
function place(
  hero: HTMLElement,
  p: number,
  { bigBox, bigTitle, smallBox, smallTitle, bigSlots, smallSlots, card, post }: Parts,
) {
  const [tl, ts] = [boxIn(bigBox, hero), boxIn(smallBox, hero)];
  const [fl, fs] = [fontOf(bigTitle), fontOf(smallTitle)];
  const slots = bigSlots.map((s, i) => [boxIn(s, hero), boxIn(smallSlots[i], hero)] as const);
  const [bl, bs] = [fontOf(bigSlots[0]), fontOf(smallSlots[0])];
  const fly = window.matchMedia('(min-width: 40rem)').matches;
  const to = fly ? ts : tl;
  // The anchor: the title's left edge, at the middle of its height.
  const [ax, ay] = [lerp(tl.x, to.x, p), lerp(tl.y + tl.h / 2, to.y + to.h / 2, p)];
  const f = fly ? lerp(fl, fs, p) : fl;
  const move = (el: HTMLElement, b: Box, scale: number, opacity: number) => {
    el.style.transform = `translate(${ax - b.x}px, ${ay - b.y - b.h / 2}px) scale(${scale})`;
    el.style.opacity = String(opacity);
  };
  move(bigTitle, tl, f / fl, 1 - ease(0.5, 0.8, p));
  // At its own size: scaled up, its one line would cross the buttons.
  if (fly) move(smallTitle, ts, 1, ease(0.8, 1, p));
  else Object.assign(smallTitle.style, { transform: '', opacity: String(ease(0.8, 1, p)) });
  smallTitle.style.pointerEvents = p > 0.8 ? 'auto' : 'none';
  for (const el of [card, post])
    if (el) Object.assign(el.style, { opacity: String(1 - ease(0, 0.6, p)), visibility: p < 0.6 ? '' : 'hidden' });
  slots.forEach(([l, s], i) => {
    const button = bigSlots[i].firstElementChild as HTMLElement | null;
    if (!button) return;
    Object.assign(button.style, {
      left: `${lerp(l.x, s.x, p) - l.x}px`,
      top: `${lerp(l.y, s.y, p) - l.y}px`,
      width: `${lerp(l.w, s.w, p)}px`,
      height: `${lerp(l.h, s.h, p)}px`,
      fontSize: `${lerp(bl, bs, p)}px`,
    });
  });
}

/** The home page's hero panel, the full width of the screen: the title and the buttons below it,
 * and the "Evaluation of the Day" (`ofTheDay`): from `lg` up at the right, and under `lg` in a band
 * below the hero, which does not fade.
 *
 * As the page scrolls, the hero gets shorter until it is the small bar (64px): the title and the
 * buttons move to their places in the bar, and the card fades. A scroll up makes it large again.
 * The bar fades as it scrolls away. `small`: the hero starts as the small bar (from a cookie, set
 * when the reader last scrolled it small): the title on one line, and the buttons at the right. A
 * click on the small title, or a scroll up at the top of the page, makes it large. `className`: the
 * large hero's height. From `lg` up, the page scrolls first: until the hero is gone, the mouse
 * wheel scrolls the page, not the lists below it; and a wheel up, when no box under it can scroll
 * up, scrolls the page. */
export function HomeHeader({
  title,
  small: initial,
  ofTheDay,
  className,
}: {
  title: string;
  small: boolean;
  ofTheDay?: DayRow | null;
  className?: string;
}) {
  const hero = useRef<HTMLElement>(null);
  const bigBox = useRef<HTMLDivElement>(null);
  const bigTitle = useRef<HTMLHeadingElement>(null);
  const smallBox = useRef<HTMLDivElement>(null);
  const smallTitle = useRef<HTMLSpanElement>(null);
  const bigSlots = useRef<(HTMLElement | null)[]>([]);
  const smallSlots = useRef<(HTMLElement | null)[]>([]);
  const card = useRef<HTMLDivElement>(null);
  const post = useRef<HTMLAnchorElement>(null);
  const [small, setSmall] = useState(initial);
  // The cookie's value, so that it is written only on a change.
  const saved = useRef(initial);
  // Set when the small bar grows into the large hero, scrolled so that only its bar shows.
  const grown = useRef(false);

  // Places the parts for the scroll position.
  const sync = useCallback(() => {
    const h = hero.current;
    if (!h) return;
    const root = document.scrollingElement ?? document.documentElement;
    const [height, top] = [h.offsetHeight, root.scrollTop];
    h.style.opacity = String(Math.min(1, Math.max(0, 1 - (top - (height - BAR)) / BAR)));
    const parts = {
      bigBox: bigBox.current,
      bigTitle: bigTitle.current,
      smallBox: smallBox.current,
      smallTitle: smallTitle.current,
      bigSlots: bigSlots.current,
      smallSlots: smallSlots.current,
      card: card.current,
      post: post.current,
    };
    if (!parts.bigBox || !parts.bigTitle || !parts.smallBox || !parts.smallTitle) return;
    const p = Math.min(1, Math.max(0, top / Math.max(1, height - BAR)));
    place(h, p, parts as Parts);
    if (p >= 1 ? !saved.current : p <= 0 && saved.current) remember((saved.current = p >= 1));
  }, []);

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 64rem)');
    const root = document.scrollingElement ?? document.documentElement;
    const grow = () => {
      grown.current = true;
      setSmall(false);
    };
    const onWheel = (e: WheelEvent) => {
      const t = e.target instanceof Element ? e.target : null;
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) || t?.closest(OWN_WHEEL)) return;
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? root.clientHeight : 1);
      if (dy > 0) {
        const left = root.scrollHeight - root.clientHeight - root.scrollTop;
        if (!wide.matches || left < 1) return;
        e.preventDefault();
        e.stopPropagation();
        root.scrollBy({ top: Math.min(dy, left) });
        return;
      }
      if (dy === 0) return;
      for (let n = t as HTMLElement | null; n && n !== root && n !== document.body; n = n.parentElement) {
        if (canScroll(n, true, dy)) return;
      }
      if (!bigBox.current) {
        if (root.scrollTop <= 0) grow();
        return;
      }
      if (!wide.matches || root.scrollTop <= 0) return;
      e.preventDefault();
      e.stopPropagation();
      root.scrollBy({ top: Math.max(dy, -root.scrollTop) });
    };
    // On a touch screen: a pull down at the top of the page.
    let startY: number | null = null;
    const onTouchStart = (e: TouchEvent) => (startY = e.touches[0]?.clientY ?? null);
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (startY === null || y === undefined || bigBox.current || root.scrollTop > 0) return;
      if (y - startY <= 30) return;
      startY = null;
      grow();
    };
    window.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    window.addEventListener('wheel', onWheel, { passive: false, capture: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    return () => {
      window.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      window.removeEventListener('wheel', onWheel, { capture: true });
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, [sync]);

  useLayoutEffect(() => {
    if (!small && grown.current && hero.current) {
      grown.current = false;
      (document.scrollingElement ?? document.documentElement).scrollTop = hero.current.offsetHeight - BAR;
    }
    sync();
  }, [small, sync]);

  const expand = () => {
    (document.scrollingElement ?? document.documentElement).scrollTop = 0;
    remember((saved.current = false));
    setSmall(false);
  };

  if (small)
    return (
      <section ref={hero} aria-label="About OpenAudit" className="h-16 w-full bg-sky-800">
        <SmallRow
          title={
            <h1>
              <button
                type="button"
                title="Show the full panel"
                aria-expanded={false}
                onClick={expand}
                className="block max-w-full cursor-pointer truncate transition-colors hover:text-sky-100 max-sm:text-balance max-sm:whitespace-normal"
              >
                {title}
              </button>
            </h1>
          }
          buttons={<HeroButtons size={SMALL} />}
          tour
        />
      </section>
    );
  return (
    <>
      <section
        ref={hero}
        aria-label="About OpenAudit"
        className={cn('relative flex w-full items-center overflow-hidden bg-sky-800', className)}
      >
        <div className="mx-auto flex w-full max-w-page items-center gap-10 px-4 py-10 sm:px-6 lg:py-0 xl:gap-16">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-6 lg:items-start lg:gap-8 lg:pl-4">
            <div className="flex flex-col items-center gap-3 lg:items-start">
              <LaunchPostLink ref={post} />
              <div ref={bigBox}>
                <h1
                  ref={bigTitle}
                  className="origin-left text-center font-display text-[1.625rem] leading-tight font-extrabold text-balance text-white md:text-4xl lg:text-left lg:text-[2.125rem] xl:text-[2.75rem]"
                >
                  {title}
                </h1>
              </div>
            </div>
            <div data-tour="hero-buttons" className="flex gap-4">
              <HeroButtons size={LARGE} slots={bigSlots} />
            </div>
          </div>
          {ofTheDay && (
            <div ref={card} className="shrink-0 max-lg:hidden">
              <EvalOfTheDay row={ofTheDay} className="w-[26rem] xl:w-[28rem]" />
            </div>
          )}
        </div>
        {/* The places in the small bar, which is the hero's last 64px when it has scrolled up. A
          click on its title scrolls back to the top. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-16">
          <SmallRow
            title={
              <div ref={smallBox}>
                <span
                  ref={smallTitle}
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="block origin-left cursor-pointer truncate hover:text-sky-100 max-sm:text-balance max-sm:whitespace-normal"
                  style={{ opacity: 0, pointerEvents: 'none' }}
                >
                  {title}
                </span>
              </div>
            }
            buttons={heroButtons((i) => (
              <span
                key={i}
                ref={(el) => {
                  smallSlots.current[i] = el;
                }}
                className={cn('block', SMALL)}
              />
            ))}
          />
        </div>
      </section>
      {ofTheDay && (
        <div className="w-full bg-sky-800 px-4 pb-8 sm:px-6 lg:hidden">
          <EvalOfTheDay row={ofTheDay} className="mx-auto max-w-md" />
        </div>
      )}
    </>
  );
}
