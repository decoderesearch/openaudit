import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

/** A rose bar: `label` in caps, then `children`, which tell how many are outdated. */
export function OutdatedNote({
  label = 'Outdated Evaluations',
  children,
  className,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p data-outdated-note className={cn('bg-rose-50 px-4 py-2 text-xs font-normal text-rose-800', className)}>
      <span className="text-[11px] font-bold tracking-wide uppercase">{label}:</span> {children}
    </p>
  );
}
