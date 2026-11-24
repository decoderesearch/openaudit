import Link from '@/components/link';
import { cn } from '@/lib/utils';
import { TriangleAlert } from 'lucide-react';

/** A caution above a models list: a link to the FAQ on why the newest models have few evals. */
export function NewestModelsNote({ className }: { className?: string }) {
  return (
    <Link
      href="/faqs#newest-models"
      className={cn(
        'flex items-start gap-x-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 hover:border-amber-300 hover:bg-amber-100',
        className,
      )}
    >
      <TriangleAlert className="mt-px size-3.5 shrink-0 text-amber-600" aria-hidden />
      Where are Claude Fable and GPT Astra?
    </Link>
  );
}
