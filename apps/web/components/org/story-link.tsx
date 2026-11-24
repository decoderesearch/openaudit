import Link from '@/components/link';
import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';
import type { MouseEventHandler, ReactNode } from 'react';

/** The classes of a list row around a `StoryLink` with `row`. With `href`, the row is sky on hover. */
export const storyRow = (href?: string) =>
  cn('-mx-2 rounded-md px-2 py-1', href && 'group/story relative transition-colors hover:bg-sky-50');

/** A link to an incident's page (a path), or to a departure's story on another site, in a new tab
 * with an icon after it. With no `href`, only the text. `row`: the link covers its `storyRow`, and
 * is sky and underlined when the row is hovered. Other links in the row need `relative z-10`. */
export function StoryLink({
  href,
  row,
  icon = true,
  onClick,
  className,
  children,
}: {
  href?: string;
  row?: boolean;
  icon?: boolean;
  onClick?: MouseEventHandler;
  className?: string;
  children: ReactNode;
}) {
  if (!href) return <span className={className}>{children}</span>;
  const classes = cn(
    className,
    row && 'group-hover/story:text-sky-800 group-hover/story:underline after:absolute after:inset-0',
  );
  if (href.startsWith('/'))
    return (
      <Link href={href} onClick={onClick} className={classes}>
        {children}
      </Link>
    );
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" onClick={onClick} className={classes}>
      {children}
      {icon && (
        <ExternalLink
          aria-hidden
          className="ml-1 inline size-3 -translate-y-px text-slate-400 group-hover/story:text-sky-800"
        />
      )}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
