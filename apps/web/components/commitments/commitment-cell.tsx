'use client';

import { LevelPill } from '@/components/commitments/level-pill';
import Link from '@/components/link';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { formatPoints, LEVELS, type Points } from '@/lib/commitments';
import { formatDate, plainText } from '@/lib/org-research';
import { cn } from '@/lib/utils';
import type { CommitmentLevel } from '@openaudit/spec';

/** What a cell's card shows. `score`: from `criteriaScore`. `latest`: the date of the newest event. */
export type CellFacts = {
  org: string;
  commitment: string;
  summary?: string;
  level: CommitmentLevel;
  score: Points | null;
  latest?: string | null;
};

/** Levels whose pill is a bar with the points in it. */
const BARS = new Set<CommitmentLevel>(['partial', 'full']);

/** A table cell: the level pill, which links to the timeline. Under a pill that is not a bar, the
 * points when there are any. On hover, a card shows the summary and the score. `small`: a short
 * pill, the cell's width, with only its color. `onPick`: on a click. */
export function CommitmentCell({
  href,
  facts,
  small,
  onPick,
  className,
}: {
  href: string;
  facts: CellFacts;
  small?: boolean;
  onPick?: () => void;
  className?: string;
}) {
  const { score } = facts;
  const state = { level: facts.level };
  const level = LEVELS[state.level].label;
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Link
          href={href}
          hover={false}
          onClick={onPick}
          aria-label={`${facts.org}: ${facts.commitment}, ${level}${score ? `, ${formatPoints(score.points)} of ${score.total} points` : ''}`}
          className={cn(
            'flex-col items-center gap-y-1 rounded-md outline-offset-2 hover:brightness-95',
            small ? 'flex w-full' : 'inline-flex',
            className,
          )}
        >
          <LevelPill
            state={state}
            score={score}
            bare={small}
            className={small ? 'h-4 w-full' : 'w-[4.5rem] text-[9px] sm:w-22'}
          />
          {!small && score && score.points > 0 && !BARS.has(state.level) && (
            <span className="text-[10px] font-semibold text-slate-500 tabular-nums">
              {formatPoints(score.points)}/{score.total}
            </span>
          )}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <CellCard facts={facts} />
      </HoverCardContent>
    </HoverCard>
  );
}

/** The card of a cell. Also on the pages that list one organization's commitments. */
export function CellCard({ facts }: { facts: CellFacts }) {
  const { score } = facts;
  const state = { level: facts.level };
  return (
    <div className="flex flex-col gap-y-2 text-xs text-slate-700">
      <p className="text-[11px] font-semibold text-slate-500">
        {facts.org} · {facts.commitment}
      </p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <LevelPill state={state} score={score} size="md" />
        {state.level === 'none_found' && <span className="font-semibold text-slate-700">None Found</span>}
      </div>
      <p className="leading-5">{facts.summary ? plainText(facts.summary) : LEVELS[state.level].about}</p>
      {facts.latest && <p className="text-[11px] text-slate-500">Last Change {formatDate(facts.latest)}</p>}
    </div>
  );
}
