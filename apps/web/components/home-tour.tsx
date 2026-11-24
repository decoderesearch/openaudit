'use client';

import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { usePathname } from 'next/navigation';
import type { useRouter } from 'nextjs-toploader/app';
import { useEffect } from 'react';
import './home-tour.css';

/** A click off the home page sets this, so the home page starts the tour after it loads. */
const START_FLAG = 'oa-start-home-tour';

/** The first element of `selector` that shows on the page. With none, the step is a centered popover. */
const shown = (selector: string) => [...document.querySelectorAll(selector)].find((e) => e.getClientRects().length > 0);

/** `el`, or the `Fold` that clips it under `lg`: so the highlight is the part that shows. */
const visibleBox = (el: Element | undefined) => {
  const fold = el?.parentElement?.closest('[data-fold]');
  return fold?.getClientRects().length ? fold : el;
};

function steps(): DriveStep[] {
  const at = (selector: string, popover: DriveStep['popover']): DriveStep => ({
    element: visibleBox(shown(selector)),
    popover,
  });
  // Under `lg`, Updates and Submit are in the tab bar at the bottom of the screen.
  const navSide = window.matchMedia('(min-width: 64rem)').matches ? 'bottom' : 'top';
  return [
    {
      popover: {
        title: "What's OpenAudit?",
        popoverClass: 'home-tour-popover home-tour-wide',
        description: [
          '<p>OpenAudit is an independent source for evaluations of AI models, organizations, and safety methods. Results come from both running evaluations ourselves, as well as from external sources.</p>',
          '<h3>Transparency and Reproducibility</h3>',
          '<p>OpenAudit hosts as much raw data and code as possible, including logs, artifacts, and metrics, so that evaluations can be replicated and exported.</p>',
          '<h3>Canonical Links</h3>',
          "<p>URLs are intentionally simple. For example, <code>openaudit.com/google</code> is an organization's page, <code>openaudit.com/Qwen/Qwen3.6-27B</code> is a model's, and <code>openaudit.com/evaluations/varied-deception</code> is an evaluation.</p>",
          '<h3>Better Evaluations</h3>',
          "<p>There are too few safety evaluations today, and they're often outdated, lacking diversity, and contain errors. We hope that you'll create and submit better evaluations.</p>",
        ].join(''),
      },
    },
    at('section[aria-label="Models"]', {
      title: 'Models',
      description: [
        '<p>We run evaluations on public models and make all of their results public. The % is the <strong>deploymeter</strong>: a wide-deployment recommendation based on 9 AI judges reading anonymized results of those evaluations.</p>',
        "<p><strong>The publicly available evaluations we run are often outdated</strong> (older than the models we're testing), so you should read these results with skepticism. A key objective of OpenAudit is to source newer, better evaluations from your contributions.</p>",
      ].join(''),
      side: 'right',
    }),
    at('section[aria-label="Organizations"]', {
      title: 'Organizations',
      description:
        '<p>Each organization has its own page, which contains its latest safety commitments (verified and un-verified, scored accordingly), incidents (including misalignment reports, hacks, etc) and notable employee departures.</p>',
    }),
    at('section[aria-label="Safety Methods"]', {
      title: 'Safety Methods',
      description: [
        '<p>We want to know if the methods we use to monitor and test models are effective.</p>',
        '<p>Here, we evaluate methods against each other, either for safety-related purposes like honesty and deception, or to find the best variant of a specific method (for example, Workspace Lenses).</p>',
        '<p>All evaluations are open for public submissions: you can submit your own methods and variants to climb the leaderboards.</p>',
      ].join(''),
      side: 'left',
    }),
    at('[data-tour="updates"]', {
      title: 'Updates',
      description: '<p>Subscribe to get our new results by email: one email each week at most.</p>',
      side: navSide,
    }),
    at('[data-tour="submit"]', {
      title: 'Submit',
      description:
        '<p>Send us an incident, an evaluation, a safety method or any other report, like feedback or errors.</p>',
      side: navSide,
    }),
    {
      // The hero can get small during the tour, so find its buttons when the step opens.
      element: () => shown('[data-tour="hero-buttons"]') as Element,
      popover: {
        title: 'What To Do Next',
        description:
          '<p>Explore the evaluations of models, organizations, and methods, or learn more OpenAudit details under <a href="/features"><strong>Features</strong></a>, <a href="/faqs"><strong>FAQs</strong></a>, and <a href="/contribute"><strong>How to Contribute</strong></a>.</p>',
        side: 'bottom',
        doneBtnText: 'Done',
      },
    },
  ];
}

// The tour is module-level, so it outlives the button that starts it (for example one in a menu
// that closes on the click).
let tour: ReturnType<typeof driver> | null = null;

/** Start the home page's guided tour. In the tour, the page does not take clicks. */
function startTour() {
  tour?.destroy();
  tour = driver({
    showProgress: false,
    disableActiveInteraction: true,
    overlayClickBehavior: 'none',
    overlayOpacity: 0.5,
    popoverClass: 'home-tour-popover',
    steps: steps(),
    onDestroyed: () => {
      tour = null;
    },
  });
  tour.drive();
}

/** Starts the home page's tour: here, or on the home page once it loads (see `useHomeTourStart`). */
export function startHomeTour(router: ReturnType<typeof useRouter>) {
  if (location.pathname === '/') return startTour();
  sessionStorage.setItem(START_FLAG, '1');
  router.push('/');
}

/** Starts the tour when the home page loads after `startHomeTour` on another page. Put it in a
 * component that is on every page. */
export function useHomeTourStart() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === '/' && sessionStorage.getItem(START_FLAG)) {
      sessionStorage.removeItem(START_FLAG);
      startTour();
    }
  }, [pathname]);
}
