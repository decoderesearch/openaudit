import { blockText, type AttemptBlock } from '@/lib/runs/blocks';
import type { EvalAttempt } from '@openaudit/spec';
import { Check, X } from 'lucide-react';

// Parts of an attempt row. Safe in server and client code.

/** `label`: "PASS" or "FAIL" after the mark, in its color. `large`: "PASSED" or "FAILED", larger, with
 * the red of a high-severity flag. `why`: why an attempt with no result is not scored. */
export function PassMark({
  attempt: a,
  label,
  large,
  why,
}: {
  attempt: Pick<EvalAttempt, 'status' | 'passed'> & { block?: AttemptBlock };
  label?: boolean;
  large?: boolean;
  why?: string;
}) {
  if (a.status === 'error' && a.block)
    return (
      <span
        title={blockText(a.block)}
        className="rounded bg-slate-100 px-1.5 py-0.5 font-sans text-[10px] whitespace-nowrap text-slate-600"
      >
        blocked
      </span>
    );
  if (a.status === 'error')
    return <span className="rounded bg-rose-50 px-1.5 py-0.5 font-sans text-[10px] text-rose-700">error</span>;
  if (a.passed != null && (label || large)) {
    const fail = large ? 'text-red-700' : 'text-rose-600';
    const [Icon, text, color] = a.passed ? [Check, 'Pass', 'text-emerald-600'] : [X, 'Fail', fail];
    return (
      <span className={`inline-flex items-center gap-x-0.5 ${color}`}>
        <Icon aria-hidden className={large ? 'size-[18px]' : 'size-4'} />
        <span className={`font-sans font-bold tracking-wide uppercase ${large ? 'text-[13px]' : 'text-[11px]'}`}>
          {large ? `${text}ed` : text}
        </span>
      </span>
    );
  }
  if (a.passed === true) return <Check aria-label="Passed" className="size-4 text-emerald-600" />;
  if (a.passed === false) return <X aria-label="Failed" className="size-4 text-rose-600" />;
  if (why)
    return (
      <span title={`Not scored: ${why}`} aria-label={`Not scored: ${why}`} className="cursor-help text-slate-400">
        —
      </span>
    );
  return <span className="text-slate-400">—</span>;
}

export const targetText = (t: EvalAttempt['target']) => (Array.isArray(t) ? t.join(', ') : (t ?? ''));
