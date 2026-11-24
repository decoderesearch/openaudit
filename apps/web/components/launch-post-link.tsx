import { LAUNCH_POST_URL } from '@/lib/env';
import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';
import type { Ref } from 'react';

/** The link to our launch post, above the home hero title. It opens in a new tab. */
export function LaunchPostLink({ className, ref }: { className?: string; ref?: Ref<HTMLAnchorElement> }) {
  return (
    <a
      ref={ref}
      href={LAUNCH_POST_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded-full bg-sky-200 px-4 py-1 text-xs font-medium text-sky-900 transition-colors hover:bg-sky-100',
        className,
      )}
    >
      OpenAudit Beta - Launch Post
      <ExternalLink aria-hidden className="size-3.5 shrink-0" />
    </a>
  );
}
