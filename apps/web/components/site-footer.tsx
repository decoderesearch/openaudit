import Link from '@/components/link';
import { BAR_COLUMN } from '@/components/page';
import { CANARY_GUID, LEGAL_EMAIL } from '@/lib/legal';
import { cn } from '@/lib/utils';

/** Below md, the legal links are in the mobile menu, and the bottom padding leaves room for the
 * mobile dock (`mobile-nav.tsx`). Hidden while the viewer shows: the page scrolls up above the
 * viewer, and the footer must not show beside it. */
export function SiteFooter() {
  return (
    <footer className="w-full bg-slate-200 pt-2 pb-[calc(5rem+env(safe-area-inset-bottom))] text-xs text-slate-700 lg:pb-[calc(0.5rem+env(safe-area-inset-bottom))] [body:has([data-viewer-sheet])_&]:invisible">
      <div className={cn(BAR_COLUMN, 'flex flex-col items-center gap-2 lg:flex-row lg:justify-between')}>
        <nav aria-label="Legal" className="flex gap-x-4 max-lg:hidden">
          <Link href="/terms" className="hover:text-sky-800 hover:underline">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-sky-800 hover:underline">
            Privacy
          </Link>
          <a href={`mailto:${LEGAL_EMAIL}`} className="hover:text-sky-800 hover:underline">
            Contact Decode Research
          </a>
        </nav>
        <p className="font-mono text-[10px] text-slate-600">{CANARY_GUID}</p>
      </div>
    </footer>
  );
}
