'use client';

import { useRouter } from 'nextjs-toploader/app';
import { useEffect } from 'react';

/** Reloads the page's server data every few seconds while `active`. */
export function AutoRefresh({ active, seconds = 5 }: { active: boolean; seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [active, seconds, router]);
  return null;
}
