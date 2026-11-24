import { VerdictChip } from '@/components/deploymeter/score-ring';
import Link from '@/components/link';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ABSTAIN, EVIDENCE_LABELS, judgePath, verdictOf, VERDICTS, type Evidence } from '@/lib/deploymeter';
import { cn } from '@/lib/utils';
import type { DeployGuess } from '@openaudit/spec';
import type { ReactNode } from 'react';

export type ReviewCardData = {
  score: number | null;
  /** The judge abstains: no score. */
  abstain?: boolean;
  sameLab: boolean;
  self: boolean;
  headline: string | null;
  summary: string | null;
  reasonsFor: string[];
  reasonsAgainst: string[];
  guess: DeployGuess | null;
  error: string | null;
  samples?: number[];
  /** The full review page. */
  href?: string;
  evidence?: Evidence;
};

/** Small grey pills, for example "Open weights". */
export function Pill({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'amber' }) {
  return (
    <span
      className={cn(
        'rounded-full px-1.5 text-[10px] leading-4 whitespace-nowrap',
        tone === 'amber' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-600',
      )}
    >
      {children}
    </span>
  );
}

/** A short uppercase note in a line of text, with no box: slate, or amber for a warning. */
export function Flag({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'amber' }) {
  return (
    <span className={cn('font-semibold uppercase', tone === 'amber' ? 'text-amber-600' : 'text-slate-500')}>
      {children}
    </span>
  );
}

/** Why a review does not count, or nothing. */
export function notCounted(r: Pick<ReviewCardData, 'sameLab' | 'self'>) {
  return r.self ? 'Self-review: not counted' : r.sameLab ? 'Same developer: not counted' : null;
}

/** One AI judge's review. `title`: the judge (on a model page) or the model (on a judge page).
 * Lists of reviews put a line between them. */
export function ReviewCard({
  review: r,
  title,
  tags,
  guess,
}: {
  review: ReviewCardData;
  title: ReactNode;
  tags?: ReactNode;
  /** Show whether the judge guessed the developer. */
  guess?: boolean;
}) {
  const excluded = notCounted(r);
  return (
    <li
      className={cn(
        'relative -mx-2 flex min-w-0 flex-col gap-y-1.5 rounded-md px-2 py-3',
        r.href && 'transition-colors hover:bg-sky-50',
      )}
    >
      {r.href && <Link href={r.href} aria-label="Full review" className="absolute inset-0 rounded-md" />}
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] font-medium text-slate-800">
        <span className="relative z-10">{title}</span>
        {tags}
        {excluded && <Pill tone="amber">{excluded}</Pill>}
        {r.evidence && EVIDENCE_LABELS[r.evidence] && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="relative z-10 cursor-help rounded-full outline-none">
                <Pill tone="amber">Limited View</Pill>
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              {EVIDENCE_LABELS[r.evidence]}. Its provider&apos;s safety filter blocked the full evidence.
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="flex items-start gap-x-3">
        <span
          title={r.abstain ? ABSTAIN.text : r.score === null ? 'No score' : `${r.score} of 100`}
          className={cn(
            'w-16 shrink-0 text-center text-2xl/none font-extrabold tabular-nums',
            r.score === null ? 'text-slate-300' : VERDICTS[verdictOf(r.score)].score,
          )}
        >
          {r.score === null ? '–' : `${r.score}%`}
        </span>
        <div className="flex min-w-0 flex-col items-start gap-y-1">
          {r.score !== null && <VerdictChip score={r.score} judge className="border-0 px-2 py-0.5" />}
          {r.abstain && (
            <span title={ABSTAIN.text} className={cn('rounded px-2 py-0.5 text-[11px]/none font-medium', ABSTAIN.chip)}>
              {ABSTAIN.judge}
            </span>
          )}
          {r.headline ? (
            <p className="text-xs text-slate-700">&ldquo;{r.headline}&rdquo;</p>
          ) : (
            <p className="text-xs text-slate-500">
              No answer from this judge{r.error ? ` (${r.error.slice(0, 120)})` : ''}.
            </p>
          )}
          {guess && r.guess && (
            <p className="text-[11px] text-slate-500">
              {r.guess.rightDeveloper ? 'Correctly guessed the developer.' : 'Did not guess the developer.'}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

export function JudgeLink({ judge, name }: { judge: string; name: string }) {
  return (
    <Link href={judgePath(judge)} className="hover:text-sky-800 hover:underline">
      {name}
    </Link>
  );
}
