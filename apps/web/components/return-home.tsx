import Link from '@/components/link';
import { cn } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';

/** A slate pill that goes to the home page. In a flex column, it is centered. */
export function ReturnHome({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      hover={false}
      className={cn(
        'inline-flex h-8 items-center gap-x-1.5 self-center rounded-full bg-slate-500 px-5 text-xs font-semibold text-white transition-colors hover:bg-slate-600',
        className,
      )}
    >
      <ArrowLeft className="size-3.5" aria-hidden />
      Return to Home
    </Link>
  );
}
