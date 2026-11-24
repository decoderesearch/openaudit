import { InfoPopover } from '@/components/info-popover';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

/** The box of a page section: light border, rounded corners, white background. */
export const PANEL = 'rounded-lg border border-slate-200 bg-white px-4 pt-3 pb-4 sm:px-5 sm:pt-4 sm:pb-5';

/**
 * A titled group of page content, in a box. `plain`: no box and a small title, for a group
 * inside a box. `actions` show at the right of the title.
 */
export function Section({
  title,
  children,
  id,
  className,
  titleClassName,
  info,
  actions,
  plain,
}: {
  title: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
  titleClassName?: string;
  /** What the section is, shown from a question-mark icon after the title. */
  info?: ReactNode;
  actions?: ReactNode;
  plain?: boolean;
}) {
  const heading = (
    <h2
      className={cn(
        'flex items-center gap-x-1.5 font-semibold',
        plain ? 'text-sm text-slate-700' : 'text-lg text-slate-800',
        titleClassName,
      )}
    >
      {title}
      {info && <InfoPopover label={typeof title === 'string' ? title : 'About this section'}>{info}</InfoPopover>}
    </h2>
  );
  return (
    <section id={id} className={cn('flex min-w-0 flex-col gap-2', !plain && PANEL, className)}>
      {actions ? (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          {heading}
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        </div>
      ) : (
        heading
      )}
      {children}
    </section>
  );
}
