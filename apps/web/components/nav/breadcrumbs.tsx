import type { EvalCounts } from '@/components/catalog/model-list';
import type { Score } from '@/components/catalog/score';
import Link from '@/components/link';
import { CrumbMenu } from '@/components/nav/crumb-menu';
import { PAGE_COLUMN } from '@/components/page';
import type { EvalHover } from '@/lib/server/eval-hovers';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { Fragment } from 'react';

/** `evals`: a model's counts, as in the home page's models list. `run`: an eval's run, with its
 * summary, topic names and headline result. `score`: an attempt's main score, as text, and its bar.
 * `about`: an eval's summary and topics, shown on hover. `info`: other text, shown on hover. */
export type CrumbLink = {
  label: string;
  href: string;
  external?: boolean;
  evals?: EvalCounts;
  run?: { summary: string | null; topics: string[]; result: Score | null };
  score?: { text: string; bar: Score | null };
  about?: EvalHover;
  info?: string;
  /** Under the link before it, for example a method's variant. */
  indent?: boolean;
};
/** `hint` shows at the right of the highlighted link. `sticky`: the title stays at the top while its links scroll. */
export type CrumbGroup = { title?: string; hint?: string; sticky?: boolean; links: CrumbLink[] };
/** With `menu`, the crumb opens a list of its sibling pages, and an "Open" link to `href` when it is
 * not the current page. `ahead`: a menu of pages below the current page, after its crumb. `selected`: the menu link to
 * mark, for a crumb with no page of its own. `heading`: what the menu lists, at the top of its
 * scroll area. `about`: the crumb is an eval; its summary and topics show on hover. `info`: other
 * text, shown on hover. */
export type Crumb = {
  label: string;
  href?: string;
  menu?: CrumbGroup[];
  heading?: string;
  ahead?: boolean;
  selected?: string;
  about?: EvalHover;
  info?: string;
};

/** The bar below the navbar, from md up: Home, then each crumb. The last crumb that is not
 * `ahead` is the current page. */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const page = crumbs.findLastIndex((c) => !c.ahead);
  return (
    <nav
      aria-label="Breadcrumb"
      data-sticky-bar
      className="sticky top-[calc(3rem+env(safe-area-inset-top))] z-15 flex min-h-9 w-full items-center bg-slate-200 py-1.5 text-xs text-slate-600 max-lg:hidden"
    >
      <ol className={cn(PAGE_COLUMN, 'flex min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap sm:gap-2')}>
        <li className="flex h-6 items-center">
          <Link href="/" className="transition-colors hover:text-sky-700 hover:underline">
            Home
          </Link>
        </li>
        {crumbs.map((c, i) => {
          const current = i === page;
          return (
            <Fragment key={i}>
              <li role="presentation" aria-hidden="true" className="flex h-6 items-center">
                <ChevronRight className="size-3.5 text-slate-400" strokeWidth={1.75} />
              </li>
              {c.menu ? (
                <li className="min-w-0">
                  <CrumbMenu
                    label={c.label}
                    href={c.href}
                    selected={c.selected}
                    heading={c.heading}
                    groups={c.menu}
                    current={current}
                    about={c.about}
                    info={c.info}
                  />
                </li>
              ) : (
                <li className="flex h-6 min-w-0 items-center truncate">
                  {c.href && !current ? (
                    <Link href={c.href} className="transition-colors hover:text-sky-700 hover:underline">
                      {c.label}
                    </Link>
                  ) : (
                    <span aria-current={current ? 'page' : undefined} className="truncate text-slate-800">
                      {c.label}
                    </span>
                  )}
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
