'use client';

import { AskPanel } from '@/components/ask/ask-panel';
import { useAsk } from '@/components/ask/ask-store';
import { HelpButtons } from '@/components/hero-buttons';
import Link from '@/components/link';
import { BetaBadge } from '@/components/nav/beta-badge';
import { MethodsMenu } from '@/components/nav/methods-menu';
import { MobileNav } from '@/components/nav/mobile-nav';
import { ModelsMenu } from '@/components/nav/models-menu';
import { NAV_ITEM } from '@/components/nav/nav-menu';
import { OrgsMenu } from '@/components/nav/orgs-menu';
import { ReportButton } from '@/components/nav/report-dialog';
import { NAV_SEARCH, SearchToggle } from '@/components/nav/site-search';
import { SubscribeButton } from '@/components/nav/subscribe-dialog';
import { TopicsMenu } from '@/components/nav/topics-menu';
import { NAV_COLUMN } from '@/components/page';
import { NewDot } from '@/components/tutorial-seen';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOut } from '@/lib/auth-client';
import { SITE_NAME } from '@/lib/env';
import type { NavMethods } from '@/lib/server/nav-methods';
import type { NavOrgs } from '@/lib/server/nav-orgs';
import type { Viewer } from '@/lib/server/viewer';
import { cn } from '@/lib/utils';
import { CircleHelp, ListChecks, LogOut, Settings, Shield, User, UserPen, type LucideIcon } from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';
import { Fragment, useEffect, useRef, useState } from 'react';

type NavLink = { href: string; label: string; icon?: LucideIcon };

const PUBLIC_LINKS: NavLink[] = [
  { href: '/models', label: 'Models' },
  { href: '/organizations', label: 'Organizations' },
  { href: '/methods', label: 'Safety Methods' },
];

const ACCOUNT_LINKS: NavLink[] = [
  { href: '/runs/mine', label: 'My Evals', icon: ListChecks },
  { href: '/settings', label: 'Settings', icon: Settings },
];
const ADMIN_LINK: NavLink = { href: '/admin', label: 'Admin', icon: Shield };

// For a signed-in user who has not finished onboarding. The account pages need a username.
const ONBOARDING_LINKS: NavLink[] = [{ href: '/onboarding', label: 'Finish sign-up', icon: UserPen }];

const accountLinks = (viewer: Viewer) => [
  ...(viewer.onboardedAt ? ACCOUNT_LINKS : ONBOARDING_LINKS),
  ...(viewer.role === 'admin' ? [ADMIN_LINK] : []),
];

function useSignOut() {
  const router = useRouter();
  return () =>
    void signOut().then(() => {
      router.push('/');
      router.refresh();
    });
}

export type NavMenus = { orgs: NavOrgs | null; methods: NavMethods | null };

export default function NavbarClient({
  viewer,
  signIn,
  menus,
  adminTodo = 0,
}: {
  viewer: Viewer | null;
  signIn: boolean;
  menus: NavMenus;
  /** Admin work that waits (requests, drafts, card errors). Shown only to admins. */
  adminTodo?: number;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const todo = viewer?.role === 'admin' ? adminTodo : 0;
  const account = !signIn ? null : viewer ? <AccountMenu viewer={viewer} todo={todo} /> : <SignInLink />;

  return (
    <header className="fixed inset-x-0 top-0 z-20 border-b border-slate-200 bg-white pt-[env(safe-area-inset-top)] select-none">
      <MobileNav account={account} signedIn={signIn && !!viewer} />
      <div className={cn(NAV_COLUMN, 'hidden h-12 grid-cols-[1fr_auto] items-center gap-x-4 lg:grid')}>
        <div className="flex min-w-0 items-center gap-x-6">
          {/* The full logo needs about 1100px of window for the menus beside it; under that, the chip. */}
          <div className="flex shrink-0 items-start gap-x-1">
            <Link href="/" className="flex shrink-0 items-center gap-x-1.5">
              <Image
                src="/openaudit-logo.png"
                alt={SITE_NAME}
                width={1074}
                height={230}
                priority
                unoptimized
                className="hidden h-[32px] w-auto min-[1100px]:block"
              />
              <Image
                src="/chip_check.svg"
                alt={SITE_NAME}
                width={32}
                height={32}
                priority
                unoptimized
                className="size-8 min-[1100px]:hidden"
              />
            </Link>
            {/* The logo image has about 11px of empty space on its right; the chip has none. */}
            <BetaBadge className="mt-1 translate-y-0.5 min-[1100px]:-ml-2.5" />
          </div>
          <nav aria-label="Main" className="flex items-center gap-x-7 text-sm font-medium text-slate-500">
            {PUBLIC_LINKS.map((l) =>
              l.href === '/models' ? (
                <ModelsMenu key={l.href} active={isActive(l.href)} />
              ) : l.href === '/organizations' ? (
                <OrgsMenu key={l.href} active={isActive(l.href)} orgs={menus.orgs} />
              ) : l.href === '/methods' ? (
                <MethodsMenu key={l.href} active={isActive(l.href)} methods={menus.methods} />
              ) : l.href === '/topics' ? (
                <TopicsMenu key={l.href} active={isActive(l.href)} />
              ) : (
                <Link key={l.href} href={l.href} className={isActive(l.href) ? 'text-sky-800' : 'hover:text-sky-600'}>
                  {l.label}
                </Link>
              ),
            )}
          </nav>
        </div>

        <div className="flex items-center justify-end gap-x-2">
          {/* `data-tour`: for the home page's tutorial, as in the mobile tab bar. */}
          <span data-tour="updates" className="flex">
            <SubscribeButton signedIn={signIn && !!viewer} />
          </span>
          <span data-tour="submit" className="flex">
            <ReportButton methods={menus.methods?.methods} />
          </span>
          {NAV_SEARCH && <SearchToggle />}
          <HelpMenu />
          {account}
        </div>
      </div>
    </header>
  );
}

const HELP_PANEL_ID = 'nav-help-menu';
/** The embedded assistant's own id, so it does not clash with the full-screen one (`AskLauncher`). */
const ASK_NAV_PANEL_ID = 'ask-openaudit-nav';

/** The navbar's help menu: the home page's 2x2 grid of entry buttons (`HelpButtons`), and the Ask
 * OpenAudit chat under it. A plain popover, not a Radix menu, so the chat's text field keeps its
 * keys. A red dot marks its button until the reader starts a tutorial. */
function HelpMenu() {
  const [open, setOpen] = useState(false);
  const { on } = useAsk();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative flex">
      <button
        type="button"
        className={cn(NAV_ITEM, 'hover:bg-sky-50', open && 'bg-sky-50 text-sky-600')}
        aria-label="Help and Ask OpenAudit"
        aria-expanded={open}
        aria-controls={HELP_PANEL_ID}
        onClick={() => setOpen((o) => !o)}
      >
        <CircleHelp />
        <span className="hidden xl:inline">Help</span>
      </button>
      <NewDot className="-top-0.5 -right-0.5 size-2.5" />
      <div
        id={HELP_PANEL_ID}
        hidden={!open}
        className="absolute top-full right-0 z-50 mt-2 flex w-[360px] flex-col gap-2.5 rounded-lg border border-sky-900 bg-sky-800 p-3 shadow-xl shadow-slate-900/15 [&[hidden]]:hidden"
      >
        <HelpButtons onPick={() => setOpen(false)} />
        {on && <AskPanel embedded id={ASK_NAV_PANEL_ID} open={open} onClose={() => setOpen(false)} />}
      </div>
    </div>
  );
}

function SignInLink() {
  return (
    <Button asChild variant="outline" size="sm" className="text-xs">
      <Link href="/signin">Sign in</Link>
    </Button>
  );
}

/** A red circle with a count. */
function CountBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] leading-none font-semibold text-white tabular-nums',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

function AccountMenu({ viewer, todo }: { viewer: Viewer; todo: number }) {
  const router = useRouter();
  const doSignOut = useSignOut();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon-sm"
          className="relative rounded-full"
          aria-label={todo > 0 ? `Account: ${todo} admin ${todo === 1 ? 'task' : 'tasks'}` : 'Account'}
        >
          <User />
          {todo > 0 && <CountBadge count={todo} className="absolute -top-1.5 -right-1.5 ring-2 ring-white" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="truncate text-[11px] font-normal text-slate-500">
          {viewer.email}
        </DropdownMenuLabel>
        {accountLinks(viewer).map((l) => (
          <Fragment key={l.href}>
            {l === ADMIN_LINK && <DropdownMenuSeparator />}
            <DropdownMenuItem className="text-xs" onSelect={() => router.push(l.href)}>
              {l.icon && <l.icon />}
              {l.label}
              {l === ADMIN_LINK && todo > 0 && <CountBadge count={todo} className="ml-auto" />}
            </DropdownMenuItem>
          </Fragment>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-xs" onSelect={doSignOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
