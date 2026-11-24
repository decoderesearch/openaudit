import { HumanReviewForm } from '@/components/deploymeter/human-review-form';
import { JudgePrompt } from '@/components/deploymeter/judge-prompt';
import { PanelReviewButtons } from '@/components/deploymeter/panel-review-buttons';
import { JudgeLink, ReviewCard } from '@/components/deploymeter/review-card';
import { ScoreRing, VerdictChip } from '@/components/deploymeter/score-ring';
import { VerdictBar } from '@/components/deploymeter/verdict-bar';
import { VoteHover } from '@/components/deploymeter/vote-hover';
import { InfoPopover } from '@/components/info-popover';
import Link from '@/components/link';
import { Section } from '@/components/section';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  ABSTAIN,
  abstains,
  counts,
  HUMAN_REVIEWS_ENABLED,
  MIN_HUMANS,
  verdictOf,
  VERDICTS,
  voteStyle,
  type DeployVotes,
  type Vote,
} from '@/lib/deploymeter';
import { SIGN_IN_ENABLED } from '@/lib/env';
import type { DeploymeterView, DeployReviewView } from '@/lib/server/deploymeter';
import { cn } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

const ABOUT = (
  <p>
    A panel of AI judges reads this model&apos;s evaluation results and answers one question: should this model be
    widely deployed, based on its safety evaluations and capabilities? Each judge votes Approve, Limited or Disapprove.
    A high score does not mean a safe model.{' '}
    <Link href="/faqs#percentage" className="text-sky-800 hover:underline">
      How it works
    </Link>
  </p>
);

/** The Deploymeter at the top of a model's OpenAudit: the score, the AI panel and the human
 * reviews. `admin`: draft notices and the publish buttons. `column`: a column of the executive
 * summary, not a section. */
export function Deploymeter({
  view,
  model,
  signedIn,
  admin,
  column,
}: {
  view: DeploymeterView | null;
  /** `path`: the model page. */
  model: { id: string; displayName: string; path: string };
  signedIn: boolean;
  admin: boolean;
  column?: boolean;
}) {
  const panel = view?.panel ?? null;
  const reviews = view?.reviews ?? [];
  const mine = view?.humans.find((h) => h.mine);
  const humans = view?.humans ?? [];
  const draft = panel && panel.status === 'draft';
  const buttons =
    draft && admin ? (
      <PanelReviewButtons panelId={panel.id} label={`${model.displayName} panel ${panel.number}`} />
    ) : undefined;
  const meter = view?.meter ?? null;
  const score = (
    <span
      title={column ? undefined : meter === null ? 'No score' : `${meter} of 100`}
      className={cn(
        'text-[2.625rem]/none font-extrabold tabular-nums',
        meter === null ? 'text-slate-300' : VERDICTS[verdictOf(meter)].score,
      )}
    >
      {meter === null ? '–' : `${meter}%`}
    </span>
  );
  const counted = !!view && view.counted > 0;
  const body = (
    <>
      {draft && (
        <p className="rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
          Draft: only admins see panel {panel.number}.{' '}
          {view?.publishedNumber ? `The public sees panel ${view.publishedNumber}.` : 'The public sees no panel.'}
        </p>
      )}
      <div className={cn('pb-1', column ? 'grid grid-cols-3 items-start' : 'flex items-center gap-x-4 pt-2.5')}>
        {column ? (
          // One hover for the label, the score and the bar, so the bar has no hover of its own.
          <InfoPopover
            label="Deploymeter"
            trigger={
              <>
                <span className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Deploymeter</span>
                {score}
                {counted && <VerdictBar votes={voteCounts(reviews)} className="w-[80%]" />}
              </>
            }
            triggerClassName="flex shrink-0 flex-col items-center gap-y-1 text-inherit no-underline hover:text-inherit"
            contentClassName="w-72 text-xs"
          >
            {ABOUT}
          </InfoPopover>
        ) : (
          <div className="flex shrink-0 flex-col items-center gap-y-1">
            {score}
            {counted && <VoteBar reviews={reviews} />}
          </div>
        )}
        <div
          className={cn(
            'flex min-w-0 flex-col gap-y-1.5 text-xs text-slate-700',
            column ? 'col-span-2 items-center text-center' : 'items-start',
          )}
        >
          <div className={cn('flex flex-wrap items-center justify-center gap-2', column && 'w-full')}>
            {meter !== null ? (
              <VerdictChip
                score={meter}
                className={cn(
                  'border-0 px-3 py-1 text-[13px]/tight',
                  column && 'flex-1 text-center text-[11px]/tight font-semibold tracking-wide uppercase',
                )}
              />
            ) : (
              <span className="text-slate-500">No score yet</span>
            )}
            {column && buttons}
          </div>
          {counted && <Votes reviews={reviews} className={column ? 'w-full' : 'w-full max-w-xs'} />}
          {!panel && <p className="text-slate-500">No panel has reviewed this model yet.</p>}
        </div>
      </div>
      <div className="flex flex-col items-start gap-y-1.5 text-xs text-slate-700">
        {panel?.summary && <p>{panel.summary.summary}</p>}
        {reviews.length > 0 && (
          <div className="-mt-1 flex w-full justify-end">
            <ReviewsDialog
              modelName={model.displayName}
              reviews={reviews}
              prompt={
                panel?.prompts?.judge && (
                  <JudgePrompt
                    version={panel.promptVersion}
                    judge={panel.prompts.judge}
                    guess={panel.prompts.guess ?? null}
                    className="text-xs font-medium"
                    inModal
                  />
                )
              }
            />
          </div>
        )}
      </div>

      {HUMAN_REVIEWS_ENABLED && (
        <Part
          title="Human Reviews"
          score={view?.human ?? null}
          line={
            humans.length === 0
              ? 'No reviews yet.'
              : humans.length < MIN_HUMANS
                ? `${humans.length} ${humans.length === 1 ? 'review' : 'reviews'}. The score shows from ${MIN_HUMANS}.`
                : `${humans.length} reviews.`
          }
        >
          {SIGN_IN_ENABLED &&
            (signedIn ? (
              <HumanReviewForm
                modelId={model.id}
                modelName={model.displayName}
                mine={mine && { score: mine.score, text: mine.text }}
              />
            ) : (
              <Link
                href={`/signin?returnTo=${encodeURIComponent(`${model.path}#deploymeter`)}`}
                className="text-xs font-medium text-sky-800 hover:underline"
              >
                Sign in to write a review
              </Link>
            ))}
        </Part>
      )}

      {humans.length > 0 && (
        <More open={`Read the ${humans.length} human reviews`} close="Hide the human reviews">
          <ul className={cn('mt-2 grid grid-cols-1 gap-2', !column && 'lg:grid-cols-2')}>
            {humans.map((h) => (
              <li key={h.id} className="flex gap-x-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                <ScoreRing score={h.score} size="sm" />
                <div className="flex min-w-0 flex-col gap-y-0.5 text-xs">
                  <span className="font-medium text-slate-800">
                    {h.name}
                    {h.affiliation && <span className="font-normal text-slate-500"> · {h.affiliation}</span>}
                  </span>
                  <p className="whitespace-pre-line text-slate-700">{h.text}</p>
                  <span className="text-[11px] text-slate-400">
                    {h.cardVersion ? `On OpenAudit V${h.cardVersion} · ` : ''}
                    {h.updatedAt.toISOString().slice(0, 10)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </More>
      )}
    </>
  );
  if (column)
    return (
      <div id="deploymeter" className="flex scroll-mt-20 flex-col gap-y-3 self-start px-2 pt-2">
        {body}
      </div>
    );
  return (
    <Section id="deploymeter" title="Deploymeter" info={ABOUT} actions={buttons}>
      {body}
    </Section>
  );
}

/** `none`: the hover text when no judge gives the vote. */
const VOTES: { verdict: Vote; label: string; none: string }[] = [
  { verdict: 'reject', label: VERDICTS.reject.vote, none: 'No AI judges disapproved of deploying this model.' },
  {
    verdict: 'limits',
    label: VERDICTS.limits.vote,
    none: 'No AI judges recommended limited deployment for this model.',
  },
  {
    verdict: 'approve',
    label: VERDICTS.approve.vote,
    none: 'No AI judges recommended deploying this model without elevated safeguards.',
  },
  { verdict: 'abstain', label: ABSTAIN.vote, none: 'No AI judges abstained.' },
];

type VoteEntry = (typeof VOTES)[number];

const reviewVote = (r: DeployReviewView): Vote | null =>
  r.abstain ? 'abstain' : r.score === null ? null : verdictOf(r.score);

/** The votes to show: the three verdicts, and `abstain` when a judge abstains. */
const shownVotes = (reviews: DeployReviewView[]) =>
  VOTES.filter((v) => v.verdict !== 'abstain' || reviews.some((r) => r.abstain));

/** The reviews with a vote: `group`, the counted or abstaining ones (`counts`, `abstains`); `shown`,
 * those, then the ones that do not count (same developer or self-review). */
function voteGroup(reviews: DeployReviewView[], v: VoteEntry) {
  const voted = reviews.filter((r) => reviewVote(r) === v.verdict);
  const independent = (r: DeployReviewView) => counts(r) || abstains(r);
  const group = voted.filter(independent);
  return { group, shown: [...group, ...voted.filter((r) => !independent(r))] };
}

/** The hover of a vote's judges, with their reviews. */
function VoteCard({ reviews, v, trigger }: { reviews: DeployReviewView[]; v: VoteEntry; trigger: ReactElement }) {
  const { group, shown } = voteGroup(reviews, v);
  return (
    <VoteHover
      trigger={trigger}
      className={cn(
        'flex max-h-[min(32rem,var(--radix-hover-card-content-available-height))] flex-col gap-y-2 overflow-y-auto overscroll-contain text-left',
        shown.length ? 'w-[30rem] px-5 py-2' : 'w-72 px-5 py-2',
      )}
    >
      <p className="sticky -top-2 z-20 -mx-5 -mt-2 bg-slate-50 px-5 py-2 text-center text-[11px] font-semibold text-slate-600">
        AI Judge Verdict Summaries - {v.label}
      </p>
      {!group.length && <p className="px-3 py-1 text-center text-slate-500">{v.none}</p>}
      <ul className="flex flex-col divide-y divide-slate-100 empty:hidden">
        {shown.map((r) => (
          <ReviewCard key={r.id} review={r} title={<JudgeLink judge={r.judge} name={r.judgeName} />} />
        ))}
      </ul>
    </VoteHover>
  );
}

/** The number of counted judges for each vote. */
const voteCounts = (reviews: DeployReviewView[]) =>
  Object.fromEntries(VOTES.map((v) => [v.verdict, voteGroup(reviews, v).group.length])) as DeployVotes;

/** The bar of the counted judges. Each part has the same hover as its count. */
function VoteBar({ reviews }: { reviews: DeployReviewView[] }) {
  return (
    <VerdictBar
      votes={voteCounts(reviews)}
      className="w-[80%]"
      part={(verdict, n, bar) => {
        const v = VOTES.find((x) => x.verdict === verdict)!;
        return (
          <VoteCard
            reviews={reviews}
            v={v}
            trigger={
              <button
                type="button"
                aria-label={`${n} ${v.label}: show the reviews`}
                className={cn('cursor-pointer', bar.className)}
                style={bar.style}
              />
            }
          />
        );
      }}
    />
  );
}

/** The number of counted judges for each of the three verdicts (no abstain, so it fits on mobile).
 * A hover shows their reviews. */
function Votes({ reviews, className }: { reviews: DeployReviewView[]; className?: string }) {
  return (
    <div className={cn('grid grid-cols-3', className)}>
      {VOTES.filter((v) => v.verdict !== 'abstain').map((v) => {
        const { group } = voteGroup(reviews, v);
        const cell = (
          <>
            <span
              className={cn(
                'text-lg/tight font-bold tabular-nums',
                group.length ? voteStyle(v.verdict).score : 'text-slate-300',
              )}
            >
              {group.length}
            </span>
            <span className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">{v.label}</span>
          </>
        );
        return (
          <VoteCard
            key={v.verdict}
            reviews={reviews}
            v={v}
            trigger={
              <button
                type="button"
                aria-label={`${group.length} ${v.label}: show the reviews`}
                className="flex cursor-pointer flex-col items-center rounded-md py-1 hover:bg-slate-50"
              >
                {cell}
              </button>
            }
          />
        );
      })}
    </div>
  );
}

/** A link that opens all AI reviews in a modal, in one column for each verdict. The counts
 * are of the counted reviews. `prompt`: the judge prompt button. */
function ReviewsDialog({
  modelName,
  reviews,
  prompt,
}: {
  modelName: string;
  reviews: DeployReviewView[];
  prompt?: ReactNode;
}) {
  const unscored = reviews.filter((r) => r.score === null && !r.abstain);
  const votes = shownVotes(reviews);
  return (
    <Dialog>
      <DialogTrigger className="flex items-center gap-x-1 text-[10px] font-bold tracking-wide text-slate-400 uppercase hover:text-slate-900 hover:underline">
        All Reviews
        <ArrowRight className="size-3" aria-hidden />
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-y-4 bg-white sm:max-w-6xl">
        <div className="flex items-center gap-x-4 pr-8">
          <DialogTitle className="text-base">AI Judge Reviews of Deploying {modelName}</DialogTitle>
          {prompt && <div className="ml-auto">{prompt}</div>}
        </div>
        <DialogDescription className="sr-only">
          The review of each AI judge, in one column for each verdict.
        </DialogDescription>
        <div className="-mx-2 flex min-h-0 flex-1 flex-col gap-y-4 overflow-y-auto overscroll-contain px-2">
          <div
            className={cn('grid grid-cols-1 gap-x-6 gap-y-4', votes.length === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3')}
          >
            {votes.map((v) => {
              const { group: independent, shown: group } = voteGroup(reviews, v);
              const n = independent.length;
              return (
                <div key={v.verdict} className="flex min-w-0 flex-col gap-y-2">
                  <p className="flex items-baseline justify-center gap-x-1.5 border-b border-slate-100 pb-2">
                    <span
                      className={cn(
                        'text-lg/none font-bold tabular-nums',
                        n ? voteStyle(v.verdict).score : 'text-slate-300',
                      )}
                    >
                      {n}
                    </span>
                    <span className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">{v.label}</span>
                  </p>
                  {group.length ? (
                    <ul className="flex flex-col divide-y divide-slate-100">
                      {group.map((r) => (
                        <ReviewCard key={r.id} review={r} title={<JudgeLink judge={r.judge} name={r.judgeName} />} />
                      ))}
                    </ul>
                  ) : (
                    <p className="px-3 py-1 text-center text-xs text-slate-500">{v.none}</p>
                  )}
                </div>
              );
            })}
          </div>
          {unscored.length > 0 && (
            <ul className="flex flex-col divide-y divide-slate-100 border-t border-slate-100 pt-3">
              {unscored.map((r) => (
                <ReviewCard key={r.id} review={r} title={<JudgeLink judge={r.judge} name={r.judgeName} />} />
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** A link that shows `children` on a click. */
function More({ open, close, children }: { open: string; close: string; children: ReactNode }) {
  return (
    <details className="group/more w-full">
      <summary className="w-fit cursor-pointer list-none text-xs font-medium text-sky-800 hover:underline">
        <span className="group-open/more:hidden">{open}</span>
        <span className="hidden group-open/more:inline">{close}</span>
      </summary>
      {children}
    </details>
  );
}

function Part({
  title,
  score,
  line,
  children,
}: {
  title: string;
  score: number | null;
  line: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-y-2">
      <div className="flex items-center gap-x-2.5">
        <ScoreRing score={score} />
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold text-slate-800">{title}</span>
          <span className="text-xs text-slate-500">{line}</span>
        </div>
      </div>
      {children}
    </div>
  );
}
