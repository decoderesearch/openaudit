'use client';

import { MEDALS } from '@/components/catalog/leaders';
import { CARD_ABOUT, CARD_HEAD, CARD_LIST, CARD_NAME } from '@/components/catalog/snippet-feed';
import { ScoreBar } from '@/components/commitments/level-pill';
import Link from '@/components/link';
import { Photo } from '@/components/org/departure-photo';
import { LeaverDetails } from '@/components/org/leaver-details';
import { StoryLink, storyRow } from '@/components/org/story-link';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { CATEGORY_LABELS, CATEGORY_ORDER, formatPoints, orgCommitmentsPath } from '@/lib/commitments';
import type { MethodFeedEntry } from '@/lib/method-feed';
import {
  DEPARTURE_LABELS,
  departurePath,
  departuresPath,
  formatShortDate,
  incidentsPath,
  orgModelsPath,
  PRIMARY_CATEGORY_LABELS,
} from '@/lib/org-research';
import type { HomeOrg } from '@/lib/server/home-orgs';
import { cn } from '@/lib/utils';
import type { OrgDeparture } from '@openaudit/spec';
import { Bot, Newspaper, UserX } from 'lucide-react';

const DOT = (
  <span aria-hidden className="text-slate-300">
    ·
  </span>
);

/** A summary with the best 3 methods at its right (for a suite, by first places). With no summary,
 * the methods use the full width. */
export function MethodResults({ summary, top }: Pick<MethodFeedEntry, 'summary' | 'top'>) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] items-start gap-x-3">
      {summary && <p className={cn(CARD_ABOUT, 'line-clamp-none')}>{summary}</p>}
      {top.length > 0 && (
        <ol
          aria-label="Best methods"
          className={cn('flex flex-col gap-y-1.5 text-xs', summary ? 'col-start-2' : 'col-span-2')}
        >
          {top.map((t, i) => (
            <li key={t.href} className="flex min-w-0 items-center gap-x-1.5">
              <span aria-label={`Rank ${i + 1}`} className="text-sm leading-none">
                {MEDALS[i]}
              </span>
              <Link
                href={t.href}
                hover={false}
                className="relative truncate font-[450] text-slate-700 hover:text-sky-800 hover:underline"
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** An organization: its name, with its departures' photos at the right (each links to its person
 * on the departures page), then its incident count and its newest incidents, each under its
 * category and date. A story row has its own hover. `brief`: `OrgBrief` instead, short when
 * `compact`, narrow when `narrow`, with `scoreLabel` under the score. `onPick`: on a click of a
 * link. `nameClassName`: replaces the name's size. */
const COUNT = cn(CARD_HEAD, 'opacity-80 transition hover:opacity-100');

export function HomeOrgStory({
  org: o,
  brief,
  compact,
  narrow,
  scoreLabel,
  onPick,
  nameClassName,
}: {
  org: HomeOrg;
  brief?: boolean;
  compact?: boolean;
  narrow?: boolean;
  scoreLabel?: string;
  onPick?: () => void;
  nameClassName?: string;
}) {
  if (brief)
    return (
      <OrgBrief
        org={o}
        compact={compact}
        narrow={narrow}
        scoreLabel={scoreLabel}
        onPick={onPick}
        nameClassName={nameClassName}
      />
    );
  const slug = { slug: o.href.slice(1) };
  const incidents = o.incidents > 0 && (
    <Link href={o.href} hover={false} onClick={onPick} className={COUNT}>
      <Newspaper aria-hidden className="size-3" strokeWidth={2.5} />
      {o.incidents.toLocaleString('en-US')} {o.incidents === 1 ? 'Incident' : 'Incidents'}
    </Link>
  );
  const audits = o.audits > 0 && (
    <Link href={orgModelsPath(slug)} hover={false} onClick={onPick} className={cn(COUNT, 'ml-auto')}>
      <Bot aria-hidden className="size-3" strokeWidth={2.5} />
      {o.audits.toLocaleString('en-US')} {o.audits === 1 ? 'Model Audit' : 'Model Audits'}
    </Link>
  );
  return (
    <div className="flex flex-col gap-y-1">
      <div className="flex min-w-0 items-start justify-between gap-x-4">
        <Link href={o.href} hover={false} onClick={onPick} className={cn(CARD_NAME, 'shrink-0', nameClassName)}>
          {o.label}
        </Link>
        {o.leavers.length > 0 && (
          <Leavers leavers={o.leavers} hrefOf={(d) => departurePath(slug, d.name)} onPick={onPick} />
        )}
      </div>
      {(o.incidents > 0 || o.audits > 0) && (
        <div className="flex flex-col pt-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3">
            {incidents}
            {audits}
          </div>
          {o.incidents > 0 && (
            <ul className={cn(CARD_LIST, 'flex flex-col text-[11px] leading-4 text-slate-700')}>
              {o.recent.map((i) => (
                <li
                  key={i.key}
                  data-own-link={i.href ? '' : undefined}
                  className={cn('flex flex-col', storyRow(i.href), 'py-1')}
                >
                  <span className="flex gap-x-1.5 text-[10px]/4 font-semibold tracking-wide text-amber-600 uppercase">
                    {PRIMARY_CATEGORY_LABELS[i.category]}
                    {DOT}
                    <span className="font-medium text-slate-400">{formatShortDate(i.date)}</span>
                  </span>
                  <StoryLink href={i.href} row className="min-w-0">
                    {i.title}
                  </StoryLink>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const SCORE_LABEL = 'text-[9px]/3 font-semibold tracking-wide text-slate-400 uppercase';

/** An organization in a list of all organizations, by its safety commitments: its name, with its
 * total score at the right; the score of each category in a 2 by 2 grid; then a line of its
 * incidents, departures and audited models (not on phones). With no commitments, only the name and
 * the line. `compact`: no grid, no rule over the line, and a smaller score label. `narrow`: a narrower
 * score, and the line under the name, each count as its icon and number only. */
function OrgBrief({
  org: o,
  compact,
  narrow,
  scoreLabel = 'Safety Commitments',
  onPick,
  nameClassName,
}: {
  org: HomeOrg;
  compact?: boolean;
  narrow?: boolean;
  scoreLabel?: string;
  onPick?: () => void;
  nameClassName?: string;
}) {
  const slug = { slug: o.href.slice(1) };
  const c = o.commitments;
  const counts = [
    { n: o.incidents, one: 'Incident', many: 'Incidents', Icon: Newspaper, href: incidentsPath(slug) },
    { n: o.leavers.length, one: 'Departure', many: 'Departures', Icon: UserX, href: departuresPath(slug) },
    { n: o.audits, one: 'Model Audit', many: 'Model Audits', Icon: Bot, href: orgModelsPath(slug), wide: true },
  ];
  const line = (
    <div
      className={cn(
        'flex items-center gap-x-2',
        narrow ? 'gap-x-3' : 'justify-between',
        !compact && 'border-t border-slate-100 pt-2',
      )}
    >
      {counts.map(({ n, one, many, Icon, href, wide }) => {
        const text = `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
        return (
          <Link
            key={many}
            href={href}
            hover={false}
            onClick={onPick}
            aria-label={narrow ? text : undefined}
            title={narrow ? text : undefined}
            className={cn(COUNT, 'text-slate-400 hover:text-slate-600', wide && !narrow && 'max-sm:hidden')}
          >
            <Icon aria-hidden className="size-3" strokeWidth={2.5} />
            {narrow ? n.toLocaleString('en-US') : text}
          </Link>
        );
      })}
    </div>
  );
  const name = (
    <Link href={o.href} hover={false} onClick={onPick} className={cn(CARD_NAME, 'min-w-0 truncate', nameClassName)}>
      {o.label}
    </Link>
  );
  return (
    <div className="flex flex-col gap-y-2.5 py-0.5">
      <div className="flex min-w-0 items-start justify-between gap-x-3">
        {narrow ? (
          <div className="flex min-w-0 flex-col gap-y-1">
            {name}
            {line}
          </div>
        ) : (
          name
        )}
        {c && (
          <Link
            href={orgCommitmentsPath(slug)}
            hover={false}
            onClick={onPick}
            className={cn('relative z-10 flex shrink-0 flex-col items-center gap-y-0.5', narrow ? 'w-1/2' : 'w-2/3')}
          >
            <ScoreBar
              score={c}
              text={formatPoints(c.points)}
              label={scoreLabel}
              className="h-7 w-full text-[10px] font-bold text-slate-700"
            />
            <span className={cn(SCORE_LABEL, 'max-w-full truncate', compact && 'text-[8px]/3')}>{scoreLabel}</span>
          </Link>
        )}
      </div>
      {/* The browser can keep a response from before a deploy, with no categories. */}
      {!compact && c?.categories && (
        <Link
          href={orgCommitmentsPath(slug)}
          hover={false}
          onClick={onPick}
          className="relative z-10 grid grid-cols-2 gap-x-4 gap-y-2"
        >
          {CATEGORY_ORDER.map((k) => (
            <span key={k} className="flex min-w-0 flex-col items-center gap-y-0.5">
              <ScoreBar
                score={c.categories[k]}
                text={formatPoints(c.categories[k].points)}
                label={CATEGORY_LABELS[k]}
                className="h-4 w-full text-[10px]"
              />
              <span className={cn(SCORE_LABEL, 'max-w-full truncate')}>{CATEGORY_LABELS[k]}</span>
            </span>
          ))}
        </Link>
      )}
      {!narrow && line}
    </div>
  );
}

/** The departures' photos in one row at the right, the newest first. When they do not fit, each
 * place gets narrower, so that the photos overlap. Each shows its details on hover. `large`: 24 px
 * photos, not 18 px. `hrefOf`: a photo links to this page of its person. `onPick`: on a click of
 * a photo link. */
export function Leavers({
  leavers,
  large,
  hrefOf,
  onPick,
  className,
}: {
  leavers: OrgDeparture[];
  large?: boolean;
  hrefOf?: (d: OrgDeparture) => string;
  onPick?: () => void;
  className?: string;
}) {
  return (
    <ul aria-label="Departures" className={cn('mt-1 flex min-w-0 flex-1 justify-end gap-x-0.5', className)}>
      {leavers.map((d) => (
        <li
          key={d.name}
          className={cn('relative min-w-1 flex-[0_1_18px] last:shrink-0 hover:z-20', large && 'flex-[0_1_24px]')}
        >
          <HoverCard openDelay={100}>
            <HoverCardTrigger asChild>
              {hrefOf ? (
                <Link
                  href={hrefOf(d)}
                  hover={false}
                  onClick={onPick}
                  data-own-link
                  aria-label={`${d.name}: ${DEPARTURE_LABELS[d.kind]}`}
                  className={cn(PHOTO, large && 'size-6')}
                >
                  <Photo photo={d.image} name={d.name} className={cn(PHOTO_SIZE, large && 'size-6 text-[9px]')} />
                </Link>
              ) : (
                <span
                  data-own-link
                  tabIndex={0}
                  aria-label={`${d.name}: ${DEPARTURE_LABELS[d.kind]}`}
                  className={cn(PHOTO, 'cursor-default', large && 'size-6')}
                >
                  <Photo photo={d.image} name={d.name} className={cn(PHOTO_SIZE, large && 'size-6 text-[9px]')} />
                </span>
              )}
            </HoverCardTrigger>
            <HoverCardContent side="bottom" align="end" className="flex w-80 flex-col gap-y-1.5">
              <LeaverDetails who={d} />
            </HoverCardContent>
          </HoverCard>
        </li>
      ))}
    </ul>
  );
}

const PHOTO =
  'relative z-10 block size-[18px] rounded-full ring-2 ring-white outline-none hover:ring-sky-700 focus-visible:ring-sky-700';
const PHOTO_SIZE = 'size-[18px] text-[7px]';
