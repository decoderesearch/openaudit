import Link from '@/components/link';
import { Button } from '@/components/ui/button';
import type { ReactNode } from 'react';

/** The notice on a version that is not the newest, with a link to the newest (`path`). */
export function OlderVersionNotice({ path, latest, children }: { path: string; latest: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p>{children}</p>
      <Button size="sm" asChild className="bg-sky-700 text-white hover:bg-sky-800">
        <Link href={path}>View Latest Version ({latest})</Link>
      </Button>
    </div>
  );
}
