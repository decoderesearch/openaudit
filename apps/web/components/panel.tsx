import { INSET_TITLE } from '@/components/box-title';
import { InfoPopover } from '@/components/info-popover';
import Link from '@/components/link';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

/**
 * A box with a title bar, as on the model page: `info` after the title, `action` at the right.
 * `sub`: small text after the title. With `eyebrow`, the bar is white, the eyebrow is above a larger title, and `sub` is below it.
 * `children` fill the box with no padding, so a table or a list of rows meets the edges.
 * With no `title`, no title bar.
 */
export function Panel({
  eyebrow,
  title,
  sub,
  info,
  action,
  children,
  id,
  className,
}: {
  eyebrow?: ReactNode;
  title?: ReactNode;
  sub?: ReactNode;
  info?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        'flex min-w-0 scroll-mt-20 flex-col overflow-hidden rounded-md border border-slate-200 bg-white',
        className,
      )}
    >
      {title && (
        <div
          className={cn(
            'flex min-h-10 shrink-0 flex-wrap gap-x-1 gap-y-1',
            eyebrow ? 'items-end bg-white px-6 py-5' : 'items-center bg-slate-50 px-4 py-2',
          )}
        >
          {eyebrow ? (
            <div className="min-w-0">
              <p className={cn(INSET_TITLE, 'text-slate-400')}>{eyebrow}</p>
              <h2 className="text-base font-semibold text-slate-800">{title}</h2>
              {sub && <p className="text-xs text-slate-500">{sub}</p>}
            </div>
          ) : (
            <>
              <h2 className={INSET_TITLE}>{title}</h2>
              {sub && <span className="ml-1 text-xs text-slate-500">{sub}</span>}
            </>
          )}
          {info && (
            <InfoPopover label={typeof title === 'string' ? title : 'this panel'} iconClassName="size-3">
              {info}
            </InfoPopover>
          )}
          {action && <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** A name in a `Panel` title, for example an eval's: in its own case, not in capitals. */
export function TitleName({ children }: { children: ReactNode }) {
  return <span className="tracking-normal normal-case">{children}</span>;
}

/** A place (a medal, or "4th") after a name in a `Panel` title. No text with no place. */
export function TitlePlace({ place }: { place?: string | null }) {
  return place ? <span className="text-sm font-normal text-slate-500"> {place}</span> : null;
}

/** "Evaluation Results · <name>", a `Panel` title. `children`: the name, a link to the eval or suite. */
export function ResultsTitle({ children }: { children: ReactNode }) {
  return (
    <>
      Evaluation Results · <TitleName>{children}</TitleName>
    </>
  );
}

/** A list of rows in a `Panel`, with a line between rows. */
export function PanelRows({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-slate-100">{children}</ul>;
}

/**
 * One row of `PanelRows`, as in the model page's run table: a click anywhere opens `href`. `name`
 * is in blue, then `tags`, then `sub` below it.
 */
export function PanelRow({
  href,
  name,
  tags,
  sub,
}: {
  href: string;
  name: ReactNode;
  tags?: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <li className="group relative px-4 py-2.5 hover:bg-sky-50/60">
      <Link href={href} className="absolute inset-0">
        <span className="sr-only">{name}</span>
      </Link>
      <span className="text-[13px] font-medium text-sky-800 group-hover:underline">{name}</span>
      {tags && <span className="relative ml-1.5 inline-flex gap-1">{tags}</span>}
      {sub && <div className="mt-0.5 text-[11px] text-slate-600">{sub}</div>}
    </li>
  );
}
