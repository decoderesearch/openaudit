import { PRIMARY_CATEGORY_LABELS } from '@/lib/org-research';
import { cn } from '@/lib/utils';
import type { IncidentPrimaryCategory } from '@openaudit/spec';

/** An incident's primary category, as a small label over its title: what went wrong. */
export function IncidentCategory({ category, className }: { category: IncidentPrimaryCategory; className?: string }) {
  return (
    <span className={cn('block text-[10px]/4 font-semibold tracking-wide text-amber-600 uppercase', className)}>
      {PRIMARY_CATEGORY_LABELS[category]}
    </span>
  );
}
