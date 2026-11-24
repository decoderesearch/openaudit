import { LevelPill } from '@/components/commitments/level-pill';
import { InfoPopover } from '@/components/info-popover';
import { Markdown } from '@/components/markdown';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { criteriaScore, CRITERION_LABELS, EVENT_LABELS, formatPoints } from '@/lib/commitments';
import { formatDate, hostOf } from '@/lib/org-research';
import { cn } from '@/lib/utils';
import type { CommitmentCriterion, CommitmentState, CriterionStatus, OrgCommitmentEvent } from '@openaudit/spec';
import { Check, ExternalLink, Minus, X } from 'lucide-react';
import { type ReactNode } from 'react';

// The parts of the commitment pages: the criteria marks and the timeline of events.

const MARKS: Record<CriterionStatus, { icon: typeof Check; className: string }> = {
  met: { icon: Check, className: 'bg-emerald-100 text-emerald-800' },
  partly: { icon: Minus, className: 'bg-amber-100 text-amber-800' },
  not_met: { icon: X, className: 'bg-rose-100 text-rose-800' },
};

/** A criterion's mark in a small circle. Not known: a question mark in the Not Met tone. */
export function CriterionMark({
  status,
  verified = false,
  className,
}: {
  status?: CriterionStatus;
  /** An independent party can check it: an emerald ring on the circle's edge. */
  verified?: boolean;
  className?: string;
}) {
  if (!status)
    return (
      <span
        className={cn(
          'inline-flex size-5 items-center justify-center rounded-full text-[11px] font-extrabold',
          MARKS.not_met.className,
          className,
        )}
      >
        <span aria-hidden>?</span>
        <span className="sr-only">Not Known</span>
      </span>
    );
  const { icon: Icon, className: tone } = MARKS[status];
  return (
    <span
      className={cn(
        'inline-flex size-5 items-center justify-center rounded-full',
        tone,
        verified && 'ring-[1.5px] ring-emerald-700 ring-inset',
        className,
      )}
    >
      <Icon
        role="img"
        aria-label={`${CRITERION_LABELS[status]}${verified ? ', Verified' : ''}`}
        className="size-3"
        strokeWidth={3}
      />
    </span>
  );
}

/** The legend's marks: smaller than in the table. */
const SMALL_MARK = 'size-4 [&_svg]:size-2.5 [&>span]:size-3';

/** What each criterion mark means, with small marks. Not met: the tone alone. Verified: the ring
 * alone. */
export function CriteriaLegend({ className }: { className?: string }) {
  const items: { mark: ReactNode; label: string }[] = [
    ...(['met', 'partly'] as const).map((s) => ({
      mark: <CriterionMark status={s} className={SMALL_MARK} />,
      label: CRITERION_LABELS[s],
    })),
    { mark: <span className={cn('size-4 rounded-full', MARKS.not_met.className)} />, label: CRITERION_LABELS.not_met },
    {
      mark: <span className="size-4 rounded-full border-[1.5px] border-emerald-700" />,
      label: 'Verified',
    },
  ];
  return (
    <ul aria-label="Legend" className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', className)}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-x-1 text-[10px] text-slate-600">
          <span aria-hidden className="contents">
            {i.mark}
          </span>
          {i.label}
        </li>
      ))}
    </ul>
  );
}

const CRITERIA_HEAD = 'pb-1.5 text-left text-[10px] font-semibold tracking-wide text-slate-500 uppercase';

const CELL_LABEL = 'font-semibold text-slate-600 sm:hidden';
const CELL = 'sm:py-2.5 sm:pr-3 sm:last:pr-0';
/** The total's row: less space. */
const FOOT_CELL = cn(CELL, 'sm:py-2');
const NONE = <span className="text-slate-400">—</span>;

const TAG = 'w-fit text-[10px] font-semibold tracking-wide uppercase';
const VALUE = 'font-semibold text-slate-800 tabular-nums';
/** A value with its tag below it. */
const STACK = 'inline-flex flex-col items-start align-top';

/** The base points of a criterion: full (met), partial (partly met) or none. */
const BASES: Record<CriterionStatus, { label: string; points: number; className: string }> = {
  met: { label: 'Full', points: 1, className: 'text-emerald-700' },
  partly: { label: 'Partial', points: 0.5, className: 'text-amber-700' },
  not_met: { label: 'None', points: 0, className: 'text-rose-700' },
};

const VERIFIED_TAGS = {
  yes: {
    label: 'Verified',
    factor: 1,
    className: 'text-emerald-700',
    about:
      'Independently verified: a party that the organization does not control checked it and published the result. It gets its full points.',
  },
  no: {
    label: 'Not Verified',
    factor: 0.5,
    className: 'text-amber-700',
    about:
      'Not independently verified: it rests on the organization’s own word, with no public outside check. It gets half its points.',
  },
};

/** Whether a criterion with points is independently verified, with the meaning on hover, and
 * the factor for its points. */
function VerifiedFactor({ verified }: { verified: boolean }) {
  const tag = VERIFIED_TAGS[verified ? 'yes' : 'no'];
  return (
    <span className={STACK}>
      <span className={VALUE}>× {tag.factor}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className={cn(TAG, 'cursor-help underline decoration-dotted underline-offset-2', tag.className)}
          >
            {tag.label}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-64">{tag.about}</TooltipContent>
      </Tooltip>
    </span>
  );
}

/** One row for each criterion: its mark, label and target (on hover); what the organization
 * commits to; what is missing; its base points, the verified factor and the adjusted points.
 * Then the legend and the total score. On a phone, each row is a stack with labels. */
export function CriteriaTable({ criteria, state }: { criteria: CommitmentCriterion[]; state?: CommitmentState }) {
  const score =
    state &&
    criteriaScore(
      state,
      criteria.map((c) => c.key),
    );
  const points = score?.points ?? 0;
  return (
    <table className="w-full text-xs max-sm:block">
      <thead className="max-sm:sr-only">
        <tr className="border-b border-slate-200">
          <th scope="col" className={cn(CRITERIA_HEAD, 'w-px pr-3')}>
            <span className="sr-only">Criterion</span>
          </th>
          <th scope="col" className={cn(CRITERIA_HEAD, 'pr-3')}>
            Org&apos;s Commitment
          </th>
          <th scope="col" className={cn(CRITERIA_HEAD, 'pr-3')}>
            What&apos;s Missing
          </th>
          <th scope="col" className={cn(CRITERIA_HEAD, 'w-px pr-3 whitespace-nowrap')}>
            Base
          </th>
          <th scope="col" className={cn(CRITERIA_HEAD, 'w-px pr-3')}>
            Verified
          </th>
          <th scope="col" className={cn(CRITERIA_HEAD, 'w-px whitespace-nowrap')}>
            Score
          </th>
        </tr>
      </thead>
      <tbody className="max-sm:block">
        {criteria.map((c) => {
          const status = state?.criteria[c.key];
          const verified = !!state?.verified?.includes(c.key);
          const note = state?.notes?.[c.key];
          const base = BASES[status ?? 'not_met'];
          const adjusted = base.points * VERIFIED_TAGS[verified ? 'yes' : 'no'].factor;
          return (
            <tr
              key={c.key}
              className="border-b border-slate-100 align-top last:border-b-0 max-sm:flex max-sm:flex-col max-sm:gap-y-1 max-sm:py-2.5"
            >
              <th scope="row" className={cn(CELL, 'text-left font-normal sm:whitespace-nowrap')}>
                <span className="flex items-center gap-x-2">
                  <CriterionMark status={status} verified={verified} className="shrink-0" />
                  <InfoPopover
                    label={`${c.label} Target Criteria`}
                    trigger={c.label}
                    triggerClassName="text-left text-[13px]/4 font-semibold text-slate-800 no-underline hover:text-sky-800"
                    contentClassName="w-72 text-xs"
                  >
                    <span className="block text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                      Target Criteria
                    </span>
                    <span className="mt-1 block text-slate-700">{c.description}</span>
                  </InfoPopover>
                </span>
              </th>
              <td className={cn(CELL, 'text-emerald-800')}>
                <span className={CELL_LABEL}>Org&apos;s Commitment: </span>
                {note?.commitment ?? NONE}
              </td>
              <td className={cn(CELL, 'text-amber-800')}>
                <span className={CELL_LABEL}>What&apos;s Missing: </span>
                {note?.missing ?? NONE}
              </td>
              <td className={cn(CELL, 'whitespace-nowrap')}>
                <span className={CELL_LABEL}>Base: </span>
                {base.points ? (
                  <span className={STACK}>
                    <span className={VALUE}>+{formatPoints(base.points)}</span>
                    <span className={cn(TAG, base.className)}>{base.label}</span>
                  </span>
                ) : (
                  NONE
                )}
              </td>
              <td className={cn(CELL, 'whitespace-nowrap')}>
                <span className={CELL_LABEL}>Verified: </span>
                {base.points ? <VerifiedFactor verified={verified} /> : NONE}
              </td>
              <td className={cn(CELL, 'whitespace-nowrap')}>
                <span className={CELL_LABEL}>Score: </span>
                <span className={VALUE}>{formatPoints(adjusted)}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot className="max-sm:block">
        <tr className="border-t border-slate-200 max-sm:flex max-sm:flex-wrap max-sm:items-baseline max-sm:gap-x-2 max-sm:py-2.5">
          <td colSpan={4} className={cn(FOOT_CELL, 'max-sm:order-last max-sm:basis-full max-sm:pt-2')}>
            <CriteriaLegend />
          </td>
          <th scope="row" className={cn(FOOT_CELL, 'text-right font-normal whitespace-nowrap text-slate-500')}>
            Total Score
          </th>
          <td className={cn(FOOT_CELL, 'whitespace-nowrap')}>
            <span
              className={cn(
                'text-sm font-bold tabular-nums',
                score && points === score.total ? 'text-emerald-800' : 'text-amber-800',
              )}
            >
              {formatPoints(points)}
            </span>{' '}
            <span className="text-slate-500">of {criteria.length}</span>
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

/** An event's kind, as "EXPANDED". */
export const KIND = 'text-[9px]/3 font-bold tracking-wide text-slate-400 uppercase';

/** The sources on one line, with a dot between them. `small`: smaller and lighter, with no dots. */
export function Sources({
  sources,
  small = false,
  className,
}: {
  sources: OrgCommitmentEvent['sources'];
  small?: boolean;
  className?: string;
}) {
  if (!sources.length) return null;
  return (
    <p
      className={cn(
        'flex flex-wrap items-center gap-y-0.5',
        small ? 'gap-x-2.5 text-[10px] text-slate-400' : 'gap-x-1.5 text-[11px] text-slate-400',
        className,
      )}
    >
      {sources.map((s, k) => (
        <span key={s.url} className="contents">
          {k > 0 && !small && (
            <span aria-hidden className="text-slate-300">
              ·
            </span>
          )}
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            title={s.title}
            className="inline-flex items-center gap-x-0.5 font-semibold hover:text-slate-700 hover:underline"
          >
            {s.publisher ?? hostOf(s.url)}
            <ExternalLink aria-hidden className={cn('shrink-0', small ? 'size-2.5' : 'size-3')} />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </span>
      ))}
    </p>
  );
}

/** One organization's events, as given (newest first): the kind, then the date and the level with
 * the dot level with them, then the title, the summary and the sources. `keys`: the commitment's
 * criteria, for the points. */
export function CommitmentTimeline({ events, keys }: { events: OrgCommitmentEvent[]; keys: string[] }) {
  return (
    <ol className="flex flex-col">
      {events.map((e) => (
        <li key={e.id} className="group relative grid grid-cols-[11px_minmax(0,1fr)] gap-x-3 gap-y-1 pb-5 last:pb-0">
          {/* The line from this dot to the next. The dot's center is 24px down: the kind (12px), a
              gap (2px), and half the date row (10px). */}
          <span
            aria-hidden
            className="absolute top-[24px] -bottom-[24px] left-[5px] w-px bg-slate-200 group-last:hidden"
          />
          <span className={cn(KIND, 'col-start-2 -mb-0.5')}>{EVENT_LABELS[e.kind]}</span>
          <span
            aria-hidden
            className="relative size-[11px] self-center rounded-full border-2 border-white bg-slate-400"
          />
          <p className="flex h-5 items-center gap-x-2 text-[11px] text-slate-500">
            <span className="tabular-nums">{formatDate(e.date, e.datePrecision)}</span>
            <LevelPill state={e.state} score={criteriaScore(e.state, keys)} />
          </p>
          <div className="col-start-2 flex flex-col gap-y-1">
            <p className="text-[13px] font-semibold text-slate-800">{e.title}</p>
            {e.summary && <Markdown text={e.summary} className="text-xs/5 text-slate-700" />}
            <Sources sources={e.sources} />
          </div>
        </li>
      ))}
    </ol>
  );
}
