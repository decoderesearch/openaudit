'use client';

import { useRouter } from 'nextjs-toploader/app';
import { useEffect } from 'react';

/** Sends a `/cards#<card id>` link to that card's page. */
export function CardHashRedirect({ hrefs }: { hrefs: Record<string, string> }) {
  const router = useRouter();
  useEffect(() => {
    const href = hrefs[window.location.hash.slice(1)];
    if (href) router.replace(href);
  }, [hrefs, router]);
  return null;
}
