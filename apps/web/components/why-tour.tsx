'use client';

import { AttestationForm, hasAttestation } from '@/components/eval-attestation';
import { FOLD_OPEN } from '@/components/fold';
import { markTutorialSeen } from '@/components/tutorial-seen';
import { cn } from '@/lib/utils';
import { WHY_REASONS } from '@/lib/why';
import { SHORT_TOUR, WHY_TOURS, type TourStep } from '@/lib/why-tour';
import { driver, type Driver, type PopoverDOM, type Side } from 'driver.js';
import 'driver.js/dist/driver.css';
import { Play } from 'lucide-react';
import type { PrefetchKind } from 'next/dist/client/components/router-reducer/router-reducer-types';
import { useRouter } from 'nextjs-toploader/app';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './home-tour.css';

type Router = ReturnType<typeof useRouter>;

/** How long a step waits for its page and its element, in ms. Then its popover shows in the center. */
const WAIT = 20_000;
/** How long the popover takes to move to the next step's place, in ms. Also in `home-tour.css`. */
const MOVE = 350;
/** A full prefetch: the router keeps the whole page, so the next step's page shows with no request. */
const FULL = { kind: 'full' as PrefetchKind };
/** The reasons of the full tour, in the Features page's order. */
const ALL = WHY_REASONS.map((r) => r.id).filter((id) => WHY_TOURS[id]);

/** The first step when the tour has `gated` steps and the reader has not made the statement. */
const CONSENT: TourStep = {
  path: '/features',
  title: 'Tour Prerequisite',
  text: `<p>Some parts of this tour show evaluation content, which we don't want AI agents to scrape or train against. Confirm the following, otherwise, large parts of the tour will be skipped.</p>`,
};

const OUTRO_BUTTON =
  'flex cursor-pointer items-center justify-center gap-x-1.5 rounded-full px-3 py-2 text-sm font-semibold text-white transition-colors';
/** Lucide's Play icon. */
const PLAY = `<svg aria-hidden="true" viewBox="0 0 24 24" class="size-3.5 shrink-0 fill-current" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/></svg>`;
const OUTRO_TEXT = `<p>Now, go explore OpenAudit yourself, and then try the "How to Contribute" Safety Research agent - you may be surprised how easy and fun it is to use!</p><p>If you have questions or feedback, click the Help button for FAQs, ask our chatbot, or to contact us directly.</p>`;
const CONTRIBUTE = `<button type="button" class="why-tour-contribute ${OUTRO_BUTTON} bg-emerald-700 hover:bg-emerald-600">How to Contribute</button>`;
const EXPLORE = `<button type="button" class="why-tour-explore ${OUTRO_BUTTON} bg-sky-800 hover:bg-sky-700">Explore OpenAudit</button>`;

/** The last step of the full tour. Its buttons are in its text, not in the footer. */
const OUTRO: TourStep = {
  path: '/',
  title: 'End of Tutorial',
  text: `${OUTRO_TEXT}<div class="mt-5 grid grid-cols-2 gap-3">${CONTRIBUTE}${EXPLORE}</div>`,
};

/** The last step of the short tour: `OUTRO`, with a button that starts the full tour. */
const SHORT_OUTRO: TourStep = {
  ...OUTRO,
  text: `${OUTRO_TEXT}<div class="mt-5 grid grid-cols-3 gap-2"><button type="button" class="why-tour-full ${OUTRO_BUTTON} bg-slate-600 hover:bg-slate-500">${PLAY}Full Tutorial</button>${CONTRIBUTE}${EXPLORE}</div>`,
};
const isOutro = (s: TourStep | undefined) => s === OUTRO || s === SHORT_OUTRO;

/** At the top of a `gated` step when the reader did not make the statement. */
const HIDDEN = `<div class="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs/relaxed text-amber-900"><strong class="text-amber-900!">Caution: evaluation content is hidden.</strong> You did not agree to our terms, so this page does not show it. This is what it would show:</div>`;

/** The tour that runs. It is not in a component, so it goes on when its page closes. */
let active: Driver | null = null;
/** A box over the top of an element that is too tall for the screen: the tour highlights it. */
let ghost: HTMLDivElement | null = null;
/** A dark screen with a spinner, from the click on "Tutorial" until the first step shows. */
let veil: HTMLDivElement | null = null;

function showVeil() {
  if (veil) return;
  veil = document.createElement('div');
  veil.className = 'why-tour-veil';
  veil.role = 'status';
  veil.ariaLabel = 'Loading the tour';
  veil.innerHTML = '<div class="why-tour-spinner"></div>';
  document.body.append(veil);
}

function hideVeil() {
  const v = veil;
  veil = null;
  v?.classList.add('why-tour-veil-out');
  setTimeout(() => v?.remove(), 400);
}

/** The `CONSENT` step's form: `box` is in its popover; `TourConsentHost` puts the form in it. */
type Consent = { box: HTMLElement; onDone: () => void; onShown: () => void };
let consent: Consent | null = null;
const listeners = new Set<() => void>();
const setConsent = (c: Consent | null) => {
  consent = c;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

const here = (path: string) => location.pathname + location.search === path;
const shows = (e: Element) => e.getClientRects().length > 0;
const headingOf = (e: Element) => e.querySelector('h1, h2, h3')?.textContent?.replace(/#$/, '').trim().toLowerCase();
/** The step shows eval content that the page hides. */
const hidden = (step: TourStep) => !!step.gated && !hasAttestation();

function find(step: TourStep): Element | undefined {
  if (!step.target) return undefined;
  let el = [...document.querySelectorAll(step.target)].find(
    (e) => shows(e) && (!step.heading || headingOf(e) === step.heading.toLowerCase()),
  );
  for (let i = 0; i < (step.up ?? 0) && el; i++) el = el.parentElement ?? undefined;
  return el;
}

/** Scrolls the list that `el` is in to its end. */
function toEnd(el: Element) {
  let p = el.parentElement;
  while (p && !(/auto|scroll/.test(getComputedStyle(p).overflowY) && p.scrollHeight > p.clientHeight)) {
    p = p.parentElement;
  }
  if (p) p.scrollTop = p.scrollHeight;
}

/** The eyebrow of a step of the reason `reason`. */
function partName(part: string, reason: string) {
  if (part === 'Problem') return `Problem #${Object.keys(WHY_TOURS).indexOf(reason) + 1}`;
  return part === 'Examples' ? 'Example' : part === 'Caveats' ? 'Caveat' : part;
}

/** `el`, or a `ghost` over the part of it that fits the screen: the part in its scroll box if it is
 * wider than the screen, and its top if it is too tall. */
function fit(el: Element | undefined): Element | undefined {
  ghost?.remove();
  ghost = null;
  if (!el) return el;
  let { left, top, right, bottom } = el.getBoundingClientRect();
  const wide = right > document.documentElement.clientWidth;
  if (wide) {
    let p = el.parentElement;
    while (p && !/auto|scroll/.test(getComputedStyle(p).overflowX)) p = p.parentElement;
    if (p) {
      const b = p.getBoundingClientRect();
      [left, top, right, bottom] = [
        Math.max(left, b.left),
        Math.max(top, b.top),
        Math.min(right, b.right),
        Math.min(bottom, b.bottom),
      ];
    }
  }
  // With no room beside it, too tall if the popover does not fit above or below it.
  const beside = Math.max(left, document.documentElement.clientWidth - right) - PANEL.w - GAP >= 0;
  const tall = bottom - top > innerHeight * 0.9 || (!beside && bottom - top + PANEL.h + 2 * GAP > floor());
  if (!wide && !tall) return el;
  ghost = document.createElement('div');
  Object.assign(ghost.style, {
    position: 'absolute',
    left: `${left + scrollX}px`,
    top: `${top + scrollY}px`,
    width: `${right - left}px`,
    height: `${tall ? Math.min(innerHeight * 0.6, bottom - top) : bottom - top}px`,
    pointerEvents: 'none',
  });
  if (tall) ghost.dataset.tall = '';
  document.body.append(ghost);
  return ghost;
}

/** The popover's usual size, to pick its side before it shows. `act`: the height on an action step. */
const PANEL = { w: 440, h: 250, act: 100 };
/** The space between an element and its popover: driver.js's `stagePadding` + `popoverOffset`. */
const GAP = 20;

/** The popover's height on the step that shows, once it shows. */
let measured: number | undefined;
const panelHeight = (action: boolean) => measured ?? (action ? PANEL.act : PANEL.h);

/** The bottom of the tour's space: the top of the phone's bottom navbars, or the screen's bottom. */
function floor() {
  const dock = document.querySelector('nav[aria-label="Sections"]')?.getBoundingClientRect().top;
  return dock ? Math.min(dock, innerHeight) : innerHeight;
}

/** The top of the tour's space for a target: below the navbar. */
const ceiling = () => (document.querySelector('header')?.getBoundingClientRect().bottom ?? 0) + GAP / 2;

/** The popover's side of `el`: above it, or beside it if that side has clearly more space. Below it
 * if only that side fits. */
function sideOf(el: Element | undefined, action: boolean): Side {
  if (!el?.isConnected) return 'top';
  const r = el.getBoundingClientRect();
  const h = panelHeight(action);
  const above = r.top - h - GAP;
  const below = floor() - r.bottom - h - GAP;
  const left = r.left - PANEL.w - GAP;
  const right = document.documentElement.clientWidth - r.right - PANEL.w - GAP;
  const beside = Math.max(left, right);
  if (beside < 0 || (above >= 0 && beside <= above + 100)) return above < 0 && below >= 0 ? 'bottom' : 'top';
  return left > right ? 'left' : 'right';
}

/** If the popover fits on no side of `el`, scrolls `el` down to the tour's bottom (popover above) or
 * up to the navbar (popover below), if they fit there. True if it scrolled. */
function place(el: Element, action: boolean) {
  const r = el.getBoundingClientRect();
  const h = panelHeight(action) + GAP;
  const beside = Math.max(r.left, document.documentElement.clientWidth - r.right) - PANEL.w - GAP;
  // Below `el`, only driver.js's `stagePadding`.
  const end = floor() - GAP / 2;
  const head = ceiling();
  if (beside >= 0 || (r.top >= h && r.bottom <= end) || (r.top >= head && r.bottom + h <= end)) return false;
  const max = document.documentElement.scrollHeight - innerHeight;
  for (const by of [r.height + h <= end ? r.bottom - end : NaN, r.height + h <= end - head ? r.top - head : NaN]) {
    if (scrollY + by >= 0 && scrollY + by <= max) {
      scrollBy({ top: by, behavior: 'instant' });
      return true;
    }
  }
  return false;
}

/** Resolves when the step's page shows its element (if `target`), or after `WAIT`. */
function arrive(step: TourStep, target: boolean) {
  const start = Date.now();
  return new Promise<void>((resolve) => {
    const tick = () => {
      if ((here(step.path) && (!target || !step.target || find(step))) || Date.now() - start > WAIT) {
        // A short wait, so the page's layout is done before the highlight.
        setTimeout(resolve, 300);
      } else setTimeout(tick, 100);
    };
    tick();
  });
}

/** Lucide's ChevronDown and Check icons. */
const CHEVRON = `<svg aria-hidden="true" viewBox="0 0 24 24" class="size-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;
const CHECK = `<svg aria-hidden="true" viewBox="0 0 24 24" class="size-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;

/** The name of the reason `id`, the section of the tour that shows. */
function reasonLabel(id: string) {
  const label = document.createElement('span');
  label.className = 'why-tour-menu min-w-0 truncate text-[11px] font-medium text-slate-300 uppercase';
  label.textContent = WHY_TOURS[id]?.find((s) => s.part === 'Solution')?.title ?? id;
  return label;
}

/** Runs the tours of the reasons `ids`, one after the other. Each step opens its page. At the end,
 * the tour of one reason goes back to the page it started on, or from the Features page to the
 * reason's row; the full tour shows `OUTRO`
 * on the home page. On exit, it stays on its page. `short`: run `SHORT_TOUR` instead, with
 * `SHORT_OUTRO` last. It has no `gated` steps.
 * A step's popover also shows the reason's earlier steps, faded: click one to go back to it.
 * Without the reader's statement, a `gated` step highlights nothing and shows `HIDDEN`. `ask`: show
 * `CONSENT` first if the tour has `gated` steps. The browser's back and forward buttons go to the
 * step with that page; to a page with no step, they stop the tour. An `action` step has no Next:
 * the reader clicks its target. */
function startTour(ids: string[], router: Router, ask = true, short = false) {
  const reasons = short ? SHORT_TOUR : ids.flatMap((id) => (WHY_TOURS[id] ?? []).map((s) => ({ ...s, reason: id })));
  if (!reasons.length) return;
  if (short || ids.length > 1) markTutorialSeen();
  const steps: (TourStep & { reason?: string })[] = [
    ...(ask && !hasAttestation() && reasons.some((s) => s.gated) ? [CONSENT] : []),
    ...reasons,
    ...(short ? [SHORT_OUTRO] : ids.length > 1 ? [OUTRO] : []),
  ];
  /** The full tour: Back is next to Next, and the footer has a menu of its features. */
  const long = !short && ids.length > 1;
  const from = location.pathname === '/features' ? null : location.pathname + location.search;
  const end = ids.length === 1 ? (from ?? `/features#${ids[0]}`) : '/features';
  const old = active;
  active = null;
  old?.destroy();
  showVeil();
  document.documentElement.classList.add('why-tour-on');
  let busy = false;
  /** Goes up at each step change, so a change that waits for its page stops if a newer one starts. */
  let turn = 0;
  /** The tour stopped early, or from a browser navigation, so it stays on that page. */
  let quiet = false;
  /** The step that the popover showed last. */
  let shown = -1;
  /** The element of each step, from its `element`. */
  const at: (Element | undefined)[] = [];
  /** A copy of the popover from before a step change in the same reason and page. It moves to the
   * new popover's place, then the new popover shows. */
  let mover: HTMLElement | null = null;
  /** The target of the `action` step that shows: a click in it goes to the next step. */
  let live: { el: Element; next: number } | null = null;
  /** A fixed box at the highlight's place during a page change. */
  let anchor: HTMLDivElement | null = null;

  /** Before a page change: driver.js measures `anchor`, not the old target that the change removes
   * (that gives 0×0 at the top left). So the highlight and popover stay still until the next step
   * shows, then move from there. `__activeElement` is the element of driver.js's `refresh`. */
  const hold = () => {
    const state = d.getState() as { activeElement?: Element; __activeElement?: Element };
    const el = state.__activeElement;
    if (!el?.isConnected) return;
    const r = el.getBoundingClientRect();
    anchor?.remove();
    anchor = document.createElement('div');
    Object.assign(anchor.style, {
      position: 'fixed',
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
      pointerEvents: 'none',
      visibility: 'hidden',
    });
    document.body.append(anchor);
    state.activeElement = state.__activeElement = anchor;
  };
  const unhold = () => {
    anchor?.remove();
    anchor = null;
  };

  /** With the popover's real height: a tall target's ghost gets short enough to fit above or below
   * the popover, and the target scrolls to where they both fit. */
  const settle = () => {
    const i = d.getActiveIndex();
    const el = i === undefined ? undefined : at[i];
    const pop = document.querySelector<HTMLElement>('.driver-popover:not(.why-tour-mover)');
    if (i === undefined || !el?.isConnected || !pop) return;
    measured = pop.offsetHeight;
    let moved = false;
    if (el === ghost && ghost.dataset.tall !== undefined) {
      const room = floor() - ceiling() - measured - 2 * GAP;
      const h = Math.max(innerHeight * 0.3, Math.min(ghost.offsetHeight, room));
      moved = h !== ghost.offsetHeight;
      ghost.style.height = `${h}px`;
    }
    if (place(el, !!steps[i].action) || moved) d.refresh();
  };

  const disarm = () => {
    live = null;
    document
      .querySelectorAll('.why-tour-action, .why-tour-wait')
      .forEach((e) => e.classList.remove('why-tour-action', 'why-tour-wait'));
    document.querySelectorAll('.why-tour-off').forEach((e) => e.classList.remove('why-tour-off'));
    document.querySelectorAll('[data-why-tour-title]').forEach((e) => {
      e.setAttribute('title', e.getAttribute('data-why-tour-title') ?? '');
      e.removeAttribute('data-why-tour-title');
    });
  };
  /** Makes `el` the target of step `i`, an `action` step. Its `title` tooltips do not show. */
  const arm = (el: Element, i: number) => {
    live = { el, next: i + 1 };
    el.classList.add('why-tour-action');
    for (const c of el.querySelectorAll('a, button, input, select, textarea, [role="button"]')) {
      if (!c.closest(steps[i].action ?? '')) c.classList.add('why-tour-off');
    }
    for (const c of [el, ...el.querySelectorAll('[title]')]) {
      if (!c.hasAttribute('title')) continue;
      c.setAttribute('data-why-tour-title', c.getAttribute('title') ?? '');
      c.removeAttribute('title');
    }
  };
  /** The reader scrolls only the popover. The tour's code still scrolls the page (`why-tour-on`). */
  const still = (e: Event) => {
    if (!(e.target instanceof Element && e.target.closest('.driver-popover'))) e.preventDefault();
  };
  /** `live`, or the target of the `action` step whose highlight is moving to it, before its popover
   * shows and `arm` runs. A click there must not open the link without the tour. */
  const actionTarget = () => {
    if (live) return live;
    const i = d.isActive() ? d.getActiveIndex() : undefined;
    const s = i === undefined ? undefined : steps[i];
    const el = s?.action && !hidden(s) ? find(s) : undefined;
    return el && i !== undefined ? { el, next: i + 1 } : null;
  };
  const onClick = (e: MouseEvent) => {
    const t = actionTarget();
    if (!t || !(e.target instanceof Node) || !t.el.contains(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (busy) return;
    t.el.classList.add('why-tour-wait');
    // The next page can take a while: a spinner shows in the popover's corner.
    if (!here(steps[t.next].path)) d.getState('popover')?.wrapper.classList.add('why-tour-busy');
    void go(t.next);
  };

  /** Step `j` in its reason's stack, which starts at step `first`. `current`: with `HIDDEN`. */
  const entry = (j: number, first: number, current: boolean) => {
    const s = steps[j];
    const lead = s.part === 'Solution' && steps[j - 1]?.part !== 'Solution';
    const el = document.createElement('div');
    el.className = cn(
      'why-tour-entry',
      j === first && s.part === 'Problem' && 'why-tour-lead',
      s.action && 'font-semibold',
    );
    const eyebrow =
      j === first || steps[j - 1].part !== s.part || (!!s.title && (s.part === 'Examples' || s.part === 'Caveats'));
    el.innerHTML =
      (s.part && eyebrow
        ? `<div class="why-tour-part why-tour-${s.part.toLowerCase()}">${partName(s.part, s.reason ?? '')}</div>`
        : '') +
      (s.title
        ? `<div class="why-tour-title${lead ? ' font-bold!' : ''}">${lead ? '<span class="text-slate-500">OpenAudit Lets You</span> ' : ''}${s.title}</div>`
        : '') +
      (current && hidden(s) ? HIDDEN : '') +
      s.text;
    return el;
  };

  /** The steps of step `i`'s reason, up to `i`, and `play`, which runs the change from step `from`:
   * from `i - 1`, it fades that step out and `i` in; from a later step, it fades the steps after `i`
   * away. */
  const stack = (i: number, from: number) => {
    let first = i;
    while (first > 0 && steps[first - 1].reason === steps[i].reason) first--;
    const grow = from === i - 1;
    const shrink = from > i && steps[from]?.reason === steps[i].reason;
    const box = document.createElement('div');
    box.className = 'why-tour-stack';
    for (let j = first; j <= (shrink ? from : i); j++) {
      const el = entry(j, first, j === i);
      if (j < i) {
        el.role = 'button';
        el.tabIndex = 0;
        el.onclick = () => void go(j, '.driver-popover-prev-btn');
        el.onkeydown = (e) => e.key === 'Enter' && el.click();
      } else if (j > i) el.ariaHidden = 'true';
      if (shrink ? j < from : grow ? j < i - 1 : j < i) el.classList.add('why-tour-past');
      if (grow && j === i) el.classList.add('why-tour-enter');
      box.append(el);
    }
    const last = box.children[i - first] as HTMLElement;
    const action = !!steps[i].action;
    if (action) box.style.overflowY = 'hidden';
    /** At most step `i` + 50px, or only step `i` on an action step. Call when `box` shows. */
    const fit = () => (box.style.maxHeight = `min(${last.offsetHeight + (action ? 0 : 50)}px, 70vh)`);
    const scroll = () => {
      const end = box.scrollHeight - box.clientHeight;
      box.scrollTop = grow ? Math.max(0, last.offsetTop - box.clientHeight) : end;
    };
    const play = () =>
      requestAnimationFrame(() => {
        if (grow) {
          last.previousElementSibling?.classList.add('why-tour-past');
          last.classList.remove('why-tour-enter');
          // Not `scrollHeight`: it has the 6px slide of `last`, so the scroll goes too far.
          box.scrollTo({ top: last.offsetTop + last.offsetHeight - box.clientHeight, behavior: 'smooth' });
        } else if (shrink) {
          last.classList.remove('why-tour-past');
          const gone = [...box.children].slice(i - first + 1);
          gone.forEach((e) => e.classList.add('why-tour-enter'));
          setTimeout(() => {
            gone.forEach((e) => e.remove());
            if (active !== d) return;
            const pop = d.getState('popover')?.wrapper;
            pop?.classList.add('why-tour-settle');
            d.refresh();
            setTimeout(() => pop?.classList.remove('why-tour-settle'), 300);
          }, 400);
        }
      });
    return { box, fit, scroll, play };
  };

  /** Shows `pop`'s copy at its place, for `mover`. */
  const copy = (pop: HTMLElement) => {
    const r = pop.getBoundingClientRect();
    const c = pop.cloneNode(true) as HTMLElement;
    c.removeAttribute('id');
    c.querySelectorAll('[id]').forEach((e) => e.removeAttribute('id'));
    c.querySelectorAll('.home-tour-loading').forEach((e) => e.classList.remove('home-tour-loading'));
    c.classList.remove('why-tour-high');
    c.classList.add('why-tour-grow', 'why-tour-mover');
    c.inert = true;
    Object.assign(c.style, {
      top: `${r.top}px`,
      left: `${r.left}px`,
      right: 'auto',
      bottom: 'auto',
      width: `${r.width}px`,
    });
    pop.parentElement?.append(c);
    const from = pop.querySelector('.why-tour-stack');
    const to = c.querySelector('.why-tour-stack');
    if (from && to) to.scrollTop = from.scrollTop;
    return c;
  };

  /** The full tour's feature menu: the name of `reason`, and a list to jump to another feature. */
  const jumpMenu = (reason: string) => {
    const menu = document.createElement('div');
    menu.className = 'why-tour-jump';
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'why-tour-jump-open';
    open.ariaHasPopup = 'menu';
    open.ariaExpanded = 'false';
    const name = document.createElement('span');
    name.className = 'truncate';
    name.textContent = WHY_REASONS.find((r) => r.id === reason)?.head ?? reason;
    open.append(name);
    open.insertAdjacentHTML('beforeend', CHEVRON);
    const list = document.createElement('div');
    list.className = 'why-tour-jump-list';
    list.role = 'menu';
    list.hidden = true;
    list.innerHTML = '<div class="why-tour-jump-head" aria-hidden="true">Jump To</div>';
    const outside = (e: PointerEvent) => !menu.contains(e.target as Node) && toggle(false);
    const toggle = (on: boolean) => {
      list.hidden = !on;
      open.ariaExpanded = String(on);
      if (on) document.addEventListener('pointerdown', outside, true);
      else document.removeEventListener('pointerdown', outside, true);
    };
    for (const id of ids) {
      const item = document.createElement('button');
      item.type = 'button';
      item.role = 'menuitem';
      item.className = cn('why-tour-jump-item', id === reason && 'why-tour-jump-on');
      item.innerHTML = id === reason ? CHECK : '<span class="size-3.5 shrink-0"></span>';
      item.append(WHY_REASONS.find((r) => r.id === id)?.head ?? id);
      item.onclick = () => {
        toggle(false);
        if (id !== reason)
          void go(
            steps.findIndex((s) => s.reason === id),
            '.driver-popover-next-btn',
          );
      };
      list.append(item);
    }
    open.onclick = () => toggle(list.hidden);
    // Escape closes the list, not the tour (driver.js reads Escape on `keyup`).
    menu.onkeyup = (e) => {
      if (e.key !== 'Escape' || list.hidden) return;
      e.stopPropagation();
      toggle(false);
      open.focus();
    };
    menu.append(list, open);
    return menu;
  };

  /** Asks the reader if they want to exit, in `popover`'s footer. */
  const askExit = (popover: PopoverDOM) => {
    if (popover.footer.querySelector('.why-tour-confirm')) return;
    const row = document.createElement('span');
    row.className = 'driver-popover-navigation-btns why-tour-confirm';
    row.innerHTML = '<span class="mr-1 self-center text-xs text-slate-600">Exit the tour?</span>';
    const stay = document.createElement('button');
    stay.type = 'button';
    stay.className = 'driver-popover-footer-btn why-tour-stay';
    stay.textContent = 'Stay';
    stay.onclick = () => {
      row.remove();
      popover.footer.classList.remove('why-tour-asking');
    };
    const leave = document.createElement('button');
    leave.type = 'button';
    leave.className = 'driver-popover-footer-btn why-tour-leave';
    leave.textContent = 'Exit';
    leave.onclick = () => {
      quiet = true;
      d.destroy();
    };
    row.append(stay, leave);
    popover.footer.classList.add('why-tour-asking');
    popover.footer.append(row);
    leave.focus();
  };
  const d = driver({
    showProgress: false,
    disableActiveInteraction: true,
    overlayClickBehavior: 'none',
    overlayOpacity: 0.5,
    popoverClass: 'home-tour-popover why-tour-popover',
    prevBtnText: 'Back',
    doneBtnText: 'Done',
    steps: steps.map((s, i) => ({
      element: () => {
        measured = undefined;
        const el = hidden(s) ? undefined : find(s);
        const fold = el?.closest('[data-fold]');
        if (el && fold && el.getBoundingClientRect().bottom > fold.getBoundingClientRect().bottom) {
          fold.dispatchEvent(new Event(FOLD_OPEN));
        }
        if (el && s.end) toEnd(el);
        // Center the target before the highlight, unless it is too tall (then `fit` ghosts its top).
        if (el && el.getBoundingClientRect().height <= innerHeight * 0.9) {
          el.scrollIntoView({ block: 'center', behavior: 'instant' });
        }
        const target = (at[i] = fit(el));
        if (target) place(target, !!s.action);
        return target as Element;
      },
      disableActiveInteraction: !s.action,
      // driver.js copies the step when it starts, so the side goes on that copy. It reads the side
      // each time it places the popover.
      onHighlightStarted: (_, step) => {
        if (step.popover)
          Object.defineProperty(step.popover, 'side', { get: () => sideOf(at[i], !!s.action), configurable: true });
      },
      popover: {
        title: s.reason ? undefined : s.title,
        description: s.text,
        showButtons: isOutro(s) ? [] : i === 0 ? ['next', 'close'] : ['next', 'previous', 'close'],
        ...(s === CONSENT && { popoverClass: 'home-tour-popover why-tour-popover home-tour-wide' }),
        ...(isOutro(s) && {
          popoverClass: cn(
            'home-tour-popover why-tour-popover why-tour-outro',
            s === SHORT_OUTRO && 'why-tour-outro-wide',
          ),
        }),
      },
    })),
    onPopoverRender: (popover, { state }) => {
      setConsent(null);
      hideVeil();
      const i = state.activeIndex ?? 0;
      const s = steps[i];
      const from = steps[shown]?.reason === s.reason ? shown : -1;
      shown = i;
      popover.wrapper.classList.toggle('why-tour-high', !(hidden(s) ? undefined : find(s)));
      if (long) popover.nextButton.before(popover.previousButton);
      else popover.footer.prepend(popover.previousButton);
      disarm();
      const target = s.action && !hidden(s) ? find(s) : undefined;
      popover.wrapper.classList.toggle('why-tour-do', !!target);
      popover.wrapper.classList.remove('why-tour-busy');
      if (target) {
        arm(target, i);
        popover.nextButton.style.display = 'none';
        popover.previousButton.style.display = 'none';
      }
      for (const n of [steps[i + 1], steps[i - 1]]) if (n && !here(n.path)) router.prefetch(n.path, FULL);
      if (s.reason) {
        if (!target && long) popover.footer.prepend(jumpMenu(s.reason));
        else if (!target && s.part !== 'Problem') popover.previousButton.after(reasonLabel(s.reason));
        const { box, fit, scroll, play } = stack(i, from);
        popover.description.replaceChildren(box);
        fit();
        const m = mover;
        mover = null;
        if (!m) {
          requestAnimationFrame(() => {
            scroll();
            play();
          });
          return;
        }
        popover.wrapper.classList.add('why-tour-grow', 'why-tour-hold');
        requestAnimationFrame(() => {
          scroll();
          const a = m.getBoundingClientRect();
          const b = popover.wrapper.getBoundingClientRect();
          m.style.transform = `translate(${b.left - a.left}px, ${b.top - a.top}px)`;
          setTimeout(() => {
            m.remove();
            popover.wrapper.classList.remove('why-tour-hold');
            play();
          }, MOVE);
        });
      } else if (s === CONSENT) {
        if (hasAttestation()) {
          popover.description.insertAdjacentHTML(
            'beforeend',
            '<p>You agreed to our terms, so the tour shows all evaluation content.</p>',
          );
          return;
        }
        popover.nextButton.textContent = 'Continue Without Agreeing';
        popover.nextButton.classList.add('home-tour-decline');
        const box = document.createElement('div');
        box.className = 'mt-3';
        popover.description.append(box);
        setConsent({ box, onDone: () => void go(i + 1), onShown: () => d.refresh() });
      } else if (isOutro(s)) {
        const button = (name: string) => popover.description.querySelector<HTMLButtonElement>(name);
        button('.why-tour-contribute')?.addEventListener('click', () => {
          stop();
          router.push('/contribute');
        });
        button('.why-tour-explore')?.addEventListener('click', stop);
        button('.why-tour-full')?.addEventListener('click', () => {
          stop();
          startTour(ALL, router);
        });
      }
    },
    onHighlighted: () => {
      unhold();
      requestAnimationFrame(settle);
    },
    onNextClick: () => {
      const i = d.getActiveIndex() ?? 0;
      if (!isOutro(steps[i])) void go(i + 1, '.driver-popover-next-btn');
    },
    onPrevClick: () => void go((d.getActiveIndex() ?? 0) - 1, '.driver-popover-prev-btn'),
    onCloseClick: () => {
      const popover = d.getState('popover');
      if (popover) askExit(popover);
    },
    onDestroyStarted: () => {
      const popover = d.getState('popover');
      if (isOutro(steps[d.getActiveIndex() ?? 0])) return stop();
      if (popover) return askExit(popover);
      quiet = true;
      d.destroy();
    },
    onDestroyed: () => {
      clean();
      if (active !== d) return;
      active = null;
      if (!quiet) router.push(end);
    },
  });
  active = d;
  /** Ends the tour on its page. */
  const stop = () => {
    quiet = true;
    d.destroy();
  };
  const clean = () => {
    window.removeEventListener('popstate', onPop);
    window.removeEventListener('click', onClick, true);
    window.removeEventListener('wheel', still);
    window.removeEventListener('touchmove', still);
    document.documentElement.classList.remove('why-tour-on');
    disarm();
    hideVeil();
    setConsent(null);
    mover?.remove();
    document.querySelectorAll('.why-tour-mover').forEach((e) => e.remove());
    ghost?.remove();
    ghost = null;
    unhold();
  };
  /** After the browser's back or forward button: the nearest step with the new page, earlier steps
   * first. With none, the tour stops. */
  const onPop = () => {
    const cur = d.isActive() ? (d.getActiveIndex() ?? 0) : -1;
    if (cur >= 0 && here(steps[cur].path)) return;
    const all = [...steps.keys()];
    const j = [...all.filter((k) => k < cur).reverse(), ...all.filter((k) => k > cur)].find((k) => here(steps[k].path));
    turn++;
    busy = false;
    if (j !== undefined) return void go(j);
    quiet = true;
    if (d.isActive()) return d.destroy();
    clean();
    if (active === d) active = null;
  };
  window.addEventListener('popstate', onPop);
  window.addEventListener('click', onClick, true);
  window.addEventListener('wheel', still, { passive: false });
  window.addEventListener('touchmove', still, { passive: false });
  const go = async (i: number, button?: string) => {
    if (busy || i < 0) return;
    if (i >= steps.length) return d.destroy();
    const step = steps[i];
    const mine = ++turn;
    busy = true;
    const away = !here(step.path);
    if (away) {
      document.querySelectorAll<HTMLButtonElement>('.driver-popover-footer button').forEach((b) => (b.disabled = true));
      if (button) document.querySelector(`.driver-popover-footer ${button}`)?.classList.add('home-tour-loading');
      if (d.isActive()) hold();
      router.push(step.path);
    }
    await arrive(step, !hidden(step));
    if (active !== d || mine !== turn) return;
    busy = false;
    // After a page change, the old target is gone, so the popover has no place to move from.
    const pop = !away && document.querySelector<HTMLElement>('.driver-popover:not(.why-tour-mover)');
    const cur = d.getActiveIndex();
    if (pop && cur !== undefined && cur !== i && steps[cur].reason && steps[cur].reason === step.reason) {
      mover?.remove();
      mover = copy(pop);
    }
    if (d.isActive()) d.moveTo(i);
    else d.drive(i);
  };
  void go(0);
}

function ConsentForm({ consent }: { consent: Consent }) {
  useEffect(() => consent.onShown(), [consent]);
  return <AttestationForm onDone={consent.onDone} />;
}

/** Puts the statement form in the tour's `CONSENT` step. Once on the page that starts the tours. */
export function TourConsentHost() {
  const c = useSyncExternalStore(
    subscribe,
    () => consent,
    () => null,
  );
  return c && createPortal(<ConsentForm consent={c} />, c.box);
}

/** Runs the tours of the reasons `ids` from code, for example from the site assistant. `short`: run
 * the Short Tutorial. */
export const startWhyTour = (ids: string[], router: Router, short = false) => startTour(ids, router, true, short);

/** The styles of `GuidedTourButton`: its box, its icon, and its `sub` line. */
const TOUR_BUTTON = {
  small: [
    'gap-x-1.5 rounded-full border border-emerald-700 py-1.5 pr-4 pl-3 text-xs text-emerald-700 hover:bg-emerald-50',
    'size-3',
    '',
  ],
  full: [
    'gap-x-2.5 rounded-2xl bg-emerald-700 px-7 py-2.5 text-base text-white hover:bg-emerald-600',
    'size-6',
    'text-[10px] text-emerald-200',
  ],
  short: [
    'gap-x-2 rounded-xl bg-slate-600 px-5 py-2 text-[13px]/5 text-white hover:bg-slate-500',
    'size-4',
    'text-[9px] text-slate-200',
  ],
  page: [
    'gap-x-1.5 rounded-full bg-emerald-700 py-1.5 pr-4 pl-3.5 text-[13px]/4 whitespace-nowrap text-white hover:bg-emerald-600',
    'size-3.5',
    '',
  ],
  tag: [
    'gap-x-1 rounded-full border border-emerald-700 bg-emerald-700 px-2.5 py-0.5 text-[10px] tracking-wide whitespace-nowrap text-white uppercase hover:border-emerald-800 hover:bg-emerald-800',
    'size-3',
    '',
  ],
};

/** A "Tutorial" button: it runs the tours of the reasons `ids` (see `WHY_TOURS`). `short`: it runs
 * the short tour. `look`: `small` in a reason's row, `short` (the default when `short`) a smaller
 * slate button, `page` as large as a page's head buttons, `tag` as `SUBMIT_BUTTON`. `label`: its
 * text. `sub`: a small line under the text. `onStart`: runs when the tour starts. */
export function GuidedTourButton({
  ids = [],
  short,
  look = short ? 'short' : 'full',
  label = 'Tutorial',
  sub,
  onStart,
  className,
}: {
  ids?: string[];
  short?: boolean;
  look?: keyof typeof TOUR_BUTTON;
  label?: string;
  sub?: string;
  onStart?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [box, icon, line] = TOUR_BUTTON[look];
  return (
    <button
      type="button"
      onClick={() => {
        onStart?.();
        startTour(ids, router, true, short);
      }}
      className={cn(
        'flex shrink-0 cursor-pointer items-center justify-center font-semibold transition-colors',
        box,
        className,
      )}
    >
      <Play aria-hidden className={cn('shrink-0 fill-current', icon)} />
      <span className="flex flex-col items-center">
        {label}
        {sub && <span className={cn('font-bold tracking-wide uppercase', line)}>{sub}</span>}
      </span>
    </button>
  );
}

/** The style of `TutorialPicker`'s title. */
export const PICKER_TITLE = 'text-sm font-bold tracking-wider text-slate-400 uppercase';

/** `title` (with `PICKER_TITLE`), and under it the Full and Short Tutorial buttons, at the same
 * width. On the Features page and in the "Get Started" box. `onStart`: runs when a tour starts.
 * `buttonClassName`: added to both buttons. */
export function TutorialPicker({
  title,
  onStart,
  buttonClassName,
}: {
  title: ReactNode;
  onStart?: () => void;
  buttonClassName?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-y-3.5 text-center">
      {title}
      <div className="grid gap-y-4">
        <GuidedTourButton
          ids={ALL}
          label="Full Tutorial"
          sub="Recommended · 5 min"
          onStart={onStart}
          className={buttonClassName}
        />
        <GuidedTourButton short label="Short Tutorial" onStart={onStart} className={buttonClassName} />
      </div>
    </div>
  );
}
