import { FLAGGED_CHATS_INFO, INSET_TITLE } from '@/components/box-title';
import { CardRunTable } from '@/components/catalog/card-run-table';
import { FlaggedChatFeed } from '@/components/catalog/flagged-chat-feed';
import { FlaggedTopicProvider } from '@/components/catalog/flagged-topic';
import type { SnippetView } from '@/components/catalog/openaudit-card-client';
import { InfoPopover } from '@/components/info-popover';
import { AutoRefresh } from '@/components/runs/auto-refresh';
import { MissingEvalRows, NewEvalButton, type QueueContext } from '@/components/runs/eval-queue';
import { NotRunEvals } from '@/components/runs/new-eval-context';
import { ACTIVE, routeText } from '@/components/runs/parts';
import { SubmitEvaluation } from '@/components/submit-buttons';
import { TURNSTILE_ENABLED, TURNSTILE_SITE_KEY } from '@/lib/env';
import { EVALUATION_RUNS_HASH, EVALUATIONS_HASH } from '@/lib/openaudit-card';
import { runnableEfforts } from '@/lib/runs/effort';
import { effortsFor, routeFor, type RouteModel } from '@/lib/runs/model-routes';
import { PICKABLE_SLOT_MODELS } from '@/lib/runs/requests';
import type { EvalPlace } from '@/lib/server/eval-ranks';
import { evalRows } from '@/lib/server/eval-table';
import type { LatestRun } from '@/lib/server/latest-runs';
import type { RunMode } from '@/lib/server/run-mode';
import type { RunListItem } from '@/lib/server/runs';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

/** The height of the topics column. Under `lg`, put it in a `Fold`. */
export const EVAL_COLUMN_HEIGHT = 'lg:max-xl:h-[32rem]';
/** The height of the flagged chats column. Its list draws only the rows in view, so it scrolls in
 * itself at all widths; on a phone, it is shorter than the screen. */
const FEED_COLUMN_HEIGHT = 'h-[min(32rem,70dvh)] lg:h-[32rem] xl:h-auto';

/** One column of the Evaluations section: a title bar with `action` at the right, then `children`,
 * which scroll. */
export function EvalColumn({
  title,
  info,
  action,
  children,
  id,
  className,
}: {
  title: string;
  info?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div
      id={id}
      className={cn(
        'flex min-h-0 scroll-mt-20 flex-col overflow-hidden rounded-md border border-slate-200 bg-white',
        className,
      )}
    >
      <div className="flex min-h-10 shrink-0 items-center gap-x-1 bg-slate-50 px-4 py-2">
        <h3 className={INSET_TITLE}>{title}</h3>
        {info && (
          <InfoPopover label={title} iconClassName="size-3">
            {info}
          </InfoPopover>
        )}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      <div className="relative min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

/** A model page's Evaluations: `topics` and the version's flagged chats in two columns (with no
 * `topics`, neither), then the results that the shown OpenAudit version used and the recommended
 * evals that it has no result of. `summary`: with `topics`, it is above them, two thirds wide;
 * the evals ("Evaluations") and the topics are side by side below it, and the flagged chats are at
 * the right, as high as the two rows. Not shown with no topics, no results and no missing evals;
 * still refreshes while runs are active. `places`: by eval id, the model's place among the models. */
export function ModelRunsView({
  runs,
  cardRuns,
  places,
  snippets = [],
  jlensNames,
  missing,
  action,
  topics,
  summary,
}: {
  runs: RunListItem[];
  cardRuns: LatestRun[];
  places?: Record<string, EvalPlace>;
  snippets?: SnippetView[];
  jlensNames?: string[];
  missing?: ReactNode;
  action?: ReactNode;
  topics?: ReactNode;
  summary?: ReactNode;
}) {
  const refresh = <AutoRefresh active={runs.some((r) => ACTIVE.includes(r.run.status))} />;
  if (!topics && !missing && !cardRuns.some((r) => r.run.status === 'succeeded'))
    return (
      <>
        {summary}
        {refresh}
      </>
    );
  const thirds = !!topics && !!summary;
  return (
    <>
      {!topics && summary}
      <FlaggedTopicProvider>
        <div
          id={EVALUATIONS_HASH}
          className={cn(
            'grid scroll-mt-20 grid-cols-1 gap-4',
            topics &&
              (thirds ? 'xl:grid-cols-3 xl:grid-rows-[auto_48rem]' : 'xl:grid-cols-2 xl:grid-rows-[48rem_auto]'),
          )}
        >
          {thirds && <div className="min-w-0 xl:col-span-2">{summary}</div>}
          {topics && (
            <div className={cn('grid min-h-0 min-w-0', thirds && 'xl:col-start-2 xl:row-start-2')}>{topics}</div>
          )}
          {topics && (
            // Its size does not count for the rows: it fills the summary's and the topics' rows.
            <div
              className={cn(
                'grid min-h-0 min-w-0',
                thirds && 'xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:[contain:size]',
              )}
            >
              {snippets.length ? (
                <FlaggedChatFeed snippets={snippets} jlensNames={jlensNames} className={FEED_COLUMN_HEIGHT} />
              ) : (
                <EvalColumn title="Flagged Chats" info={FLAGGED_CHATS_INFO} className={EVAL_COLUMN_HEIGHT}>
                  <div className="flex h-full flex-col items-center justify-center gap-2 px-4 py-10 text-center text-slate-400">
                    <p className="text-sm">No Flagged Chats Found</p>
                    {!runs.length && <p className="text-xs">No evaluations have been queued for this model yet.</p>}
                  </div>
                </EvalColumn>
              )}
            </div>
          )}
          <EvalColumn
            id={EVALUATION_RUNS_HASH}
            title={thirds ? 'Evaluations' : 'Evaluation Runs'}
            action={
              <div className="flex items-center gap-x-2">
                {action}
                <SubmitEvaluation tests="models" />
              </div>
            }
            className={cn(topics && (thirds ? 'xl:col-start-1 xl:row-start-2' : 'xl:col-span-2'))}
          >
            <CardRunTable
              runs={cardRuns}
              places={places}
              snippets={topics ? snippets : undefined}
              extra={missing}
              className="overflow-x-auto rounded-none border-0"
            />
          </EvalColumn>
        </div>
      </FlaggedTopicProvider>
      {refresh}
    </>
  );
}

/** The Evaluations section with the queue controls, when we have a route for the model. It waits for OpenRouter. */
export async function ModelRuns({
  model,
  modelId,
  runs,
  cardRuns,
  places,
  snippets,
  jlensNames,
  mode,
  signedIn,
  topics,
  summary,
}: {
  model: RouteModel & { displayName: string };
  modelId: string;
  runs: RunListItem[];
  cardRuns: LatestRun[];
  places?: Record<string, EvalPlace>;
  snippets: SnippetView[];
  jlensNames?: string[];
  mode: RunMode | null;
  signedIn: boolean;
  topics?: ReactNode;
  summary?: ReactNode;
}) {
  const route = await routeFor(model);
  const efforts = route && (await effortsFor(route));
  if (!efforts)
    return (
      <ModelRunsView
        runs={runs}
        cardRuns={cardRuns}
        places={places}
        snippets={snippets}
        jlensNames={jlensNames}
        topics={topics}
        summary={summary}
      />
    );
  const rows = (await evalRows(modelId, efforts.default, mode !== null)).filter(
    (r) => r.status === 'active' && !(r.rawReasoning && model.source === 'api'),
  );
  const used = new Set(cardRuns.filter((r) => r.run.status === 'succeeded').map((r) => r.run.evalId));
  const missing = rows.filter((r) => !used.has(r.evalId));
  const ctx: QueueContext | null = mode && {
    modelId,
    model: { displayName: model.displayName, name: model.name },
    effort: efforts.default,
    mode,
    signInPath: mode === 'request' && !signedIn ? `/signin?returnTo=${encodeURIComponent(`/${model.name}`)}` : null,
    turnstileSiteKey: TURNSTILE_ENABLED ? TURNSTILE_SITE_KEY : null,
  };
  const notRun = missing.map(({ evalId, slug, displayName, topics, state }) => ({
    evalId,
    slug,
    displayName,
    topics,
    state,
  }));
  return (
    <>
      <NotRunEvals evals={notRun} />
      <ModelRunsView
        runs={runs}
        cardRuns={cardRuns}
        places={places}
        snippets={snippets}
        jlensNames={jlensNames}
        topics={topics}
        summary={summary}
        missing={missing.length > 0 && <MissingEvalRows rows={missing} ctx={ctx} />}
        action={
          ctx && (
            <NewEvalButton
              ctx={ctx}
              efforts={runnableEfforts(efforts)}
              evals={rows}
              judges={PICKABLE_SLOT_MODELS}
              route={routeText(route)}
            />
          )
        }
      />
    </>
  );
}
