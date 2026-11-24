import { cn } from '@/lib/utils';

/** For a model with no OpenAudit that came out after most of our evals (`evalsTooOld`). */
export function EvalsTooOld({ className }: { className?: string }) {
  return (
    <span className={cn('flex flex-col gap-y-0.5', className)}>
      <span className="text-xs font-semibold text-rose-800">Requires Newer Model Evaluation Types</span>
      <span className="text-[11px] text-slate-500">
        This model was released after our existing public evaluations, so its evaluation results are unlikely to be
        accurate.
      </span>
    </span>
  );
}
