'use client';

import { ASK_PANEL_ID, setAsk, useAsk } from '@/components/ask/ask-store';
import { HelpButtons } from '@/components/hero-buttons';
import Link from '@/components/link';
import { BetaBadge } from '@/components/nav/beta-badge';
import { usePageSection } from '@/components/nav/nav-section';
import SiteSearch, { NAV_SEARCH } from '@/components/nav/site-search';
import { SubscribeDialog } from '@/components/nav/subscribe-dialog';
import { NewDot } from '@/components/tutorial-seen';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { SITE_NAME, TWITTER_URL } from '@/lib/env';
import { LEGAL_EMAIL } from '@/lib/legal';
import { TOP_LEVEL_ROUTES } from '@/lib/organizations';
import { cn } from '@/lib/utils';
import {
  Bell,
  Bot,
  BuildingComplex,
  CircleHelp,
  HardHat,
  House,
  Menu,
  Search,
  UserGroup,
  X,
  type LucideIcon,
} from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

// Below lg: a top bar with the menu, the logo, search and the account, and a dock at the bottom of
// the screen. The site footer leaves room for the dock, and its legal links are in the menu.

type Section = { href: string; label: string; short: string; icon: LucideIcon };
type Dialog = 'subscribe';

const MODELS: Section = { href: '/models', label: 'Models', short: 'Models', icon: Bot };
const METHODS: Section = { href: '/methods', label: 'Safety Methods', short: 'Methods', icon: HardHat };
const ORGS: Section = { href: '/organizations', label: 'Organizations', short: 'Orgs', icon: BuildingComplex };
const TABS: Section[] = [{ href: '/', label: 'Home', short: 'Home', icon: House }, MODELS, ORGS, METHODS];
const MENU: Section[] = [MODELS, ORGS, METHODS];

/** The section of a page: an organization page is in Organizations, and a model page in Models. */
export function sectionOf(pathname: string) {
  const [first, second] = pathname.split('/').filter(Boolean);
  if (!first) return '/';
  if (TOP_LEVEL_ROUTES.has(first)) return `/${first}`;
  return !second || second === 'incidents' ? '/organizations' : '/models';
}

const ITEM = 'flex h-11 w-full items-center gap-x-3 rounded-md px-3 text-sm [&_svg]:size-4 [&_svg]:text-slate-500';
// A dark shadow shows on light pages, and a faint white glow on dark ones.
const SHADOW = 'shadow-[0_6px_20px_rgba(15,23,42,0.35),0_0_12px_rgba(255,255,255,0.2)]';
const CARD = cn('pointer-events-auto rounded-xl bg-sky-800 p-1.5', SHADOW);
const TAB =
  'flex h-[46px] min-w-0 flex-col items-center justify-center gap-y-1 rounded-lg border text-[9.5px] font-medium';
const TAB_OFF = 'border-transparent text-white hover:bg-sky-900';
const HELP_ID = 'mobile-help';

export function MobileNav({
  account,
  signedIn,
}: {
  /** The sign-in link or the account menu. None with sign-in off. */
  account: ReactNode;
  signedIn: boolean;
}) {
  const pathname = usePathname();
  // Search stays open on the page where it opened, so a result that opens a page closes it.
  const ask = useAsk();
  const [help, setHelp] = useState(false);
  const helpOpen = ask.on ? ask.open : help;
  const [searchAt, setSearchAt] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  // A dialog from the menu opens after the menu closes. Two modals at one time block the page.
  const [next, setNext] = useState<Dialog | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const section = usePageSection(pathname) ?? sectionOf(pathname);
  const active = (href: string) => section === href;
  const fromMenu = (d: Dialog) => {
    setNext(d);
    setMenu(false);
  };

  return (
    <>
      {searchAt === pathname ? (
        <div className="flex h-12 items-center gap-x-2 px-3 lg:hidden">
          <SiteSearch autoFocus className="flex-1" />
          <Button variant="ghost" size="icon" aria-label="Close search" onClick={() => setSearchAt(null)}>
            <X />
          </Button>
        </div>
      ) : (
        <div className="grid h-12 grid-cols-[1fr_auto_1fr] items-center px-2 lg:hidden">
          <Sheet open={menu} onOpenChange={setMenu}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="justify-self-start" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-72 gap-0 pt-[env(safe-area-inset-top)]"
              onCloseAutoFocus={(e) => {
                if (!next) return;
                e.preventDefault();
                setDialog(next);
                setNext(null);
              }}
            >
              <SheetHeader>
                <SheetTitle>{SITE_NAME}</SheetTitle>
                <SheetDescription className="sr-only">The site menu</SheetDescription>
              </SheetHeader>
              <nav aria-label="Mobile" className="flex flex-col px-2">
                {MENU.map((s) => (
                  <Link
                    key={s.href}
                    href={s.href}
                    onClick={() => setMenu(false)}
                    className={cn(ITEM, active(s.href) ? 'bg-slate-100 text-sky-800' : 'text-slate-700')}
                  >
                    <s.icon />
                    {s.label}
                  </Link>
                ))}
                {signedIn ? (
                  <Link
                    href="/settings#email-updates"
                    onClick={() => setMenu(false)}
                    className={cn(ITEM, 'text-slate-700')}
                  >
                    <Bell />
                    Updates
                  </Link>
                ) : (
                  <button type="button" onClick={() => fromMenu('subscribe')} className={cn(ITEM, 'text-slate-700')}>
                    <Bell />
                    Updates
                  </button>
                )}
                <Link
                  href="/contribute"
                  onClick={() => setMenu(false)}
                  className={cn(ITEM, active('/contribute') ? 'bg-slate-100 text-sky-800' : 'text-slate-700')}
                >
                  <UserGroup />
                  Contribute
                </Link>
              </nav>
              <nav
                aria-label="Legal"
                className="mt-auto flex flex-col gap-y-3 border-t border-slate-200 px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-xs text-slate-600"
              >
                <Link href="/terms" onClick={() => setMenu(false)} className="hover:text-sky-800">
                  Terms
                </Link>
                <Link href="/privacy" onClick={() => setMenu(false)} className="hover:text-sky-800">
                  Privacy
                </Link>
                <a href={`mailto:${LEGAL_EMAIL}`} className="hover:text-sky-800">
                  Contact Decode Research
                </a>
                <a href={TWITTER_URL} target="_blank" rel="noreferrer" className="hover:text-sky-800">
                  Twitter
                </a>
              </nav>
            </SheetContent>
          </Sheet>
          <div className="flex items-start gap-x-0.5">
            <Link href="/" className="flex items-center">
              <Image
                src="/openaudit-logo.png"
                alt={SITE_NAME}
                width={1074}
                height={230}
                priority
                unoptimized
                className="h-[26px] w-auto"
              />
            </Link>
            {/* The logo image has about 9px of empty space on its right. */}
            <BetaBadge className="mt-0.5 -ml-1.5 text-[9px]" />
          </div>
          <div className="flex items-center justify-end gap-x-1">
            {NAV_SEARCH && (
              <Button variant="ghost" size="icon" aria-label="Search" onClick={() => setSearchAt(pathname)}>
                <Search />
              </Button>
            )}
            {account}
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed inset-x-3 bottom-[calc(0.625rem+env(safe-area-inset-bottom))] z-20 flex items-stretch gap-2 lg:hidden">
        <nav aria-label="Sections" className={cn(CARD, 'grid flex-[4] grid-cols-4 gap-1')}>
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active(t.href) ? 'page' : undefined}
              className={cn(TAB, active(t.href) ? 'border-sky-200 bg-sky-50 text-sky-900' : TAB_OFF)}
            >
              <t.icon className="size-[15px]" />
              {t.short}
            </Link>
          ))}
        </nav>
        <div className={cn(CARD, 'grid flex-[3] grid-cols-3 gap-1')}>
          <Link
            href="/contribute"
            data-tour="submit"
            aria-current={active('/contribute') ? 'page' : undefined}
            className={cn(TAB, active('/contribute') ? 'border-sky-200 bg-sky-50 text-sky-900' : TAB_OFF)}
          >
            <UserGroup className="size-[15px]" />
            Contrib
          </Link>
          {signedIn ? (
            <Link href="/settings#email-updates" data-tour="updates" className={cn(TAB, TAB_OFF)}>
              <Bell className="size-[15px]" />
              Updates
            </Link>
          ) : (
            <button
              type="button"
              data-tour="updates"
              onClick={() => setDialog('subscribe')}
              className={cn(TAB, TAB_OFF)}
            >
              <Bell className="size-[15px]" />
              Updates
            </button>
          )}
          <button
            type="button"
            onClick={() => (ask.on ? setAsk({ open: !ask.open }) : setHelp((o) => !o))}
            aria-expanded={helpOpen}
            aria-controls={ask.on ? ASK_PANEL_ID : HELP_ID}
            className={cn(TAB, helpOpen ? 'border-sky-200 bg-sky-50 text-sky-900' : TAB_OFF)}
          >
            <span className="relative">
              <CircleHelp className="size-[15px]" />
              <NewDot className="-top-1 -right-1.5 size-2" />
            </span>
            Help
          </button>
        </div>
      </div>
      {/* Without the assistant, Help shows only the help buttons, above the dock. */}
      {!ask.on && (
        <div
          id={HELP_ID}
          hidden={!help}
          className={cn(
            'fixed inset-x-3 bottom-[calc(4.875rem+env(safe-area-inset-bottom))] z-20 rounded-xl bg-sky-800 px-3 pt-2 pb-3 lg:hidden [&[hidden]]:hidden',
            SHADOW,
          )}
        >
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => setHelp(false)}
              className="flex items-center gap-x-1 rounded-full px-2.5 py-1 text-xs font-semibold text-sky-100 transition-colors hover:bg-sky-700 hover:text-white"
            >
              <X aria-hidden className="size-3.5" />
              Close Help
            </button>
          </div>
          <HelpButtons onPick={() => setHelp(false)} slot="h-8 text-xs" />
        </div>
      )}

      {!signedIn && (
        <SubscribeDialog open={dialog === 'subscribe'} onOpenChange={(o) => setDialog(o ? 'subscribe' : null)} />
      )}
    </>
  );
}
