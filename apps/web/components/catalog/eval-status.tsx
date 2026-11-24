import { Tag } from '@/components/catalog/parts';
import { EvalLink } from '@/components/eval-link';
import { Markdown } from '@/components/markdown';
import { formatDate } from '@/lib/org-research';
import { cn } from '@/lib/utils';
import type { EvalStatus } from '@openaudit/spec';

// The eval status for people: a small tag, and a line with the reason and the newer eval.
// An active eval shows neither.

export const EVAL_STATUS_LABELS: Record<EvalStatus, string> = {
  active: 'Active',
  saturated: 'Saturated',
  legacy: 'Legacy',
  retired: 'Retired',
};

const STYLE: Record<EvalStatus, string> = {
  active: '',
  saturated: 'bg-slate-100 text-slate-600',
  legacy: 'bg-slate-100 text-slate-600',
  retired: 'bg-slate-100 text-slate-500',
};

export const EVAL_STATUS_INFO: Record<EvalStatus, string> = {
  active: 'Current, and we recommend it.',
  saturated: 'Valid, but current models score at the ceiling or the floor.',
  legacy:
    'Dated, replaced, or with known validity problems. You can still run it for history, but we do not recommend it.',
  retired: 'Withdrawn. We do not run it.',
};

export function EvalStatusTag({ status, className }: { status?: string | null; className?: string }) {
  const s = status as EvalStatus | undefined;
  if (!s || s === 'active' || !(s in STYLE)) return null;
  return (
    <span title={EVAL_STATUS_INFO[s]} className="inline-flex align-middle">
      <Tag className={cn('border-transparent text-[9px] tracking-wide uppercase', STYLE[s], className)}>
        {EVAL_STATUS_LABELS[s]}
      </Tag>
    </span>
  );
}

type StatusFields = {
  status: EvalStatus;
  saturatedReason?: string | null;
  saturatedDecisionDate?: string | null;
  legacyReason?: string | null;
  legacyDecisionDate?: string | null;
  supersededBy?: string | null;
};

/** The reason and the decision day of a status, if it has them. */
function decision(e: StatusFields, status: EvalStatus) {
  if (status === 'saturated') return { reason: e.saturatedReason?.trim(), date: e.saturatedDecisionDate };
  if (status === 'legacy') return { reason: e.legacyReason?.trim(), date: e.legacyDecisionDate };
  return {};
}

function Decision({ e, status }: { e: StatusFields; status: EvalStatus }) {
  const { reason, date } = decision(e, status);
  return (
    <>
      <span className="font-medium text-slate-700">{EVAL_STATUS_LABELS[status]}</span>
      {date && <span className="text-slate-500"> ({formatDate(date)})</span>}
      {reason ? (
        <>
          : <Markdown text={/[.!?]$/.test(reason) ? reason : `${reason}.`} inline />
        </>
      ) : (
        '. '
      )}
    </>
  );
}

/**
 * "Legacy (Oct 5, 2026): <reason>. Newer: <eval>.", with only the parts that exist. A legacy eval
 * that was saturated before also shows the saturated decision.
 */
export function EvalStatusNote({
  eval: e,
  newerName,
  className,
}: {
  eval: StatusFields;
  /** The newer eval's name. Default: its slug. */
  newerName?: string;
  className?: string;
}) {
  if (e.status === 'active') return null;
  const before = e.status === 'legacy' && (e.saturatedReason || e.saturatedDecisionDate);
  return (
    <div className={cn('text-xs text-slate-600', className)} title={EVAL_STATUS_INFO[e.status]}>
      <p>
        <Decision e={e} status={e.status} />
        {e.supersededBy && (
          <>
            Newer:{' '}
            <EvalLink slug={e.supersededBy} className="text-sky-800 hover:underline">
              {newerName ?? e.supersededBy}
            </EvalLink>
            .
          </>
        )}
      </p>
      {before && (
        <p className="mt-1">
          <Decision e={e} status="saturated" />
        </p>
      )}
    </div>
  );
}
