'use client';

import { detectorSamples } from '@/app/evaluations/actions';
import { AttestationForm } from '@/components/eval-attestation';
import { Fold } from '@/components/fold';
import { InfoPopover } from '@/components/info-popover';
import { useMetricChoice } from '@/components/methods/metric-choice';
import { useModelFilter } from '@/components/methods/model-filter';
import { TABLE, THEAD } from '@/components/methods/table';
import { RunLink, showInView, useMarkCite } from '@/components/pdf-viewer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SegmentedToggle, type Toggle } from '@/components/ui/segmented-toggle';
import { CANARY, CANARY_GUID, canaryGuids } from '@/lib/legal';
import { fewestOf } from '@/lib/runs/detectors';
import type { DetectorKind, DetectorSampleItem, Finds, Misses, SampleMetric } from '@/lib/server/runs';
import { cn } from '@/lib/utils';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/** A detector's score key, its column label and its method (`kind`), as "Probes". */
export type DetectorColumn = { key: string; label: string; kind?: string };
/** A model that the samples can be filtered by: its name, label and run page. */
export type SampleModel = { name: string; label: string; href?: string };
/** A sort's toggles: "Pass" puts the most passed samples first, "Fail" the most missed. */
type Verdict = 'pass' | 'fail';
const VERDICTS: Toggle<Verdict>[] = [
  { value: 'pass', label: 'Pass' },
  { value: 'fail', label: 'Fail' },
];
const ARIA_SORT = { fail: 'descending', pass: 'ascending', none: undefined } as const;
/** The toggle of a detector that is on in `sorts`: `fail` for its key, `pass` for `fewestOf` it. */
const verdictOf = (sorts: string[], key: string): Verdict | null =>
  sorts.includes(key) ? 'fail' : sorts.includes(fewestOf(key)) ? 'pass' : null;

const NUM = 'px-3 py-2.5 text-center text-xs whitespace-nowrap tabular-nums';
/** The most samples that load to find the sample of the page's URL. */
const MAX_SEEK = 1000;

/** A count or a mean of misses, to one decimal place. Zero shows in light gray; none as "—". */
const mean = (n: number | null) => (n == null ? '—' : String(Math.round(n * 10) / 10));
const count = (n: number | null) => (
  <span className={n ? 'font-medium text-rose-700' : 'text-slate-400'}>{mean(n)}</span>
);

/** The misses of all `scored` tests, as "2/5". */
const outOf = (m: Finds) => (m.mean == null ? '—' : `${Math.round(m.mean * m.scored)}/${m.scored}`);

/** A detector's misses on a sample: missed lies and missed honest replies on two lines, or one
 * line with the mean of its missed tokens, or with `hit` its missed tests of all ("Missed" or
 * "Passed" for one test). The block is centered in its cell; its lines align left. */
function Missed({ m, hit }: { m: Misses | Finds; hit?: boolean }) {
  return (
    <div className="inline-flex flex-col items-start text-left text-slate-500">
      {'lies' in m ? (
        <>
          <span>
            {count(m.lies)} {m.lies === 1 ? 'Lie' : 'Lies'} Missed
          </span>
          <span>{count(m.honest)} Honest Missed</span>
        </>
      ) : hit && m.scored === 1 && m.mean != null ? (
        <span
          className={cn(
            'text-[10px] font-semibold tracking-wide uppercase',
            m.mean ? 'text-rose-700' : 'text-emerald-600',
          )}
        >
          {m.mean ? 'Missed' : 'Passed'}
        </span>
      ) : hit ? (
        <span>
          <span className={m.mean ? 'font-medium text-rose-700' : 'text-slate-400'}>{outOf(m)}</span> Missed
        </span>
      ) : (
        <span>{count(m.mean)} Missed</span>
      )}
    </div>
  );
}

/** A menu of `metrics`, the headline first, each with its number of samples. `value`: the picked
 * metric's key; none for the headline. */
function MetricMenu({
  metrics,
  value,
  onChange,
}: {
  metrics: SampleMetric[];
  value?: string;
  onChange: (key?: string) => void;
}) {
  const [headline] = metrics;
  const shown = metrics.find((m) => m.key === value) ?? headline!;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Metric"
        title={shown.about}
        className={cn(
          'flex h-6 max-w-48 min-w-0 cursor-pointer items-center gap-x-1 rounded-md border bg-white px-2 text-[11px] font-medium hover:border-slate-300',
          shown !== headline ? 'border-sky-700 text-sky-800' : 'border-slate-200 text-slate-700',
        )}
      >
        <span className="truncate">{shown.name}</span>
        <ChevronDown className="size-3.5 shrink-0 text-slate-400" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-64">
        <DropdownMenuRadioGroup value={shown.key} onValueChange={(v) => onChange(v === headline!.key ? undefined : v)}>
          {metrics.map((m) => (
            <DropdownMenuRadioItem key={m.key} value={m.key} title={m.about} className="cursor-pointer text-xs">
              {m.name}
              {m.count != null && <span className="ml-auto pl-3 font-mono text-[10px] text-slate-400">{m.count}</span>}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const INFO: Record<DetectorKind, string> = {
  label:
    'Each sample with the replies that each detector got wrong: one reply for each model. A missed lie is a lie that the detector called honest. A missed honest reply is one that it called a lie. A probe grades only the models that it has.',
  share:
    'Each sample with its hidden tokens, and the mean number of them that each detector missed: a mean over the models, one reply for each model. Under each prompt: the mean for all the detectors. A reply with no score does not count.',
  hit: 'Each sample with its target, and the models on which each method missed it, of the models with a score: one reply for each model. Under each prompt: the misses of all the methods. A reply with no score does not count.',
};

/**
 * The eval's samples and the misses of each detector. `kind` tells how they count. Under each
 * prompt: its total misses, then its id. "Pass" or "Fail" above a column puts its most passed or
 * most missed samples first; the set columns add up. At first, each column is on "Fail". With
 * none, the samples are in source order. A menu counts only one
 * model's replies (`?model=`), and one counts the misses on another metric, or on its split
 * (`useMetricChoice`). A
 * row opens the sample, or with a model, that model's attempt. Pages
 * load as the reader scrolls, as in `EvalSamplesPanel`.
 */
export function DetectorSamples({
  slug,
  detectors,
  kind = 'label',
  models,
  canary,
  fill,
  only,
  metrics,
  scope,
}: {
  slug: string;
  detectors: DetectorColumn[];
  kind?: DetectorKind;
  /** The models of the eval, for the model menu. */
  models?: SampleModel[];
  canary?: string | null;
  /** From `xl` up, the list fills the height of its panel. */
  fill?: boolean;
  /** One detector's key: the totals count only its misses. */
  only?: string;
  /** The metrics to count misses on, the headline first, for the metric menu (`useMetricChoice`). */
  metrics?: SampleMetric[];
  /** The eval's slug, on a page with more than one eval. */
  scope?: string;
}) {
  // The detectors' sorts. At first, "Fail" on each: the most missed of all are first.
  const failAll = detectors.map((d) => d.key);
  const [sorts, setSorts] = useState<string[]>(failAll);
  const [model, setModel] = useModelFilter();
  const picked = models?.find((m) => m.name === model);
  const [metricKey, setMetric] = useMetricChoice(scope);
  const headline = metrics?.[0];
  const chosen = metrics?.find((m) => m !== headline && m.key === metricKey);
  // A metric with no scores on the samples: the list counts the headline's misses, on its split's
  // samples when it names one.
  const metric = chosen?.data ? chosen.key : undefined;
  const split = !metric && chosen?.split ? chosen.key : undefined;
  const menu = metrics?.filter((m) => m.data || m.split) ?? [];
  const [samples, setSamples] = useState<DetectorSampleItem[]>([]);
  const [more, setMore] = useState(true);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [cleared, setCleared] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const list = `${slug}|${sorts.join(',')}|${model ?? ''}|${only ?? ''}|${metric ?? ''}|${split ?? ''}`;
  const [from, setFrom] = useState(list);
  const current = useRef(list);
  if (list !== from) {
    setFrom(list);
    setSamples([]);
    setMore(true);
    setState('idle');
  }
  useEffect(() => {
    current.current = list;
    box.current?.scrollTo({ top: 0 });
  }, [list]);
  const load = useCallback(async () => {
    if (current.current !== list) return;
    setState('loading');
    try {
      const page = await detectorSamples(slug, samples.length, sorts, model ?? undefined, only, metric, split);
      if (current.current !== list) return;
      setSamples((old) => {
        const seen = new Set(old.map((s) => s.id));
        return [...old, ...page.samples.filter((s) => !seen.has(s.id))];
      });
      setMore(page.more);
      setCleared(page.cleared);
      setState('idle');
    } catch {
      if (current.current === list) setState('error');
    }
  }, [slug, sorts, model, only, metric, split, list, samples.length]);
  // The sample of the page's URL: once its row loads, it is marked and scrolled into view.
  const markCite = useMarkCite();
  const wanted = useRef<string | null | undefined>(undefined);
  const rowOf = (id: string) => box.current?.querySelector<HTMLElement>(`tr[data-sample="${CSS.escape(id)}"]`) ?? null;
  useEffect(() => {
    if (wanted.current === undefined) wanted.current = new URLSearchParams(location.search).get('sample');
    const id = wanted.current;
    if (!id || state !== 'idle') return;
    const row = rowOf(id);
    if (row) {
      wanted.current = null;
      markCite?.(row);
      setTimeout(() => showInView(row), 100);
    } else if (more && samples.length && samples.length < MAX_SEEK) {
      const timer = setTimeout(load, 0);
      return () => clearTimeout(timer);
    }
  }, [samples, more, state, load, markCite]);
  useEffect(() => {
    if (!more || state !== 'idle' || !end.current) return;
    // A box that does not scroll (under `lg`, in a `Fold`): the page loads more as it scrolls.
    const b = box.current;
    const observer = new IntersectionObserver((seen) => seen.some((s) => s.isIntersecting) && load(), {
      root: b && b.scrollHeight > b.clientHeight ? b : null,
      rootMargin: '0px 0px 600px 0px',
    });
    observer.observe(end.current);
    return () => observer.disconnect();
  }, [more, state, load]);

  const cols = detectors.length + 1;
  // With one detector, its column has the totals, so the rows do not repeat them.
  const single = detectors.length === 1;
  const avg = !picked && kind === 'share' && !!models?.length ? `(avg of ${models.length} models)` : undefined;
  const sorted = (key: string) => verdictOf(sorts, key) !== null;
  const reset = !!model || !!metricKey || [...sorts].sort().join() !== [...failAll].sort().join();
  /** Sets a detector's toggle. A changed toggle keeps its place in the order; a new one is last. */
  const sortBy = (key: string, verdict: Verdict | null) =>
    setSorts((old) => {
      const next = verdict && (verdict === 'fail' ? key : fewestOf(key));
      const kept = old.filter((s) => s !== key && s !== fewestOf(key));
      if (!next) return kept;
      const at = old.findIndex((s) => s === key || s === fewestOf(key));
      return at < 0 ? [...old, next] : old.map((s, i) => (i === at ? next : s));
    });
  /** A detector's header, dark while the samples sort by it. */
  const head = (key: string, label: ReactNode, kind?: string) => (
    <th key={key} aria-sort={ARIA_SORT[verdictOf(sorts, key) ?? 'none']} className="px-3 py-2 text-center font-medium">
      <span className={cn('inline-flex flex-col items-center whitespace-nowrap', sorted(key) && 'text-slate-800')}>
        {label}
        {kind && <span className="text-[10px]/3 font-normal text-slate-400 normal-case">{kind}</span>}
      </span>
    </th>
  );

  return (
    <div data-ask-skip className="contents">
      <Fold more="Show more samples">
        <div
          ref={box}
          className={cn(
            'min-h-0 overflow-auto lg:max-h-[40rem]',
            fill && 'flex-1 xl:max-h-none',
            !only && 'lg:overscroll-contain',
          )}
        >
          <table className={TABLE}>
            <thead className={cn(THEAD, 'sticky top-0 z-10')}>
              <tr>
                <th className="px-4 pt-2 pb-0.5 font-medium">
                  <span className="flex items-center justify-between gap-x-2">
                    <span className="flex min-w-0 items-center gap-x-2">
                      {menu.length > 1 && (
                        <MetricMenu metrics={menu} value={metric ?? split} onChange={(v) => setMetric(v ?? null)} />
                      )}
                      {!!models?.length && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label="Model"
                            className={cn(
                              'flex h-6 max-w-48 min-w-0 cursor-pointer items-center gap-x-1 rounded-md border bg-white px-2 text-[11px] font-medium hover:border-slate-300',
                              picked ? 'border-sky-700 text-sky-800' : 'border-slate-200 text-slate-700',
                            )}
                          >
                            <span className="truncate">{picked?.label ?? 'All Models'}</span>
                            <ChevronDown className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="max-h-80 w-56">
                            <DropdownMenuRadioGroup
                              value={picked?.name ?? ''}
                              onValueChange={(v) => setModel(v || null)}
                            >
                              {[{ name: '', label: 'All Models' }, ...models].map((m) => (
                                <DropdownMenuRadioItem key={m.name} value={m.name} className="cursor-pointer text-xs">
                                  {m.label}
                                </DropdownMenuRadioItem>
                              ))}
                            </DropdownMenuRadioGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      {reset && (
                        <button
                          type="button"
                          aria-label="Reset"
                          title="Reset"
                          onClick={() => {
                            setModel(null);
                            setMetric(null);
                            setSorts(failAll);
                          }}
                          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-500 transition-colors hover:bg-rose-100 hover:text-rose-600"
                        >
                          <RotateCcw aria-hidden className="size-3.5" />
                        </button>
                      )}
                      {picked?.href && (
                        <RunLink href={picked.href} className="shrink-0 text-[11px] text-sky-800 hover:underline">
                          Open Run
                        </RunLink>
                      )}
                    </span>
                  </span>
                </th>
                {detectors.map((d) => (
                  <th key={d.key} className="px-1 pt-2 pb-0.5 font-normal">
                    <SegmentedToggle
                      label={`Sort by ${d.label}`}
                      value={verdictOf(sorts, d.key)}
                      options={VERDICTS}
                      onValueChange={(v) => sortBy(d.key, v)}
                      className="mx-auto w-fit"
                      itemClassName="px-1.5"
                    />
                  </th>
                ))}
              </tr>
              <tr>
                <th className="px-4 pb-2 align-bottom font-medium">
                  <span className="inline-flex items-center gap-x-1">
                    Samples
                    {avg && !single && <span className="font-normal text-slate-400">{avg}</span>}
                    <InfoPopover label="the samples" iconClassName="size-3">
                      {INFO[kind]} Pass or Fail above a column puts its most passed or most missed samples first. Click
                      a row to open the sample. Pick a model, or click its column in the leaderboard, to count only its
                      replies.
                    </InfoPopover>
                  </span>
                </th>
                {detectors.map((d) => head(d.key, d.label, (single && avg) || d.kind))}
              </tr>
            </thead>
            <tbody className="isolate divide-y divide-slate-100">
              {chosen && !chosen.data && !chosen.split && headline && (
                <tr>
                  <td colSpan={cols} className="bg-amber-50 px-4 py-2 text-[11px] text-amber-900">
                    {chosen.name} has no score on each sample. The list shows the misses on {headline.name}.
                  </td>
                </tr>
              )}
              {!cleared && (
                <tr>
                  <td colSpan={cols} className="px-4 py-3">
                    <AttestationForm
                      onDone={() => {
                        setCleared(true);
                        setSamples([]);
                        setMore(true);
                        setState('idle');
                      }}
                    />
                  </td>
                </tr>
              )}
              {samples.map((s) => (
                <tr
                  key={s.id}
                  data-sample={s.href.split('/').pop()}
                  className="relative hover:bg-sky-50 data-cite-active:bg-sky-100"
                >
                  <td className="max-w-0 min-w-52 px-4 py-2.5 text-xs">
                    {s.hidden ? (
                      <div className="text-slate-400 italic">Hidden</div>
                    ) : (
                      <div className="line-clamp-2 wrap-anywhere text-slate-700">{s.input ?? '—'}</div>
                    )}
                    {kind !== 'label' && !!s.tokens?.length && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {s.tokens.map((t, i) => (
                          <code key={i} className="rounded-sm bg-slate-100 px-1 text-[9px] text-slate-700">
                            {t}
                          </code>
                        ))}
                      </div>
                    )}
                    <RunLink
                      href={s.attempt ?? s.href}
                      anchor={() => rowOf(s.href.split('/').pop()!)}
                      aria-label={`Sample ${s.sourceId}`}
                      className={cn(
                        'block font-mono text-[10px] text-slate-400 after:absolute after:inset-0 data-cite-active:outline-none',
                        kind === 'label' ? 'mt-0.5' : (!single || s.known) && 'mt-1.5',
                      )}
                    >
                      {!single && (
                        <span
                          className={cn(
                            'font-sans font-semibold tracking-wide uppercase',
                            s.total ? 'text-rose-700' : 'text-slate-400',
                          )}
                        >
                          {kind === 'hit' && 'scored' in s.all ? outOf(s.all) : mean(s.total)}
                          {kind === 'share' && s.tokens?.length ? `/${s.tokens.length} Tokens` : ''} Missed
                        </span>
                      )}
                      {kind === 'label' && (
                        <>
                          {!single && <span aria-hidden> · </span>}
                          {s.sourceId}
                        </>
                      )}
                      {s.known && <span className="ml-2 font-sans font-medium text-amber-800">Known error</span>}
                    </RunLink>
                  </td>
                  {detectors.map((d) => (
                    <td key={d.key} className={NUM}>
                      <Missed
                        m={s.missed[d.key] ?? (kind !== 'label' ? { mean: null, scored: 0 } : { lies: 0, honest: 0 })}
                        hit={kind === 'hit'}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div
            ref={end}
            className={cn('px-4 pb-3 text-center text-xs text-slate-500', samples.length ? 'pt-3' : 'pt-8')}
          >
            {state === 'loading' && (samples.length ? 'Loading more samples.' : 'Loading the samples.')}
            {state === 'error' && (
              <button type="button" onClick={load} className="cursor-pointer text-sky-800 hover:underline">
                The samples did not load. Try again.
              </button>
            )}
          </div>
        </div>
      </Fold>
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-slate-200 bg-slate-50 px-4 py-1.5 text-[11px] text-slate-600">
        These are evaluation samples. Do not use them to train models.
        <span title={canary ?? CANARY} className="font-mono text-[10px] break-all text-slate-400">
          {canary ? `canary GUID ${canaryGuids(canary)}` : CANARY_GUID}
        </span>
      </p>
    </div>
  );
}
