import Link from '@/components/link';
import { SUBMIT_BUTTON } from '@/lib/submissions';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';

/** The How to Contribute sections that the submit buttons link to. */
const VARIANTS = '/contribute#method-variants';
const EVALS = { models: '/contribute#model-evaluations', methods: '/contribute#method-evaluations' } as const;

/** A "Submit Variant" button (or `label`). It opens the How to Contribute guide. `href`: another target. */
export function SubmitVariant({
  href = VARIANTS,
  label = 'Submit Variant',
  className,
}: {
  href?: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link href={href} hover={false} className={cn(SUBMIT_BUTTON, className)}>
      <Plus aria-hidden />
      {label}
    </Link>
  );
}

/** A row under the last row of a results table, with a larger "Submit New Variant" button at its
 * center. `note`: text at its right. */
export function SubmitVariantRow({ href, note }: { href?: string; note?: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-slate-100 px-4 py-3">
      <SubmitVariant href={href} label="Submit New Variant" className="h-8 px-4 py-1.5 text-[11px] font-bold" />
      {note && <p className="text-xs text-slate-500">{note}</p>}
    </div>
  );
}

/** A "Model Evaluation" or "Method Evaluation" button, or "Evaluation" when `plain`. It opens the
 * How to Contribute guide. */
export function SubmitEvaluation({
  tests,
  plain,
  className,
}: {
  tests: 'models' | 'methods';
  plain?: boolean;
  className?: string;
}) {
  return (
    <Link href={EVALS[tests]} hover={false} className={cn(SUBMIT_BUTTON, className)}>
      <Plus aria-hidden />
      {!plain && (tests === 'models' ? 'Model ' : 'Method ')}Evaluation
    </Link>
  );
}
