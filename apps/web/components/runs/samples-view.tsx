'use client';

import { findAttempts, moreAttempts, notScoredOf } from '@/app/runs/actions';
import { SafetyBar, safeShare } from '@/components/catalog/score';
import { InfoPopover } from '@/components/info-popover';
import { PanelLink, plainClick, showInView } from '@/components/pdf-viewer';
import { CodeText } from '@/components/runs/code-text';
import { MetricPicker } from '@/components/runs/metric-picker';
import { PassMark } from '@/components/runs/pass-mark';
import { Call } from '@/components/runs/sample-attempt-table';
import { type ViewMode } from '@/components/runs/view-link';
import { FlagLabel } from '@/components/snippet-summary';
import { SegmentedToggle, type Toggle } from '@/components/ui/segmented-toggle';
import { panelPath, runPanelFromParams, withPanel, type RunPanel } from '@/lib/run-panel';
import { answerColumn, onScale, pickMin, type AnswerColumn } from '@/lib/runs/attempt-scores';
import { callsOf, type DetectorDef } from '@/lib/runs/detectors';
import { flagRank, harmOf, sampleBar, scoreNumber, scoreText, type Bar, type ScoreColumn } from '@/lib/runs/main-score';
import type { AttemptFilter, MetricPick, ShownAttempt } from '@/lib/server/runs';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

// A run's samples, and the metric rows that pick them. With all of the run's attempts (`complete`),
// the filter and the metric change here, with no server render; on a run page the URL changes too.
// Else each change loads the page again. The table shows more rows as it scrolls.

const FILTERS: { key: AttemptFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'passed', label: 'Passed' },
  { key: 'failed', label: 'Failed' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'error', label: 'Errors' },
];

/** A detector's filter: only the samples where its call is right (`pass`), or wrong. */
type Verdict = 'pass' | 'fail';
const VERDICTS: Toggle<Verdict>[] = [
  { value: 'pass', label: 'Pass' },
  { value: 'fail', label: 'Fail' },
];

export type SamplesState = { filter: AttemptFilter; metric?: string };
export type PickOption = MetricPick & { label: string; count: number; bar?: Bar };
type Samples = { state: SamplesState; go: (patch: Partial<SamplesState>) => void; picks: PickOption[] };

const SamplesContext = createContext<Samples | null>(null);

export function SamplesProvider({
  id,
  mode,
  complete,
  initial,
  picks,
  children,
}: {
  id: string;
  mode: ViewMode;
  complete: boolean;
  initial: SamplesState;
  picks: PickOption[];
  children: ReactNode;
}) {
  const [state, setState] = useState(initial);
  const router = useRouter();
  const pathname = usePathname();
  const go = (patch: Partial<SamplesState>) => {
    const next = { ...state, ...patch };
    const to: RunPanel = { run: id, show: next.filter, metric: next.metric };
    if (complete) {
      setState(next);
      // The panel loads again when its URL changes: there the state stays here only.
      if (mode === 'page') window.history.replaceState(null, '', pageUrl(to));
    } else {
      const url = mode === 'page' ? pageUrl(to) : `${pathname}?${withPanel(new URLSearchParams(location.search), to)}`;
      router.push(url, { scroll: false });
    }
  };
  return <SamplesContext.Provider value={{ state, go, picks }}>{children}</SamplesContext.Provider>;
}

const useSamples = () => useContext(SamplesContext)!;

/** The run page's URL for `to`. Other keys stay, for example the open sample's. */
function pageUrl(to: RunPanel) {
  const q = new URLSearchParams(location.search);
  for (const k of ['show', 'metric', 'page']) q.delete(k);
  new URL(panelPath(to), location.origin).searchParams.forEach((v, k) => q.set(k, v));
  return `${location.pathname}${q.size ? `?${q}` : ''}`;
}

/** On a narrow page the samples are below the results: show them. */
function showSamples() {
  const el = document.getElementById('samples');
  const top = el?.getBoundingClientRect().top;
  if (el && top !== undefined && (top < 0 || top > window.innerHeight * 0.6))
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** A results row. A metric that picks samples gets a hover and, when picked, a highlight. */
export function PickRow({ metric, children }: { metric: string; children: ReactNode }) {
  const { state, picks } = useSamples();
  const on = state.metric === metric;
  return (
    <tr
      className={cn(
        picks.some((p) => p.metric === metric) && 'relative hover:bg-sky-50',
        on && 'bg-sky-50 hover:bg-sky-100',
      )}
    >
      {children}
    </tr>
  );
}

/** A box for one metric, marked as `PickRow` marks a row. */
export function PickBox({ metric, className, children }: { metric: string; className?: string; children: ReactNode }) {
  const { state, picks } = useSamples();
  const on = state.metric === metric;
  return (
    <div
      className={cn(
        'relative',
        picks.some((p) => p.metric === metric) && 'hover:bg-sky-50',
        on && 'bg-sky-50 hover:bg-sky-100',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The row's click area: picks the metric, or a second click shows all samples. */
export function PickButton({ metric, label }: { metric: string; label: string }) {
  const { state, go, picks } = useSamples();
  if (!picks.some((p) => p.metric === metric)) return null;
  const on = state.metric === metric;
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? 'Show all samples' : `Show the samples of ${label}`}
      onClick={() => {
        go({ metric: on ? undefined : metric });
        showSamples();
      }}
      className="absolute inset-0 cursor-pointer"
    />
  );
}

const matches = (a: ShownAttempt, f: AttemptFilter) =>
  f === 'all' ||
  (f === 'blocked' ? !!a.block : f === 'error' ? a.status === 'error' && !a.block : a.passed === (f === 'passed'));

/** True when the attempt's sample id, metric keys or names, or input has `q` (lower case). */
const found = (a: ShownAttempt, q: string, labels: Map<string, string>) =>
  [a.sampleId, a.input, ...(a.metrics ?? []).flatMap((m) => [m, labels.get(m)])].some((t) =>
    t?.toLowerCase().includes(q),
  );

/**
 * The attempts that the pick picks, `q` finds and the filter keeps, and the counts by filter. The
 * order: the most severe flag first, and in a severity the chats the reader can see first; then a
 * picked score's highest first, else the main score's worst first.
 */
function localRows(
  all: ShownAttempt[],
  state: SamplesState,
  pick: PickOption | undefined,
  main: ScoreColumn | undefined,
  q: string,
  labels: Map<string, string>,
) {
  const value = (a: ShownAttempt) => (pick?.kind === 'score' ? scoreNumber(a.scores[pick.scoreKey]?.value) : 0);
  const harm = (a: ShownAttempt) => {
    const n = pick?.kind === 'score' ? value(a) : main && scoreNumber(a.scores[main.key]?.value);
    return n === undefined ? -Infinity : pick?.kind === 'score' ? n : harmOf(n, main?.bar?.safetyDirection);
  };
  const locked = (a: ShownAttempt) => Number(!!a.flag && !!(a.hidden || a.withheld));
  const searched = q ? all.filter((a) => found(a, q, labels)) : all;
  const picked = (
    !pick
      ? [...searched]
      : pick.kind === 'group'
        ? searched.filter((a) => a.metrics?.includes(pick.metric))
        : pick.kind === 'split'
          ? searched.filter((a) => a.split === pick.metric)
          : searched.filter((a) => (value(a) ?? -Infinity) > pickMin(pick))
  ).sort(
    (a, b) =>
      flagRank(a.flag) - flagRank(b.flag) || locked(a) - locked(b) || harm(b) - harm(a) || a.ordinal - b.ordinal,
  );
  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, picked.filter((a) => matches(a, f.key)).length]));
  const rows = picked.filter((a) => matches(a, state.filter));
  return { attempts: rows, total: rows.length, counts: counts as Record<AttemptFilter, number> };
}

export function SamplesPanel({
  id,
  cleared,
  complete,
  attempts: given,
  mainScore,
  total: givenTotal,
  counts: givenCounts,
  perPage,
  notices,
  empty,
  footer,
  toolEval,
  detectors = NO_DETECTORS,
}: {
  id: string;
  cleared: boolean;
  complete: boolean;
  /** All attempts (`complete`), else the page. */
  attempts: ShownAttempt[];
  /** The score each sample shows when no score metric is picked. */
  mainScore?: ScoreColumn;
  total: number;
  counts: Record<AttemptFilter, number>;
  perPage: number;
  notices: ReactNode;
  empty: string;
  footer: ReactNode;
  /** A method eval: each sample's target is the label the method must find, and its answer is its verdict. */
  toolEval?: boolean;
  /** A method eval's detectors: a column for each call, in place of the verdict, result and score. */
  detectors?: DetectorDef[];
}) {
  const { state: chosen, go, picks } = useSamples();
  // A methods eval's pass or fail is one detector's only: its detectors filter in place of it.
  const calls = detectors.length > 0;
  const state = useMemo(
    () =>
      calls && (chosen.filter === 'passed' || chosen.filter === 'failed')
        ? { ...chosen, filter: 'all' as const }
        : chosen,
    [calls, chosen],
  );
  const scroller = useRef<HTMLDivElement>(null);
  const pick = picks.find((p) => p.metric === state.metric);
  // Null: the search field is closed.
  const [search, setSearch] = useState<string | null>(null);
  const q = search?.trim().toLowerCase() ?? '';
  const labels = useMemo(() => new Map(picks.map((p) => [p.metric, p.label])), [picks]);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  // A page of a run with more attempts than the page gets: the server searches.
  const view = `${state.filter}/${state.metric ?? ''}/${q}/${JSON.stringify(verdicts)}`;
  const [served, setServed] = useState<{
    view: string;
    attempts: ShownAttempt[];
    total: number;
    counts: typeof givenCounts;
  }>();
  useEffect(() => {
    if (complete || !q) return;
    const wait = setTimeout(() => {
      findAttempts(id, state.filter, state.metric, q)
        .then((r) => r && setServed({ view, ...r }))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(wait);
  }, [complete, q, id, state.filter, state.metric, view]);
  const searching = !complete && !!q && served?.view !== view;
  const { attempts, total, counts } = useMemo(
    () =>
      complete
        ? localRows(given, state, pick, mainScore, q, labels)
        : !q
          ? { attempts: given, total: givenTotal, counts: givenCounts }
          : served?.view === view
            ? served
            : { attempts: [], total: 0, counts: givenCounts },
    [complete, given, state, pick, mainScore, q, labels, givenTotal, givenCounts, served, view],
  );
  const kept = useMemo(() => {
    const wanted = Object.entries(verdicts);
    if (!wanted.length) return attempts;
    return attempts.filter((a) => {
      if (a.hidden) return false;
      const made = callsOf(a, detectors);
      return wanted.every(([key, v]) => made[key]?.right === (v === 'pass'));
    });
  }, [attempts, verdicts, detectors]);
  const setVerdict = (key: string, v: Verdict | null) => {
    setVerdicts(({ [key]: _, ...rest }) => (v ? { ...rest, [key]: v } : rest));
    scroller.current?.scrollTo({ top: 0 });
  };
  const resetVerdicts = () => {
    setVerdicts({});
    scroller.current?.scrollTo({ top: 0 });
  };
  // Columns with no value in any sample do not show.
  const columns = useMemo(() => {
    const answer = answerColumn(given);
    const calls = detectors.length > 0;
    return {
      target: !!toolEval && given.some((a) => typeof a.target === 'string'),
      answer: calls ? null : answer && toolEval ? { ...answer, header: 'Verdict' } : answer,
      result: !calls && given.some((a) => a.passed !== undefined && a.passed !== null),
      // A letter grade (`C`, `I`) is the result again.
      main: !calls && !!mainScore && given.some((a) => typeof a.scores[mainScore.key]?.value === 'number'),
      detectors,
    };
  }, [given, mainScore, toolEval, detectors]);
  const score =
    pick?.kind === 'score'
      ? { key: pick.scoreKey, label: pick.label, bar: pick.bar, attemptScale: pick.attemptScale }
      : columns.main
        ? mainScore
        : undefined;
  // The filters with some but not all samples, and the one in use. Each is a toggle; off shows all.
  const filters = FILTERS.filter(
    (f) =>
      f.key !== 'all' &&
      !(calls && (f.key === 'passed' || f.key === 'failed')) &&
      (f.key === state.filter || (counts[f.key] > 0 && counts[f.key] < counts.all)),
  );
  const more = useCallback(
    (page: number) => moreAttempts(id, state.filter, state.metric, page, q || undefined),
    [id, state.filter, state.metric, q],
  );
  const pickView = (patch: Partial<SamplesState>) => {
    go(patch);
    scroller.current?.scrollTo({ top: 0 });
  };
  const find = (next: string | null) => {
    setSearch(next);
    scroller.current?.scrollTo({ top: 0 });
  };
  // With the Pass and Fail toggles, the search and metric menu are in their row, left of the reset.
  const verdictRow = complete && calls;
  const searchControl = (
    <>
      <button
        type="button"
        aria-pressed={search !== null}
        aria-label={search === null ? 'Search the samples' : 'Close the search'}
        title={search === null ? 'Search the samples' : 'Close the search'}
        onClick={() => find(search === null ? '' : null)}
        className={cn(
          'flex shrink-0 cursor-pointer items-center justify-center rounded-full border',
          verdictRow ? 'size-5' : 'size-6',
          search !== null
            ? 'border-slate-600 bg-slate-600 text-white hover:bg-slate-700'
            : 'border-slate-200 bg-slate-100 text-slate-600 hover:border-slate-300 hover:bg-slate-200',
        )}
      >
        <Search className={verdictRow ? 'size-3' : 'size-3.5'} aria-hidden />
      </button>
      {search !== null && (
        <input
          type="search"
          autoFocus
          value={search}
          onChange={(e) => find(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && find(null)}
          placeholder="Input, sample ID or metric"
          aria-label="Search the samples"
          className={cn(
            'min-w-0 rounded-full border border-slate-300 bg-white px-2.5 text-[11px] font-normal text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500',
            verdictRow ? 'h-5 w-40' : 'h-6 w-48',
          )}
        />
      )}
    </>
  );
  const picker = picks.length > 0 && (
    <MetricPicker
      options={picks.map((p) => ({ key: p.metric, label: p.label, count: p.count }))}
      current={pick?.metric}
      onPick={(metric) => pickView({ metric })}
      small={verdictRow}
    />
  );
  const toolbar = (!verdictRow || filters.length > 0) && (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {!verdictRow && searchControl}
        {!verdictRow && picker}
      </div>
      {filters.length > 0 && (
        <SegmentedToggle
          label="Samples"
          value={state.filter === 'all' ? null : state.filter}
          options={filters.map((f) => ({ value: f.key, label: f.label, count: counts[f.key] }))}
          onValueChange={(filter) => pickView({ filter: filter ?? 'all' })}
        />
      )}
    </div>
  );
  return (
    <div
      ref={scroller}
      data-ask-skip
      className="flex min-h-0 flex-1 flex-col overflow-auto *:shrink-0 lg:overscroll-contain"
    >
      <div className="flex flex-col gap-2 p-3 empty:hidden">{notices}</div>
      {/* No key: the search field in the toolbar keeps its focus while the rows change. */}
      <SampleRows
        view={view}
        id={id}
        attempts={kept}
        total={kept === attempts ? total : kept.length}
        more={complete ? undefined : more}
        perPage={perPage}
        cleared={cleared}
        columns={columns}
        score={score}
        toolbar={toolbar}
        {...(verdictRow && {
          verdicts,
          onVerdict: setVerdict,
          onReset: resetVerdicts,
          search: (
            <>
              {searchControl}
              {picker}
            </>
          ),
        })}
      />
      {kept.length === 0 && (
        <p className="px-3 py-2 text-sm text-slate-500">
          {searching
            ? 'Searching the samples.'
            : q
              ? 'No samples match the search.'
              : kept !== attempts
                ? 'No samples match the filters.'
                : empty}
        </p>
      )}
      {footer}
    </div>
  );
}

const NONE: ShownAttempt[] = [];
const NO_DETECTORS: DetectorDef[] = [];

/** The first rows, and `perPage` more each time the end comes near: from `attempts`, else from
 * `more`. A new `view` starts again at the first rows. */
function SampleRows({
  view,
  attempts,
  total,
  more,
  perPage,
  ...table
}: {
  view: string;
  attempts: ShownAttempt[];
  total: number;
  more?: (page: number) => Promise<ShownAttempt[]>;
  perPage: number;
} & Omit<Parameters<typeof AttemptTable>[0], 'attempts'>) {
  // Each is for one view: the rows of an earlier view do not show.
  const [extra, setExtra] = useState({ view, limit: perPage, loaded: NONE });
  const [loading, setLoading] = useState(false);
  // A failed load stops the loads of this view, so that the observer does not try again at once.
  const [failedView, setFailedView] = useState<string | null>(null);
  const failed = failedView === view;
  const { limit, loaded } = extra.view === view ? extra : { limit: perPage, loaded: NONE };
  const end = useRef<HTMLDivElement>(null);
  const rows = more ? [...attempts, ...loaded] : attempts.slice(0, limit);
  const done = more ? rows.length >= total : limit >= attempts.length;
  useEffect(() => {
    const el = end.current;
    if (!el || done || loading || failed) return;
    const grow = (patch: Partial<typeof extra>) =>
      setExtra((x) => ({ view, limit: perPage, loaded: NONE, ...(x.view === view && x), ...patch }));
    // A new observer for each new length: it reports at once if the end is still in view.
    const seen = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        if (!more) return grow({ limit: limit + perPage });
        setLoading(true);
        more(Math.floor(rows.length / perPage) + 1)
          .then((next) => grow({ loaded: [...loaded, ...next] }))
          .catch(() => setFailedView(view))
          .finally(() => setLoading(false));
      },
      { rootMargin: '600px 0px' },
    );
    seen.observe(el);
    return () => seen.disconnect();
  }, [rows.length, done, loading, failed, more, perPage, view, limit, loaded]);
  return (
    <>
      <AttemptTable {...table} attempts={rows} />
      {!done && (
        <div ref={end} className="px-3 py-2 text-center text-xs text-slate-400">
          {loading
            ? 'Loading more samples'
            : failed
              ? 'Could not load more samples. Try again later.'
              : `${rows.length} of ${total}`}
        </div>
      )}
    </>
  );
}

/** `text` with `children` after its last word, on one line. */
function WithInfo({ text, children }: { text: string; children: ReactNode }) {
  const at = text.lastIndexOf(' ') + 1;
  return (
    <>
      {text.slice(0, at)}
      <span className="whitespace-nowrap">
        {text.slice(at)}
        {children}
      </span>
    </>
  );
}

/** The safety bar of a sample's score, as the results show it. Nothing when the column has no
 * direction or the value does not fit the scale. `groups`: the sample's group metrics. */
function SampleBar({ value, column, groups }: { value: unknown; column: ScoreColumn; groups?: string[] }) {
  const n = scoreNumber(value);
  if (!column.bar || n === undefined) return null;
  const r = sampleBar(column.key, n, column.bar, groups);
  return safeShare(r) === undefined ? null : <SafetyBar result={r} className="mx-auto mt-0.5 h-1.5 w-10" />;
}

/** The attempt's number and the sample's id, below its input. The number is the link that opens
 * the row's sample. The viewer covers most of the screen, so the row then scrolls into view. */
const SampleId = ({ run, attempt: a, open }: { run: string; attempt: ShownAttempt; open: boolean }) => (
  <div className="mt-0.5 font-mono text-[10px] wrap-anywhere text-slate-400">
    <PanelLink
      to={{ run, attempt: a.ordinal }}
      onClick={(e) => {
        const row = e.currentTarget.closest('tr');
        if (row && plainClick(e)) setTimeout(() => showInView(row), 100);
      }}
      aria-current={open || undefined}
      aria-label={`Sample ${a.ordinal}`}
      className="text-slate-400 tabular-nums after:absolute after:inset-0"
    >
      {a.ordinal}
    </PanelLink>
    <span className="px-1 text-slate-300">·</span>
    {a.sampleId}
    {a.epoch > 1 && ` #${a.epoch}`}
  </div>
);

/** `score`: a column with that score of each attempt. `toolbar`: a row above the column names, in
 * the same sticky head. A row opens its sample in the viewer, and the open one is marked.
 * `onVerdict`: a Pass and Fail toggle above each detector, and at the left `search`, then a reset. */
function AttemptTable({
  id,
  attempts,
  cleared,
  columns,
  score,
  toolbar,
  verdicts = {},
  onVerdict,
  onReset,
  search,
}: {
  verdicts?: Record<string, Verdict>;
  onVerdict?: (key: string, v: Verdict | null) => void;
  onReset?: () => void;
  search?: ReactNode;
  id: string;
  attempts: ShownAttempt[];
  cleared: boolean;
  columns: {
    target: boolean;
    answer: AnswerColumn | null;
    result: boolean;
    main: boolean;
    detectors: DetectorDef[];
  };
  score?: ScoreColumn;
  toolbar?: ReactNode;
}) {
  const params = useSearchParams();
  const open = useMemo(() => {
    const p = runPanelFromParams(new URLSearchParams(params?.toString()));
    return p?.run === id ? p.attempt : undefined;
  }, [params, id]);
  // An ordinal score shows whole numbers when all its values here are whole.
  const whole =
    !!score?.ordinal &&
    attempts.every((a) => {
      const v = onScale(a.scores[score.key]?.value, score);
      return typeof v !== 'number' || Number.isInteger(v);
    });
  const { detectors } = columns;
  const shares = detectors.some((d) => d.share);
  // Why each shown sample has no scores: from its transcript, so only for the rows that show.
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const asked = useRef(new Set<string>());
  useEffect(() => {
    if (!shares && !columns.result) return;
    const unscored = (a: (typeof attempts)[number]) =>
      shares
        ? !Object.keys(callsOf(a, detectors)).length
        : a.passed == null && a.status !== 'error' && !Object.keys(a.scores).length;
    const ids = attempts
      .filter((a) => !a.hidden && !a.withheld && !asked.current.has(a.id) && unscored(a))
      .map((a) => a.id);
    if (!ids.length) return;
    for (const i of ids) asked.current.add(i);
    notScoredOf(id, ids)
      .then((r) => setReasons((old) => ({ ...old, ...r })))
      .catch(() => {});
  }, [attempts, shares, detectors, id, columns.result]);
  const width =
    1 + Number(columns.target) + Number(!!columns.answer) + Number(columns.result) + Number(!!score) + detectors.length;
  return (
    <table className="w-full table-fixed text-left text-xs">
      {/* The widths are here: with a toolbar, the first row of the head has one cell. */}
      <colgroup>
        <col />
        {columns.target && <col className={detectors.length ? 'w-24' : 'w-20'} />}
        {columns.answer && <col className="w-16" />}
        {columns.result && <col className="w-14" />}
        {detectors.map((d) => (
          <col key={d.key} className="w-24" />
        ))}
        {score && <col className="w-36" />}
      </colgroup>
      <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
        {toolbar && (
          <tr>
            <th colSpan={width} className="px-3 pt-2 pb-0.5 font-normal">
              {toolbar}
            </th>
          </tr>
        )}
        {onVerdict && (
          <tr>
            <th className="px-3 pt-1.5 font-normal">
              <span className="flex flex-wrap items-center gap-1.5">
                {search}
                {Object.keys(verdicts).length > 0 && (
                  <button
                    type="button"
                    onClick={onReset}
                    className="cursor-pointer rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px]/4 font-medium text-slate-600 hover:bg-slate-200 hover:text-slate-800"
                  >
                    Reset
                  </button>
                )}
              </span>
            </th>
            {columns.target && <th />}
            {columns.answer && <th />}
            {columns.result && <th />}
            {detectors.map((d) => (
              <th key={d.key} className="px-1 pt-1.5 font-normal">
                <SegmentedToggle
                  label={`${d.label} calls`}
                  value={verdicts[d.key] ?? null}
                  options={VERDICTS}
                  onValueChange={(v) => onVerdict(d.key, v)}
                  className="mx-auto w-fit"
                  itemClassName="px-1.5"
                />
              </th>
            ))}
            {score && <th />}
          </tr>
        )}
        <tr>
          <th className="px-3 py-1.5 font-medium">Sample Attempt</th>
          {columns.target && <th className="px-2 py-1.5 text-center font-medium">Label</th>}
          {columns.answer && <th className="px-2 py-1.5 text-center font-medium">{columns.answer.header}</th>}
          {columns.result && <th className="px-2 py-1.5 text-center font-medium">Result</th>}
          {detectors.map((d) => (
            <th key={d.key} className="px-1 py-1.5 text-center align-middle leading-tight font-medium">
              {d.description ? (
                <WithInfo text={d.label}>
                  <InfoPopover
                    label={d.label}
                    iconClassName="size-3"
                    triggerClassName="ml-0.5 align-[-2px]"
                    contentClassName="text-xs font-normal"
                  >
                    <p>{d.description}</p>
                  </InfoPopover>
                </WithInfo>
              ) : (
                d.label
              )}
              {d.kind && <span className="mt-1 block truncate text-[10px]/3 font-normal text-slate-400">{d.kind}</span>}
            </th>
          ))}
          {score && (
            <th className="px-2 py-1.5 text-center font-medium">
              <span className="inline-flex max-w-full items-center gap-1 align-middle">
                <span className="truncate" title={score.label}>
                  {score.label}
                </span>
                {score.description && (
                  <InfoPopover label={score.label} iconClassName="size-3.5" contentClassName="text-xs font-normal">
                    <p>{score.description}</p>
                  </InfoPopover>
                )}
              </span>
            </th>
          )}
        </tr>
      </thead>
      <tbody className="isolate divide-y divide-slate-100">
        {attempts.map((a) => {
          const answer = columns.answer?.of(a.scores);
          const calls = detectors.length && !a.hidden ? callsOf(a, detectors) : {};
          const tokens = shares && !a.hidden && Array.isArray(a.target) ? a.target.map(String) : [];
          const unscored = shares && !a.hidden && !Object.keys(calls).length;
          return (
            <tr
              key={a.id}
              className={cn('relative hover:bg-sky-50', a.ordinal === open && 'bg-sky-100 hover:bg-sky-100')}
            >
              {a.hidden ? (
                <td className="px-3 py-2.5">
                  <FlagLabel flag={a.flag} title={a.flagTitle} locked className="mb-0.5" />
                  <div className="text-slate-400 italic">{cleared ? 'Hidden by the dataset terms' : 'Hidden'}</div>
                  <SampleId run={id} attempt={a} open={a.ordinal === open} />
                </td>
              ) : (
                <td className="px-3 py-2.5 text-slate-700" title={a.input}>
                  <FlagLabel flag={a.flag} title={a.flagTitle} locked={a.withheld} className="mb-0.5" />
                  <div className={cn(detectors.length ? 'line-clamp-2' : 'line-clamp-3', 'wrap-anywhere')}>
                    {a.input}
                  </div>
                  {tokens.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {tokens.map((t, i) => (
                        <code key={i} className="rounded-sm bg-slate-100 px-1 text-[9px] text-slate-700">
                          {t}
                        </code>
                      ))}
                    </div>
                  )}
                  <SampleId run={id} attempt={a} open={a.ordinal === open} />
                </td>
              )}
              {columns.target && (
                <td className="truncate px-1 py-2.5 text-center text-slate-800">
                  {typeof a.target === 'string' ? a.target : '—'}
                </td>
              )}
              {columns.answer && <td className="truncate px-2 py-2.5 text-center text-slate-800">{answer ?? '—'}</td>}
              {columns.result && (
                <td className="px-2 py-2.5">
                  <span className="flex justify-center">
                    <PassMark attempt={a} why={reasons[a.id]} />
                  </span>
                </td>
              )}
              {unscored ? (
                <td colSpan={detectors.length} className="px-3 py-2.5 text-center text-xs/4">
                  <span className="block text-slate-600">Not Scored</span>
                  {reasons[a.id] && (
                    <span className="block text-[10px]/3 text-slate-400">
                      <CodeText text={reasons[a.id]} />
                    </span>
                  )}
                </td>
              ) : (
                detectors.map((d) => (
                  <td key={d.key} className="px-1 py-2.5 text-center whitespace-nowrap tabular-nums">
                    <Call call={calls[d.key]} />
                  </td>
                ))
              )}
              {score && (
                <td className="px-2 py-2.5 text-center font-mono text-slate-800 tabular-nums">
                  {a.status === 'error' && !columns.result ? (
                    <PassMark attempt={a} />
                  ) : (
                    <>
                      {scoreText(onScale(a.scores[score.key]?.value, score), whole)}
                      <SampleBar value={onScale(a.scores[score.key]?.value, score)} column={score} groups={a.metrics} />
                    </>
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
