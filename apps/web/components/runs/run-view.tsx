import { Section, settingsText } from '@/components/catalog/parts';
import { PLACE_OF, PlaceText, STAT_LINK } from '@/components/catalog/place-text';
import { ReleaseWarning } from '@/components/catalog/release-warning';
import { ResultValue, SafetyBar, safeShare } from '@/components/catalog/score';
import { EvalAccessGate } from '@/components/eval-attestation';
import { EvalLink } from '@/components/eval-link';
import { FillHeight } from '@/components/fill-height';
import { InfoPopover } from '@/components/info-popover';
import Link from '@/components/link';
import { LocalTime } from '@/components/local-time';
import { Eyebrow, PageTitle } from '@/components/page';
import { AutoRefresh } from '@/components/runs/auto-refresh';
import { LogLink } from '@/components/runs/log-link';
import { ACTIVE, RunStatusBadge, progressText, routeText, runModelsText, thinkingText } from '@/components/runs/parts';
import { RescorePanel } from '@/components/runs/rescore-panel';
import { PickBox, PickButton, PickRow, SamplesPanel, SamplesProvider } from '@/components/runs/samples-view';
import { SortableTable } from '@/components/runs/sortable-table';
import { SwapScaleChart } from '@/components/runs/swap-scale-chart';
import { TermsNotice } from '@/components/runs/terms-notice';
import { ViewLink, type ViewMode } from '@/components/runs/view-link';
import { RUNS_ENABLED } from '@/lib/env';
import { parseId, toUrlId } from '@/lib/ids';
import { variantPath } from '@/lib/methods';
import { modelReleased } from '@/lib/release-dates';
import { barOf, headlineOf, mainScore, scoredResult } from '@/lib/runs/main-score';
import { byHeadlineThenName, tableResults } from '@/lib/runs/metric-order';
import { PICKABLE_SLOT_MODELS } from '@/lib/runs/requests';
import { canRun, slotLabel } from '@/lib/runs/routes';
import { modelPath } from '@/lib/server/catalog';
import { durationText, runSecondsLeft } from '@/lib/server/estimates';
import { evalStandings } from '@/lib/server/eval-ranks';
import { evalDetectors, evalShareDetectors, modelVariantResults } from '@/lib/server/methods';
import { swapCurves } from '@/lib/server/probe-swap';
import {
  ATTEMPTS_PER_PAGE,
  METHOD_LOCAL_ATTEMPTS,
  allAttemptsForRun,
  attemptsForRun,
  getRun,
  metricPicks,
  runPath,
  type AttemptFilter,
} from '@/lib/server/runs';
import { canSpend, getViewer } from '@/lib/server/viewer';
import { cn } from '@/lib/utils';
import type { EvalRun, FallbackUse, ServingRoute } from '@openaudit/spec';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

const FILTERS: AttemptFilter[] = ['all', 'passed', 'failed', 'blocked', 'error'];
const NO_COUNTS: Record<AttemptFilter, number> = { all: 0, passed: 0, failed: 0, blocked: 0, error: 0 };

/** A run, by its URL id. */
export async function loadRun(id: string) {
  const uuid = parseId(id);
  return uuid ? getRun(uuid) : null;
}

export type LoadedRun = NonNullable<Awaited<ReturnType<typeof loadRun>>>;

/** The page title of a run: "AgentHarm on GPT-6 Luna". */
export const runTitle = (found: LoadedRun) => `${found.eval.displayName} on ${found.model.displayName}`;

const EYEBROW: Record<EvalRun['origin'], string> = {
  run: 'Evaluation Run',
  import: 'Evaluation Run',
  rescore: 'Evaluation Run',
};
const canRescore = (run: EvalRun) => RUNS_ENABLED && run.status === 'succeeded' && !!run.log;

/** The value that most of `values` have. */
function mostCommon(values: string[]) {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
}

type Fact = [string, ReactNode];

function costText(p: NonNullable<EvalRun['provenance']>, rescore: boolean) {
  const byModel = Object.entries(p.byModel ?? {}).filter(([, m]) => m?.costUsd !== undefined);
  if (byModel.length === 0)
    return p.costUsd !== undefined ? `$${p.costUsd.toFixed(4)}, as the route reported it` : undefined;
  const parts = byModel.map(
    ([name, m]) =>
      `$${m!.costUsd!.toFixed(4)} ${name.replace(/^openrouter\//, '')}${m!.costEstimated ? ' (list price)' : ''}`,
  );
  return `$${(p.costUsd ?? 0).toFixed(4)}${rescore ? ' for the judges' : ''}: ${parts.join(', ')}`;
}
/** "auditor $0.41, target $0.08, judge $1.20 (62% of input from the cache)". */
function roleCostText(p: NonNullable<EvalRun['provenance']>) {
  const byRole = Object.entries(p.byRole ?? {}).filter(([, m]) => m?.costUsd !== undefined);
  if (byRole.length === 0) return undefined;
  return byRole
    .map(([role, m]) => {
      const t = m!.tokens;
      const cached =
        t?.input && t.cacheRead ? ` (${Math.round((100 * t.cacheRead) / t.input)}% of input from the cache)` : '';
      return `${role} $${m!.costUsd!.toFixed(4)}${cached}`;
    })
    .join(', ');
}
/** The slot's route, its fallbacks, and the calls that a fallback made. */
function slotText(id: string, route: ServingRoute | undefined, used: FallbackUse[] = []) {
  if (!route) return undefined;
  const calls = used
    .filter((f) => f.slot === id)
    .map((f) => `${f.model} made ${f.calls} call${f.calls > 1 ? 's' : ''}`);
  return [
    routeText(route),
    route.fallbacks?.length && `fallbacks: ${route.fallbacks.join(', ')}`,
    calls.length ? calls.join(', ') : route.fallbacks?.length && 'no fallback calls',
  ]
    .filter(Boolean)
    .join('; ');
}
const seconds = (a?: string, b?: string) => {
  if (!a || !b) return undefined;
  const s = Math.round((Date.parse(b) - Date.parse(a)) / 1000);
  return s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`;
};

/** A run: its results, judges, details and attempts. `id`: the run's URL id. `show` and `metric`
 * pick the attempts. */
export async function RunView({
  found,
  id,
  show,
  metric,
  mode,
}: {
  found: LoadedRun;
  id: string;
  show?: string;
  metric?: string;
  mode: ViewMode;
}) {
  const { run, eval: e, version, model, results, rescores, access, logRule } = found;
  const rescorable = canRescore(run) && canSpend(await getViewer());
  const slots = version.runner?.models ?? [];
  const scoring = slots.filter((s) => s.scoring);
  // Slot models have their own rows.
  const slotArgs = new Set(slots.map((s) => s.taskArg));
  const otherArgs = Object.fromEntries(
    Object.entries(run.provenance?.taskArgs ?? {}).filter(([k]) => !slotArgs.has(k)),
  );
  const { headline, headScore, headScoreDef } = headlineOf(version);
  const standing = (await evalStandings())[e.id]?.places[model.id];
  const place = standing?.href === runPath(run) ? standing : undefined;
  const filter = FILTERS.find((f) => f === show) ?? 'all';
  // The metrics in the table that pick samples, else all (a run with no results). A click or the
  // menu shows only those samples.
  const tableKeys = new Set(results.filter((r) => !r.metric.includes('@')).map((r) => r.metric));
  const picks = (
    await metricPicks(
      run.id,
      tableKeys.size ? version.metrics.filter((m) => tableKeys.has(m.key)) : version.metrics,
      version.scores,
    )
  ).filter((p) => p.count > 0);
  const pick = picks.find((p) => p.pick.metric === metric)?.pick;
  // A run with few attempts sends them all: the page filters them itself.
  const readable = { version, access, run };
  // A methods eval: each detector's call on each sample.
  const toolEval = !!version.methodSetup || e.facets.subjects.includes('method');
  const keep = [
    ...picks.flatMap((p) => (p.pick.kind === 'score' ? [p.pick.scoreKey] : [])),
    ...(headScore ? [headScore, 'score'] : []),
    ...(headScoreDef?.attemptName ? [headScoreDef.attemptName] : []),
    ...(toolEval ? version.scores.map((s) => s.attemptName ?? s.key) : []),
  ];
  const all = await allAttemptsForRun(run.id, readable, keep, toolEval ? METHOD_LOCAL_ATTEMPTS : undefined);
  const { attempts, total, counts } = all
    ? { attempts: all, total: all.length, counts: NO_COUNTS }
    : await attemptsForRun(run.id, filter, 1, readable, pick);
  const labelDetectors = toolEval ? await evalDetectors(version, attempts) : [];
  const detectors = toolEval && !labelDetectors.length ? await evalShareDetectors(version, attempts) : labelDetectors;
  // A methods eval with no results of its own: each variant's headline value on this model.
  const variantResults = toolEval && !results.length ? await modelVariantResults(version, e.slug, model.name) : null;
  const curves = variantResults?.rows.length ? await swapCurves(version, e.slug, model.name) : null;
  const mainColumn = mainScore(version, results, Object.keys(attempts[0]?.scores ?? {}));
  const scored = (r: (typeof results)[number]) => scoredResult(version, r);
  const metricName = new Map(version.metrics.map((m) => [m.key, m.displayName]));
  const order = byHeadlineThenName<string>(
    (metric) => metric === headline,
    (metric) => metricName.get(metric) ?? metric,
  );
  const shownResults = tableResults(results, new Set(metricName.keys())).sort((a, b) => order(a.metric, b.metric));
  const leftPanel = shownResults.length > 0 || !!variantResults?.rows.length;
  // The settings of most rows are the run's, as the details show them.
  const commonSettings = mostCommon(shownResults.map(settingsText));
  const pickOptions = picks
    .map((p) => ({
      ...p.pick,
      label: metricName.get(p.pick.metric) ?? p.pick.metric,
      count: p.count,
      bar: barOf(version, results, p.pick.metric),
    }))
    .sort((a, b) => order(a.metric, b.metric));
  // The metric's description, then the description of the score it aggregates.
  const scoreAbout = new Map(version.scores.map((s) => [s.key, s.description]));
  const metricAbout = new Map(
    version.metrics.map((m) => [
      m.key,
      [...new Set([m.description, m.score && scoreAbout.get(m.score)])].filter((t): t is string => !!t),
    ]),
  );
  // A panel judge's own result has the key `<metric>@<slot id>`.
  const byJudge = new Map(results.filter((r) => r.metric.includes('@')).map((r) => [r.metric, r]));
  const panel = scoring.filter((s) => results.some((r) => r.metric.endsWith(`@${s.id}`)));
  const p = run.provenance ?? {};
  const active = ACTIVE.includes(run.status);
  const left = active
    ? await runSecondsLeft({
        ...run,
        startedAt: found.startedAt,
        attemptCount: run.attemptCount ?? 0,
        sampleCount: run.sampleCount ?? null,
      })
    : null;

  const slotFacts = (judges: boolean) =>
    slots
      .filter((s) => !!s.scoring === judges)
      .map((s): Fact => [slotLabel(s), slotText(s.id, run.settings.models?.[s.id], p.fallbacks)]);
  const started = p.startedAt && (
    <>
      <LocalTime value={p.startedAt} />
      {seconds(p.startedAt, p.finishedAt) && ` · ${seconds(p.startedAt, p.finishedAt)}`}
    </>
  );
  const groups: [string, Fact[]][] = [
    [
      'Evaluation',
      [
        [
          'Eval Name',
          <EvalLink key="e" slug={e.slug} className="text-sky-800 hover:underline">
            {e.displayName} (version {version.version})
          </EvalLink>,
        ],
        [
          'Tested Model',
          <Link key="m" href={modelPath(model)} className="text-sky-800 hover:underline">
            {model.name}
          </Link>,
        ],
        [
          'Re-score of',
          run.sourceRunId && (
            <ViewLink
              key="src"
              to={{ run: toUrlId(run.sourceRunId) }}
              mode={mode}
              className="text-sky-800 hover:underline"
            >
              the source run (its outputs, scored again)
            </ViewLink>
          ),
        ],
        [
          'Settings',
          [thinkingText(run.settings), run.settings.limit ? `first ${run.settings.limit} samples` : 'all samples']
            .filter(Boolean)
            .join(', '),
        ],
        [
          'Task',
          p.task &&
            (Object.keys(otherArgs).length ? (
              <details key="t" className="group/args">
                <summary className="flex cursor-pointer list-none items-center gap-x-2 [&::-webkit-details-marker]:hidden">
                  {p.task}
                  <span className="text-sky-800 hover:underline">
                    <span className="group-open/args:hidden">Show Arguments</span>
                    <span className="hidden group-open/args:inline">Hide Arguments</span>
                  </span>
                </summary>
                <pre className="mt-1 overflow-x-auto rounded bg-slate-50 px-2 py-1.5 font-mono text-[11px]/4 whitespace-pre-wrap text-slate-700">
                  {JSON.stringify(otherArgs, null, 2)}
                </pre>
              </details>
            ) : (
              p.task
            )),
        ],
        [
          'Packages',
          p.packages &&
            Object.entries(p.packages)
              .map(([k, v]) => `${k} ${v}`)
              .join(', '),
        ],
      ],
    ],
    ['Model Serving', [['Route', routeText(run.route)], ['Served by', p.servedBy?.join(', ')], ...slotFacts(false)]],
    ['Judge Settings', slotFacts(true)],
    [
      'Usage and Cost',
      [
        [
          'Tokens',
          p.tokens &&
            `${(p.tokens.input ?? 0).toLocaleString('en-US')} in, ${(p.tokens.output ?? 0).toLocaleString('en-US')} out` +
              (p.tokens.reasoning ? ` (${p.tokens.reasoning.toLocaleString('en-US')} thinking)` : ''),
        ],
        ['Cost', costText(p, run.origin === 'rescore')],
        ['Cost by role', roleCostText(p)],
      ],
    ],
    [
      'Run',
      [
        ['Start and Duration', started],
        ['Log', run.log && <LogLink key="l" found={found} />],
      ],
    ],
  ];

  // The judges of this run and its rescores, and the rescore form. In the run details.
  const judgesPanel = scoring.length > 0 && run.origin !== 'rescore' && (rescores.length > 0 || rescorable) && (
    <Section title="Judges" className="mt-3">
      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-2 py-1.5 font-medium">Scored by</th>
              <th className="px-2 py-1.5 font-medium">Status</th>
              <th className="px-2 py-1.5 text-right font-medium">{metricName.get(headline ?? '') ?? 'Result'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[{ run, results }, ...rescores].map((r) => {
              const value = r.results.find((x) => x.metric === headline) ?? r.results[0];
              return (
                <tr key={r.run.id}>
                  <td className="px-2 py-1">
                    {r.run.id === run.id ? (
                      <span className="text-slate-800">{runModelsText(run) || 'task defaults'} (this run)</span>
                    ) : (
                      <ViewLink to={{ run: toUrlId(r.run.id) }} mode={mode} className="text-sky-800 hover:underline">
                        {runModelsText(r.run)}
                      </ViewLink>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    <RunStatusBadge status={r.run.status} />
                  </td>
                  <td className="px-2 py-1 text-right text-slate-800 tabular-nums">
                    {value ? <ResultValue result={value} round /> : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rescorable && canRun(version.runner) && (
        <RescorePanel
          runId={run.id}
          slots={scoring}
          base={Object.fromEntries(scoring.map((s) => [s.id, run.settings.models?.[s.id]?.model ?? s.default]))}
          judges={PICKABLE_SLOT_MODELS}
        />
      )}
    </Section>
  );

  // The headline metric shows in its own box above the table of the others.
  type Shown = (typeof shownResults)[number];
  const headResult = shownResults.find((r) => r.metric === headline);
  const otherResults = shownResults.filter((r) => r !== headResult);
  const nameOf = (r: Shown) => metricName.get(r.metric) ?? r.metric;
  // The metric's name (and key), with its help icon on the line of the last word (of a key: its
  // last character), and its settings when they are not the run's.
  // `large`: the headline, with its description below. With a place, its key is next to its value.
  const metricLabel = (r: Shown, large = false) => {
    const name = metricName.get(r.metric);
    const settings = settingsText(r);
    const [first, ...rest] = metricAbout.get(r.metric) ?? [];
    const shown = large ? first : undefined;
    const about = (shown ? rest : [first, ...rest]).filter((t): t is string => !!t);
    const withHelp = (text: string) => {
      if (!about.length) return text;
      const at = text.includes(' ') ? text.lastIndexOf(' ') + 1 : text.length - 1;
      return (
        <>
          {text.slice(0, at)}
          <span className="whitespace-nowrap">
            {text.slice(at)}
            <InfoPopover
              label={name ?? r.metric}
              iconClassName="size-3"
              triggerClassName="relative z-10 ml-1 align-[-2px]"
              contentClassName="flex flex-col gap-1.5 text-xs"
            >
              {about.map((t) => (
                <p key={t}>{t}</p>
              ))}
            </InfoPopover>
          </span>
        </>
      );
    };
    return (
      <>
        {name && name !== r.metric && large && place ? (
          <span className="block text-sm/5 font-semibold">{withHelp(name)}</span>
        ) : name && name !== r.metric ? (
          <>
            <span className={cn('block', large ? 'text-sm/5 font-semibold' : 'text-xs/4')}>{withHelp(name)}</span>
            <span className="block font-mono text-[10px] text-slate-400">{r.metric}</span>
          </>
        ) : (
          <span className={cn('block font-mono text-slate-700', large ? 'text-xs/4' : 'text-[10px]/4')}>
            {withHelp(r.metric)}
          </span>
        )}
        {shown && <span className="mt-0.5 block text-[11px]/4 font-normal text-slate-500">{shown}</span>}
        {settings && settings !== commonSettings && <span className="block text-xs text-slate-500">{settings}</span>}
      </>
    );
  };
  const resultValue = (r: Shown) => (
    <span
      title={r.stderr !== undefined ? `± ${+r.stderr.toFixed(2)} (standard error)` : undefined}
      className={cn(r.stderr !== undefined && 'relative z-10 cursor-help')}
    >
      <ResultValue result={r} round fixed={panel.length > 0} noStderr />
    </span>
  );
  // Each judge's value of the metric.
  const judgeValues = (r: Shown) =>
    panel.some((s) => byJudge.has(`${r.metric}@${s.id}`))
      ? panel.map((s) => {
          const own = byJudge.get(`${r.metric}@${s.id}`);
          return (
            <span
              key={s.id}
              title={`${slotLabel(s)}: ${run.settings.models?.[s.id]?.model ?? s.default}`}
              className="relative z-10 block cursor-help"
            >
              {own ? <ResultValue result={own} fixed noStderr /> : '—'}
            </span>
          );
        })
      : '—';

  const Grid = mode === 'page' ? FillHeight : 'div';
  return (
    <>
      <div className="relative">
        {/* From `sm`, the room at the right is for the details button and the run id below it. */}
        <div className="sm:min-h-12 sm:pr-56">
          {EYEBROW[run.origin] && <Eyebrow>{EYEBROW[run.origin]}</Eyebrow>}
          <PageTitle className="text-base sm:text-lg">
            <EvalLink slug={found.eval.slug} className="text-sky-800 hover:underline">
              {found.eval.displayName}
            </EvalLink>{' '}
            <span className="font-normal text-slate-400">on</span>{' '}
            <Link href={modelPath(found.model)} className="text-sky-800 hover:underline">
              {found.model.displayName}
            </Link>
            <ReleaseWarning
              model={modelReleased(found.model.facts)}
              evalDate={found.version.releasedDate}
              className="ml-1.5 align-[-1px] [&_svg]:size-4"
            />
          </PageTitle>
          {e.summary && <p className="mt-1 text-sm/normal text-slate-600">{e.summary}</p>}
          {run.status !== 'succeeded' && (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
              <RunStatusBadge status={run.status} />
              {active && <span className="tabular-nums">{progressText(run)} samples</span>}
              {active && <span>{left === null ? 'No estimate yet' : `${durationText(left)} left`}</span>}
            </p>
          )}
        </div>
        <p className="mt-1 text-[11px] text-slate-500 sm:absolute sm:top-8 sm:right-0 sm:mt-0">
          {p.note && (
            <>
              <InfoPopover label="Caveat" trigger="Caveat" contentClassName="text-xs">
                {p.note}
              </InfoPopover>
              <span className="mx-1.5 text-slate-300" aria-hidden>
                ·
              </span>
            </>
          )}
          Run ID: <span className="font-mono">{id}</span>
        </p>
        <details className="group/details">
          <summary className="mt-2 inline-flex cursor-pointer list-none items-center gap-x-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-xs transition-colors hover:bg-slate-100 hover:text-slate-900 sm:absolute sm:top-0 sm:right-0 sm:mt-0 [&::-webkit-details-marker]:hidden">
            <span className="group-open/details:hidden">Show Run Details</span>
            <span className="hidden group-open/details:inline">Hide Run Details</span>
            <ChevronDown className="size-3.5 transition-transform group-open/details:rotate-180" aria-hidden />
          </summary>
          <Section title="Details" titleClassName="sr-only" className="mt-3">
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 @3xl:grid-cols-2">
              {groups.map(([title, facts]) => {
                const shown = facts.filter(([, v]) => v);
                if (!shown.length) return null;
                return (
                  <div key={title} className="flex flex-col gap-y-1.5">
                    <h3 className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{title}</h3>
                    <dl className="flex flex-col gap-y-1 pl-3 text-xs/4">
                      {shown.map(([k, v]) => (
                        <div key={k} className="flex gap-x-3">
                          <dt className="w-28 shrink-0 text-slate-500">{k}</dt>
                          <dd className="min-w-0 wrap-anywhere text-slate-800">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                );
              })}
            </div>
          </Section>
          {judgesPanel}
        </details>
      </div>
      {mode === 'page' && <AutoRefresh active={active} />}

      {run.status === 'requested' && (
        <p className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
          This run waits for approval. We review each request before we run it, and the owner gets an email when it
          starts.
        </p>
      )}

      {run.error && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 font-mono text-xs break-words text-rose-800">
          {run.error}
        </p>
      )}

      {/* On a wide page, the row fills the window below it, and each column scrolls. A server
          render (a big run's new filter) gives new state. */}
      <SamplesProvider
        key={`${filter}/${pick?.metric ?? ''}`}
        id={id}
        mode={mode}
        complete={!!all}
        initial={{ filter, metric: pick?.metric }}
        picks={pickOptions}
      >
        <Grid
          className={cn(
            'grid grid-cols-1 gap-5',
            leftPanel && '@5xl:grid-cols-3',
            mode === 'page' && '@5xl:h-[var(--fill-h,40rem)]',
          )}
        >
          {variantResults && variantResults.rows.length > 0 && (
            <Section
              title="Results"
              titleClassName="sr-only"
              className="min-h-0 gap-0 self-start overflow-hidden p-0 sm:p-0"
            >
              <div className="px-3 py-2.5 text-slate-800">
                <p className="mb-1 text-[10px] font-bold tracking-wide text-slate-400 uppercase">Headline Metric</p>
                <p className="text-sm font-semibold">{variantResults.metric.displayName}</p>
                <p className="font-mono text-[10px] text-slate-400">{variantResults.metric.key}</p>
                {variantResults.metric.description && (
                  <p className="mt-1 text-[11px] text-slate-600">{variantResults.metric.description}</p>
                )}
              </div>
              <div className="min-h-0 overflow-auto border-t border-slate-200">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">Variant</th>
                      <th className="px-3 py-1.5 text-center font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody className="isolate divide-y divide-slate-100">
                    {variantResults.rows.map(({ variant: v, value }) => (
                      <tr key={v.id}>
                        <td className="px-3 py-1.5">
                          <Link href={variantPath(v.method.slug, v.slug)} className="text-sky-800 hover:underline">
                            {v.displayName}
                          </Link>
                          {v.baseline && <span className="ml-1 text-slate-400">(baseline)</span>}
                          {v.author && <span className="block text-[10px] text-slate-400">{v.author}</span>}
                        </td>
                        <td className="px-3 py-1.5 text-center font-mono text-[11px] font-medium text-slate-800 tabular-nums">
                          {value.toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {curves && (
                <div className="border-t border-slate-200 px-3 py-2.5">
                  <p className="mb-1 text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                    Swap Top-1 by Scale
                  </p>
                  <SwapScaleChart data={curves} />
                </div>
              )}
            </Section>
          )}
          {shownResults.length > 0 && (
            <div className="flex min-h-0 flex-col gap-3">
              {headResult && (
                <Section title="Headline Metric" titleClassName="sr-only" className="shrink-0 gap-0 p-0 sm:p-0">
                  <PickBox metric={headResult.metric} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                    <PickButton metric={headResult.metric} label={nameOf(headResult)} />
                    <div className="min-w-0 flex-1 text-slate-800">
                      <p className="mb-1 text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                        Headline Metric
                      </p>
                      {metricLabel(headResult, true)}
                    </div>
                    <div className="shrink-0 text-center font-mono text-lg/6 font-semibold whitespace-nowrap text-slate-800 tabular-nums">
                      {place ? (
                        <>
                          <Link href={`/evaluations/${e.slug}`} className={cn('block px-1 font-normal', STAT_LINK)}>
                            <PlaceText place={place} className="block text-sm/5" ofClassName={PLACE_OF} />
                          </Link>
                          <span className="block text-[10px]/4 font-normal">
                            <span className="font-sans text-slate-400">{headResult.metric}</span>{' '}
                            <span className="text-slate-500">{resultValue(headResult)}</span>
                          </span>
                        </>
                      ) : (
                        <>
                          {resultValue(headResult)}
                          {safeShare(scored(headResult)) !== undefined && (
                            <SafetyBar result={scored(headResult)} className="mx-auto mt-1 h-2 w-14" />
                          )}
                        </>
                      )}
                      {panel.length > 0 && (
                        <div className="mt-1 text-[9px]/3 font-normal text-slate-600">{judgeValues(headResult)}</div>
                      )}
                    </div>
                  </PickBox>
                </Section>
              )}
              {otherResults.length > 0 && (
                <Section
                  title="Results"
                  titleClassName="sr-only"
                  className="min-h-0 flex-1 gap-0 overflow-hidden p-0 sm:p-0"
                >
                  <div className="isolate min-h-0 flex-1 overflow-auto lg:overscroll-contain">
                    <SortableTable
                      nameLabel={headResult ? 'Other Metrics' : 'Metric'}
                      valueLabel={panel.length > 0 ? 'Mean' : 'Result'}
                      judges={panel.length > 0}
                      headClassName="z-20"
                      rows={otherResults.map((r) => ({
                        key: r.id,
                        name: nameOf(r),
                        value: typeof r.value === 'number' ? r.value : null,
                        node: (
                          <PickRow key={r.id} metric={r.metric}>
                            <td className="px-3 py-1.5 wrap-anywhere text-slate-800">
                              <PickButton metric={r.metric} label={nameOf(r)} />
                              {metricLabel(r)}
                            </td>
                            <td className="px-3 py-1.5 text-center font-mono text-[11px]/4 font-medium whitespace-nowrap text-slate-800 tabular-nums">
                              {resultValue(r)}
                              {safeShare(scored(r)) !== undefined && (
                                <SafetyBar result={scored(r)} className="mx-auto mt-0.5 h-1.5 w-10" />
                              )}
                            </td>
                            {panel.length > 0 && (
                              <td className="px-3 py-1.5 text-center font-mono text-[9px]/3 whitespace-nowrap text-slate-600 tabular-nums">
                                {judgeValues(r)}
                              </td>
                            )}
                          </PickRow>
                        ),
                      }))}
                    />
                  </div>
                </Section>
              )}
            </div>
          )}

          <Section
            title="Samples"
            titleClassName="sr-only"
            id={mode === 'page' ? 'samples' : undefined}
            className={cn('min-h-0 scroll-mt-10 gap-0 overflow-hidden p-0 sm:p-0', leftPanel && '@5xl:col-span-2')}
          >
            <SamplesPanel
              id={id}
              cleared={access.cleared}
              complete={!!all}
              attempts={attempts}
              mainScore={mainColumn}
              total={total}
              counts={counts}
              perPage={ATTEMPTS_PER_PAGE}
              toolEval={toolEval}
              detectors={detectors}
              notices={
                <>
                  <TermsNotice version={version} access={access} rule={logRule} returnTo={runPath(run)} />
                  {!access.cleared && <EvalAccessGate />}
                </>
              }
              empty={active ? 'Samples show when the run is done.' : 'No samples.'}
              footer={
                <p
                  key="footer"
                  className="sticky bottom-0 z-10 mt-auto flex flex-wrap items-baseline justify-between gap-x-3 border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600"
                >
                  These are evaluation samples. Do not use them to train models.
                  {e.canary && <span className="font-mono text-[10px] break-all text-slate-400">{e.canary}</span>}
                </p>
              }
            />
          </Section>
        </Grid>
      </SamplesProvider>
    </>
  );
}
