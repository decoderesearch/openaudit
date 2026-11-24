import Link from '@/components/link';
import { cn } from '@/lib/utils';
import { Columns2 } from 'lucide-react';

/** "Compare": a link to the compare page (`href`), with a slate border that is sky on hover. */
export function CompareButton({ href, className }: { href: string; className?: string }) {
  return (
    <Link
      href={href}
      hover={false}
      className={cn(
        'inline-flex shrink-0 items-center gap-x-1 rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-slate-600 transition-colors hover:border-sky-600 hover:bg-sky-50 hover:text-sky-800 [&>svg]:size-3.5',
        className,
      )}
    >
      <Columns2 aria-hidden />
      Compare
    </Link>
  );
}
