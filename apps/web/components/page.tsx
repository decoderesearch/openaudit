import Link from '@/components/link';
import { cn } from '@/lib/utils';
import { Fragment, type ReactNode } from 'react';

// Page frame: full width on a phone, a centered column from `sm` up. All pages use `xl`; `narrow`
// is for a short message page. `fit`: the page fills the screen above the footer and does not
// scroll; a child with `min-h-0 flex-1 overflow-auto` scrolls instead (see `app/layout.tsx`).
// `fit="lg"`: only from `lg` up.
export function Page({
  children,
  width = 'xl',
  fit,
  className,
}: {
  children: ReactNode;
  width?: 'narrow' | 'xl' | 'full';
  fit?: boolean | 'lg';
  className?: string;
}) {
  return (
    <div
      data-fit-page={fit === 'lg' ? 'lg' : fit ? 'all' : undefined}
      className={cn(
        'flex w-full flex-col gap-y-5 px-4 pt-4 sm:px-6 sm:pt-5 lg:px-10',
        fit === 'lg' ? 'pb-20 lg:min-h-0 lg:flex-1 lg:pb-4' : fit ? 'min-h-0 flex-1 pb-4' : 'pb-20',
        width === 'narrow' && 'max-w-md',
        width === 'xl' && 'max-w-page',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The column of an `xl` page, for content outside one, such as the viewer sheet and the breadcrumbs. */
export const PAGE_COLUMN = 'mx-auto w-full max-w-page px-4 sm:px-6 lg:px-10';
/** The column of the footer: a little wider than `PAGE_COLUMN`. */
export const BAR_COLUMN = 'mx-auto w-full max-w-page px-4 sm:px-6 lg:px-8';
/** The column of the navbar: wider than `BAR_COLUMN`. */
export const NAV_COLUMN = 'mx-auto w-full max-w-page px-4 sm:px-6';

/** On a `fit="lg"` page with an updates feed: the row that holds the list and the feed. Under `lg`, the
 * list's search box is above the feed, and a search (`data-searching` on the list) hides the feed.
 * In a short window, the row keeps a minimum height and the page scrolls. */
export const FEED_PAGE = 'group/feed-page flex min-h-0 flex-1 flex-col gap-2 lg:min-h-96 lg:flex-row lg:gap-3';
/** The list column at the left. The feed (`FEED_MAIN`) takes the rest of the width. */
export const FEED_SIDE = 'lg:w-[30%] lg:flex-none';
/** Under `lg`, the feed's title goes above the list column, and its box fills the page's padding to
 * the screen edges and the footer, with no border. */
export const FEED_MAIN = cn(
  'min-w-0 flex-1 max-lg:group-has-[[data-searching]]/feed-page:hidden max-lg:not-group-has-[[data-searching]]/feed-page:contents',
  'max-lg:[&>div]:-mx-4 max-lg:[&>div]:-mb-4 sm:max-lg:[&>div]:-mx-6 max-lg:[&>div]:rounded-none max-lg:[&>div]:border-0',
  'max-lg:[&>h2]:order-first max-lg:[&>h2]:mb-0 max-lg:[&>h2]:h-auto max-lg:[&>h2]:justify-center',
  'max-lg:[&>h2]:text-[11px] max-lg:[&>h2]:tracking-wide max-lg:[&>h2]:text-slate-400 max-lg:[&>h2]:uppercase',
);

export function PageHeader({
  title,
  eyebrow,
  eyebrowSuffix,
  eyebrowAfter,
  aside,
  description,
  descriptionClassName,
  actions,
}: {
  title: ReactNode;
  /** A small uppercase line above the title, such as the document type. */
  eyebrow?: ReactNode;
  /** More text after the eyebrow ("for Workspace Lenses"). */
  eyebrowSuffix?: ReactNode;
  /** More items after the eyebrow, after a center dot. */
  eyebrowAfter?: ReactNode;
  /** A small line at the right of the title, such as the version. */
  aside?: ReactNode;
  description?: ReactNode;
  /** Replaces the description's size and color. */
  descriptionClassName?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <Eyebrow suffix={eyebrowSuffix} after={eyebrowAfter}>
            {eyebrow}
          </Eyebrow>
        )}
        {aside ? (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <PageTitle>{title}</PageTitle>
            <div className="text-sm text-slate-500">{aside}</div>
          </div>
        ) : (
          <PageTitle>{title}</PageTitle>
        )}
        {description && <p className={cn('mt-1 text-sm text-slate-500', descriptionClassName)}>{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-x-2">{actions}</div>}
    </div>
  );
}

/** A small uppercase line above a page title, such as the document type. `suffix`: more text.
 * `after`: more items after a center dot. */
export function Eyebrow({
  children,
  className,
  suffix,
  after,
}: {
  children: ReactNode;
  className?: string;
  suffix?: ReactNode;
  after?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-x-1 text-xs font-semibold tracking-wide text-slate-500 uppercase',
        className,
      )}
    >
      {children}
      {suffix && <span className="inline-flex items-center gap-x-1">{suffix}</span>}
      {after && (
        <>
          <span className="mx-0.5 text-slate-300" aria-hidden>
            ·
          </span>
          {after}
        </>
      )}
    </div>
  );
}

/** Small uppercase items at the right of a page title, such as the method of a variant. An item
 * with `href` is a sky link; one without it is gray text. */
export function TitleTags({ items }: { items: { label: string; href?: string }[] }) {
  if (!items.length) return null;
  return (
    <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
      {items.map((t, i) => (
        <Fragment key={t.href ?? t.label}>
          {i > 0 && ', '}
          {t.href ? (
            <Link href={t.href} className="text-sky-800 hover:underline">
              {t.label}
            </Link>
          ) : (
            t.label
          )}
        </Fragment>
      ))}
    </span>
  );
}

export function PageTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h1 className={cn('font-display text-xl font-semibold break-words text-slate-800 sm:text-2xl', className)}>
      {children}
    </h1>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}
