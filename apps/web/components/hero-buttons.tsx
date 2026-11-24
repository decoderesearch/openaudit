'use client';

import { useHomeTourStart } from '@/components/home-tour';
import Link from '@/components/link';
import { NewDot } from '@/components/tutorial-seen';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { PICKER_TITLE, TutorialPicker } from '@/components/why-tour';
import { SITE_NAME } from '@/lib/env';
import { NOTICE_EVENT, NOTICE_KEY } from '@/lib/first-visit';
import { cn } from '@/lib/utils';
import { Play, UserGroup, type LucideIcon } from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';

/** A hero button fills its slot, which sets its size and text size. */
export const HERO_BUTTON =
  'absolute inset-0 flex h-full w-full items-center justify-center gap-x-[0.4em] rounded-full px-0 text-[length:inherit] font-semibold whitespace-nowrap transition-colors';
const OUTLINE = 'border border-white/70 text-white hover:bg-white/10';
const EMERALD = 'bg-emerald-100 text-emerald-800 hover:bg-emerald-50';
/** The icon of a hero button, at the size of its text. */
const ICON = 'size-[1.1em] shrink-0';

/** The link buttons after Get Started, in the navbar help menu. `menu`: only there, not in the home
 * hero. */
const HERO_LINKS: { href: string; label: string; color: string; icon?: LucideIcon; menu?: boolean }[] = [
  { href: '/features', label: 'Features', color: OUTLINE, menu: true },
  { href: '/contribute', label: 'Contribute', color: EMERALD, icon: UserGroup },
  { href: '/faqs', label: 'FAQs', color: OUTLINE, menu: true },
];

let pickerOpen = false;
const pickerListeners = new Set<() => void>();
const setPicker = (open: boolean) => {
  pickerOpen = open;
  pickerListeners.forEach((l) => l());
};
const subscribePicker = (l: () => void) => {
  pickerListeners.add(l);
  return () => void pickerListeners.delete(l);
};

/** Opens the "Guided Walkthrough" box (`TutorialPickerHost`). */
const openTutorialPicker = () => setPicker(true);

const TUTORIAL_PARAM = 'tutorial';

/** `/?tutorial` opens the box after the first-visit notice closes, and loses the parameter. */
function useTutorialLink() {
  const pathname = usePathname();
  useEffect(() => {
    const url = new URL(window.location.href);
    if (pathname !== '/' || !url.searchParams.has(TUTORIAL_PARAM)) return;
    const open = () => {
      if (localStorage.getItem(NOTICE_KEY) === null) return;
      window.removeEventListener(NOTICE_EVENT, open);
      url.searchParams.delete(TUTORIAL_PARAM);
      window.history.replaceState(window.history.state, '', url);
      setPicker(true);
    };
    window.addEventListener(NOTICE_EVENT, open);
    open();
    return () => window.removeEventListener(NOTICE_EVENT, open);
  }, [pathname]);
}

/** The "Guided Walkthrough" box: the logo, then the Full and Short Tutorial buttons. One for the
 * site, in the root layout: buttons in a menu that closes on a click can still open it. */
export function TutorialPickerHost() {
  useTutorialLink();
  const open = useSyncExternalStore(
    subscribePicker,
    () => pickerOpen,
    () => false,
  );
  return (
    <Dialog open={open} onOpenChange={setPicker}>
      <DialogContent motion="slide" aria-describedby={undefined} className="rounded-3xl py-10 duration-300 sm:max-w-md">
        <TutorialPicker
          title={
            <>
              <Image
                src="/openaudit-logo.png"
                alt={SITE_NAME}
                width={1074}
                height={230}
                unoptimized
                className="mb-1 h-9 w-auto"
              />
              <DialogTitle className={PICKER_TITLE}>Guided Walkthrough</DialogTitle>
            </>
          }
          onStart={() => setPicker(false)}
          buttonClassName="shadow-md shadow-slate-900/20"
        />
      </DialogContent>
    </Dialog>
  );
}

/** The "Get Started" button: it opens the "Guided Walkthrough" box. A red dot is at its top right
 * until the reader starts a tutorial (`NewDot`). `small`: the dot is higher and more to the right. */
function GetStartedButton({ className, small }: { className?: string; small?: boolean }) {
  useHomeTourStart();
  return (
    <button type="button" aria-haspopup="dialog" onClick={openTutorialPicker} className={className}>
      <Play aria-hidden className={cn(ICON, 'fill-current')} />
      Get Started
      <NewDot className={cn('size-[1.1em] min-h-2 min-w-2', small ? '-top-0.5 -right-0.5' : '-top-1 right-1')} />
    </button>
  );
}

/** The help menu's 2x2 grid of all the hero buttons, for a sky panel. `onPick`: on a click in it.
 * `slot`: each slot's height and text size. */
export function HelpButtons({ onPick, slot = 'h-6 text-[11px]' }: { onPick?: () => void; slot?: string }) {
  return (
    <div className="grid grid-cols-2 gap-1.5" onClick={onPick}>
      {heroButtons(
        (i, button) => (
          <div key={i} className={cn('relative w-full', slot)}>
            {button}
          </div>
        ),
        true,
      )}
    </div>
  );
}

/** The hero buttons (Get Started, then the links), each wrapped by `slot(i, node)`. `menu`: all of
 * them, for the help menu; else the home hero's. `small`: the compact bar (and `menu`), where the
 * dot sits higher and more to the right. */
export function heroButtons(slot: (i: number, node: ReactNode) => ReactNode, menu = false, small = false): ReactNode[] {
  return [
    slot(
      0,
      <GetStartedButton small={small || menu} className={cn(HERO_BUTTON, 'bg-sky-50 text-sky-800 hover:bg-white')} />,
    ),
    ...HERO_LINKS.filter((l) => menu || !l.menu).map((l, i) =>
      slot(
        i + 1,
        <Link href={l.href} className={cn(HERO_BUTTON, l.color)}>
          {l.icon && <l.icon aria-hidden className={ICON} />}
          {l.label}
        </Link>,
      ),
    ),
  ];
}
