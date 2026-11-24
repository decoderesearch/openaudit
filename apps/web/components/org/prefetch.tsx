'use client';

import Link from '@/components/link';
import type { PrefetchKind } from 'next/dist/client/components/router-reducer/router-reducer-types';
import { usePathname } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';
import { useEffect, useEffectEvent, type ComponentProps } from 'react';

// A full prefetch puts the whole page in the router's cache for 5 minutes (`staleTimes.static`), so
// a click on a link to it shows it with no request.

const FULL = { kind: 'full' as PrefetchKind };

/** Loads each page in `hrefs` in full, and again after each navigation. The cache does not keep the
 * first page shown, and it skips the pages it has. */
export function usePrefetch(hrefs: string[]) {
  const router = useRouter();
  const path = usePathname();
  const key = hrefs.join('\n');
  const load = useEffectEvent((all: string) => {
    for (const href of all.split('\n')) if (href) router.prefetch(href, FULL);
  });
  useEffect(() => load(key), [key, path]);
}

/** `Link` that loads its page in full when the pointer or the focus comes to it. */
export function PrefetchLink({ onPointerEnter, onFocus, ...props }: ComponentProps<typeof Link>) {
  const router = useRouter();
  const load = () => router.prefetch(String(props.href), FULL);
  return (
    <Link
      {...props}
      onPointerEnter={(e) => {
        onPointerEnter?.(e);
        load();
      }}
      onFocus={(e) => {
        onFocus?.(e);
        load();
      }}
    />
  );
}
