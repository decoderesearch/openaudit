'use client';

import { evalSamples } from '@/app/evaluations/actions';
import { INSET_TITLE } from '@/components/box-title';
import { AttestationForm } from '@/components/eval-attestation';
import { Fold } from '@/components/fold';
import { RunLink } from '@/components/pdf-viewer';
import { CANARY, CANARY_GUID, canaryGuids } from '@/lib/legal';
import type { EvalSampleItem, SampleOrder } from '@/lib/server/runs';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, ChevronsUpDown, Search, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

/** A click on "Failed" goes from ascending to descending to source order, as a table header. */
const NEXT_ORDER: Record<SampleOrder, SampleOrder> = { failedAsc: 'failed', failed: 'source', source: 'failedAsc' };
const ORDER_TEXT: Record<SampleOrder, string> = {
  failed: 'Most failed first',
  failedAsc: 'Fewest failed first',
  source: 'Source order',
};
/**
 * The eval's samples, each a link to its page with all the runs. On wide screens it is as tall as
 * the runs table at its left. It loads after the page, one page at a time: the next page loads
 * when the reader scrolls near the end. `ranked`: some sample has a failed reply, so the list starts
 * with the most failed samples, and a "Failed" button changes the order. A search button shows a box
 * that finds samples by id or text; hidden, the search does not apply. `bare`: no border and no
 * id, for a list in a `Panel`.
 */
export function EvalSamplesPanel({
  slug,
  ranked,
  canary,
  bare,
}: {
  slug: string;
  ranked?: boolean;
  canary?: string | null;
  bare?: boolean;
}) {
  const [order, setOrder] = useState<SampleOrder>(ranked ? 'failed' : 'source');
  const [samples, setSamples] = useState<EvalSampleItem[]>([]);
  const [more, setMore] = useState(true);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [cleared, setCleared] = useState(true);
  const [searching, setSearching] = useState(false);
  const [text, setText] = useState('');
  const [typed, setTyped] = useState('');
  const query = searching ? typed.trim() : '';
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => setTyped(text), 300);
    return () => clearTimeout(t);
  }, [text]);
  useEffect(() => {
    if (searching) field.current?.focus();
  }, [searching]);
  const box = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const list = `${slug}|${order}|${query}`;
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
    setState('loading');
    try {
      const page = await evalSamples(slug, samples.length, order, query);
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
  }, [slug, order, query, list, samples.length]);
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
  const splits = new Set(samples.map((s) => s.split)).size > 1;
  return (
    <div data-ask-skip className="contents">
      <Fold more="Show more samples">
        <section
          id={bare ? undefined : 'samples'}
          className={cn('relative scroll-mt-10', bare ? 'min-h-0 flex-1' : 'xl:min-h-[24rem]')}
        >
          <div
            className={cn(
              'flex h-full flex-col overflow-hidden bg-white lg:max-h-[40rem] xl:absolute xl:inset-0 xl:max-h-none',
              !bare && 'rounded-lg border border-slate-200',
            )}
          >
            <div ref={box} className={cn('min-h-0 flex-1 overflow-auto', !bare && 'lg:overscroll-contain')}>
              <table className="w-full table-fixed text-left text-xs">
                <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="h-10 px-3 py-1.5 font-medium">
                      <span className="flex items-center justify-between gap-x-2">
                        <span className={INSET_TITLE}>Evaluation Samples</span>
                        <span className="flex items-center gap-x-1.5">
                          {ranked && (
                            <button
                              type="button"
                              aria-label={`Sort by failed replies. Now: ${ORDER_TEXT[order]}.`}
                              title={ORDER_TEXT[order]}
                              onClick={() => setOrder(NEXT_ORDER[order])}
                              className={cn(
                                'flex h-6 shrink-0 cursor-pointer items-center gap-0.5 rounded-full border px-2 text-[9px] font-medium uppercase transition-colors',
                                order === 'source'
                                  ? 'border-slate-200 bg-white text-slate-500 hover:text-slate-800'
                                  : 'border-sky-700 bg-sky-50 text-sky-800',
                              )}
                            >
                              Failed
                              {order === 'failedAsc' ? (
                                <ArrowUp aria-hidden className="size-3" />
                              ) : order === 'failed' ? (
                                <ArrowDown aria-hidden className="size-3" />
                              ) : (
                                <ChevronsUpDown aria-hidden className="size-3 text-slate-300" />
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            aria-label="Search the samples"
                            aria-pressed={searching}
                            onClick={() => setSearching((on) => !on)}
                            className={cn(
                              'flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors',
                              searching
                                ? 'border-sky-700 bg-sky-50 text-sky-800'
                                : 'border-slate-200 bg-white text-slate-500 hover:text-slate-800',
                            )}
                          >
                            {searching ? <X className="size-3.5" /> : <Search className="size-3.5" />}
                          </button>
                        </span>
                      </span>
                    </th>
                  </tr>
                  {searching && (
                    <tr>
                      <th className="px-3 pb-2 font-normal">
                        <label className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 focus-within:border-sky-600">
                          <Search aria-hidden className="size-3.5 shrink-0 text-slate-400" />
                          <input
                            ref={field}
                            type="search"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Sample id or words"
                            aria-label="Search the samples by id or text"
                            className="w-full bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400"
                          />
                        </label>
                      </th>
                    </tr>
                  )}
                </thead>
                <tbody className="isolate divide-y divide-slate-100">
                  {!cleared && (
                    <tr>
                      <td className="flex flex-col gap-2 px-3 py-3">
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
                    <tr key={s.id} className="relative hover:bg-sky-50 has-[[data-cite-active]]:bg-sky-100">
                      <td className="px-3 py-2.5">
                        <div className="mb-0.5 flex items-baseline gap-x-2 font-mono text-[10px] text-slate-400">
                          <RunLink
                            href={s.href}
                            aria-label={`Sample ${s.sourceId}`}
                            className="min-w-0 wrap-anywhere after:absolute after:inset-0 data-cite-active:outline-none"
                          >
                            {splits && `${s.split} / `}
                            {s.sourceId}
                          </RunLink>
                          {s.known ? (
                            <span
                              title="This sample has a known error. It does not count in the pass rates."
                              className="ml-auto shrink-0 rounded-sm bg-amber-100 px-1 font-sans font-medium text-amber-800"
                            >
                              Known error
                            </span>
                          ) : (
                            s.graded > 0 && (
                              <span
                                title={`${s.failed} of ${s.graded} graded replies failed`}
                                className={cn(
                                  'ml-auto shrink-0 font-sans font-medium tabular-nums',
                                  s.failed ? 'text-rose-700' : 'text-slate-400',
                                )}
                              >
                                {s.failed}/{s.graded} failed
                              </span>
                            )
                          )}
                        </div>
                        {s.hidden ? (
                          <div className="text-slate-400 italic">Hidden</div>
                        ) : (
                          <div className="line-clamp-3 wrap-anywhere text-slate-700">{s.input ?? '—'}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div
                ref={end}
                className={cn('px-3 pb-3 text-center text-xs text-slate-500', samples.length ? 'pt-3' : 'pt-8')}
              >
                {state === 'loading' && (samples.length ? 'Loading more samples.' : 'Loading the samples.')}
                {state === 'idle' && !more && !samples.length && query && 'No samples match.'}
                {state === 'error' && (
                  <button type="button" onClick={load} className="cursor-pointer text-sky-800 hover:underline">
                    The samples did not load. Try again.
                  </button>
                )}
              </div>
            </div>
            <p className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600">
              These are evaluation samples. Do not use them to train models.
              <span title={canary ?? CANARY} className="font-mono text-[10px] break-all text-slate-400">
                {canary ? `canary GUID ${canaryGuids(canary)}` : CANARY_GUID}
              </span>
            </p>
          </div>
        </section>
      </Fold>
    </div>
  );
}
