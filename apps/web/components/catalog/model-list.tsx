import { Meter, METER_WIDTH } from '@/components/deploymeter/meter';
import type { MeterJudge } from '@/lib/deploymeter';
import { cn } from '@/lib/utils';
import { BookCheck, MessageSquareWarning } from 'lucide-react';
import type { ReactNode } from 'react';
/** `flagged`: the flagged chats on the model page. `deploymeter`: the score of the newest
 * published Deploymeter panel; `judges`: its counted judges. */
export type EvalCounts = {
  openAudit: number;
  systemCard: number;
  flagged: number;
  deploymeter?: number | null;
  judges?: MeterJudge[] | null;
};

/** The id of the Incidents section of a model page. */
export const INCIDENTS_HASH = 'incidents';

const ABOUT = {
  flagged: "Chats from OpenAudit's evals in which this model did something of concern.",
  openAudit: 'Evals that OpenAudit ran on this model, with public results.',
};

/** A count: its mark, then its number. `title`: its meaning in words, also for screen readers.
 * `about`: what the count is, under the title on hover. */
function Count({
  mark,
  n,
  title,
  about,
  className,
}: {
  mark?: ReactNode;
  n: ReactNode;
  title: string;
  about: string;
  className: string;
}) {
  return (
    <span title={`${title}\n${about}`} className={cn('flex items-center gap-x-1', className)}>
      {mark}
      <span aria-hidden>{n}</span>
      <span className="sr-only">{title}</span>
    </span>
  );
}

/** A model's Deploymeter score, then its flagged chats above its confirmed (OpenAudit) evals, in
 * fixed widths so that rows align. The counts are not links: the row links to the model page.
 * `href`: the score links to the model page; leave it out in a row that is one link.
 * `hideNone`: no score or flagged chats when empty. `model`: its name, for the meter hover. */
export function EvalCountsRow({
  evals,
  href,
  model,
  className,
  hideNone = false,
}: {
  evals: EvalCounts;
  href?: string;
  model?: string;
  className?: string;
  hideNone?: boolean;
}) {
  const score = evals.deploymeter;
  const flagged = evals.flagged === 1 ? 'Flagged Chat' : 'Flagged Chats';
  const openAudits = evals.openAudit === 1 ? 'OpenAudit' : 'OpenAudits';
  return (
    <div className={cn('flex shrink-0 items-center gap-x-4 text-[11px] font-semibold tabular-nums', className)}>
      {score != null || !hideNone ? (
        <Meter score={score} judges={evals.judges} href={href} model={model} />
      ) : (
        <span className={METER_WIDTH} />
      )}
      <span className="flex w-12 flex-col gap-y-0.5 leading-4">
        {evals.flagged > 0 || !hideNone ? (
          <Count
            mark={<MessageSquareWarning aria-hidden className="size-3.5 shrink-0" />}
            n={evals.flagged}
            title={`${evals.flagged || 'No'} ${flagged}`}
            about={ABOUT.flagged}
            className={evals.flagged ? 'text-amber-700' : 'text-slate-400'}
          />
        ) : (
          <span className="h-4" />
        )}
        <Count
          mark={<BookCheck aria-hidden className="size-3.5 shrink-0" />}
          n={evals.openAudit}
          title={`${evals.openAudit || 'No'} ${openAudits}`}
          about={ABOUT.openAudit}
          className={evals.openAudit ? 'text-slate-600' : 'text-slate-400'}
        />
      </span>
    </div>
  );
}

export type ModelTableRow = {
  id: string;
  displayName: string;
  name: string;
  path: string;
  parentRelation?: string;
  removedFromHub?: boolean;
  organization: { displayName: string; path: string };
  released?: string;
  /** hf (open weights) | api (closed). */
  source?: string;
  evals: EvalCounts;
  /** Names, family, aliases and organization, for a client search. */
  search?: string;
};

/** Models with OpenAudit evals first, then newest release first. Models with no release date go
 * last in each group. */
export const byOpenAuditThenRelease = <T extends Pick<ModelTableRow, 'evals' | 'released'>>(rows: T[]) =>
  [...rows].sort(
    (a, b) =>
      +!a.evals.openAudit - +!b.evals.openAudit ||
      (!a.released || !b.released ? +!a.released - +!b.released : b.released.localeCompare(a.released)),
  );

export const MODEL_SORTS = [
  { value: 'openaudit', label: 'OpenAudit' },
  { value: 'flagged', label: 'Flagged Chats' },
] as const;

export type ModelSort = (typeof MODEL_SORTS)[number]['value'];

/** The sort in a URL value. The default is `openaudit`. */
export const parseModelSort = (v?: string): ModelSort => MODEL_SORTS.find((o) => o.value === v)?.value ?? 'openaudit';

/** `openaudit`: `byOpenAuditThenRelease`. `flagged`: the most flagged chats first, then in
 * `byOpenAuditThenRelease` order. */
export function sortModels<T extends Pick<ModelTableRow, 'evals' | 'released'>>(rows: T[], sort: ModelSort): T[] {
  const sorted = byOpenAuditThenRelease(rows);
  return sort === 'openaudit' ? sorted : sorted.sort((a, b) => b.evals[sort] - a.evals[sort]);
}
