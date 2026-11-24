'use client';

import { cn } from '@/lib/utils';
import { useRouter } from 'nextjs-toploader/app';
import type { ComponentProps } from 'react';

/** A table row that opens `href` on a click that is not on a link or a text selection. */
export function LinkRow({ href, className, ...props }: ComponentProps<'tr'> & { href: string }) {
  const router = useRouter();
  return (
    <tr
      {...props}
      onClick={(ev) => !(ev.target as Element).closest('a') && !getSelection()?.toString() && router.push(href)}
      className={cn('cursor-pointer', className)}
    />
  );
}
