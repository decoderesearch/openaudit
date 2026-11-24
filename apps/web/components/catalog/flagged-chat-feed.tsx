'use client';

import { FLAGGED_CHATS_INFO, INSET_TITLE } from '@/components/box-title';
import { ALL, ClearFilters, FilterMenu } from '@/components/catalog/filter-menu';
import { FLAGGED_CHATS_ID, useFlaggedTopic } from '@/components/catalog/flagged-topic';
import { FlaggedChat, type SnippetView } from '@/components/catalog/openaudit-card-client';
import { TOPIC_LABELS } from '@/components/catalog/parts';
import { InfoPopover } from '@/components/info-popover';
import { useMarkCite } from '@/components/pdf-viewer';
import { CHAT_GROUPS, chatGroup, type ChatGroup } from '@/lib/feed';
import { DEFAULT_JLENS_MODEL, jlensModelFor } from '@/lib/jlens';
import { useJlensModels } from '@/lib/jlens-models';
import { EVALUATIONS_HASH, SEVERITIES } from '@/lib/openaudit-card';
import { runPanelFromParams } from '@/lib/run-panel';
import { cn } from '@/lib/utils';
import type { Topic } from '@openaudit/spec';
import { useVirtualizer } from '@tanstack/react-virtual';
import { MessageSquareWarning } from 'lucide-react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

/** Critical chats are in "high". */
const levelOf = (s: SnippetView): ChatGroup => chatGroup(s.severity);

/** By level; in a level, the chats that the reader can open first, then the most severe, then the
 * newest run, then by attempt. */
const bySeverity = (a: SnippetView, b: SnippetView) =>
  CHAT_GROUPS.indexOf(levelOf(a)) - CHAT_GROUPS.indexOf(levelOf(b)) ||
  Number(!!a.locked) - Number(!!b.locked) ||
  SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) ||
  (b.date ?? '').localeCompare(a.date ?? '') ||
  a.ordinal - b.ordinal;

/** A "Topic" of the chats whose transcript is likely short enough for Neuronpedia's J-Lens. */
export const JLENS_TOPIC = 'debuggable_via_neuronpedia';
const JLENS_LABEL = 'Debuggable via Neuronpedia';
const JLENS_LOOK = {
  icon: <Image src="/neuronpedia-logo.png" alt="" width={14} height={14} className="size-3.5 shrink-0" />,
  className: 'font-medium text-sky-800',
};

const topicLabel = (t: string) => (t === JLENS_TOPIC ? JLENS_LABEL : (TOPIC_LABELS[t as Topic] ?? t));

/** A row's height before it is measured: a title, two lines of reason and the details line. */
const ROW_ESTIMATE = 96;

/** Below `lg`, rows in the page, this many at a time: a box that scrolls takes the page's swipes. */
const PAGE = 10;
const NARROW = '(max-width: 63.999rem)';

function useNarrow() {
  return useSyncExternalStore(
    (on) => {
      const q = matchMedia(NARROW);
      q.addEventListener('change', on);
      return () => q.removeEventListener('change', on);
    },
    () => matchMedia(NARROW).matches,
    () => false,
  );
}

const inTopic = (s: SnippetView, topic: string, fits: (s: SnippetView) => boolean) =>
  topic === ALL || (topic === JLENS_TOPIC ? fits(s) : s.topics.includes(topic));
const inEval = (s: SnippetView, evalName: string) => evalName === ALL || s.evalName === evalName;

/** Each key and its count, the most chats first. */
function countsOf(keys: string[], label: (k: string) => string): [string, number][] {
  const counts = new Map<string, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || label(a[0]).localeCompare(label(b[0])));
}

const topicsOf = (snippets: SnippetView[]) =>
  countsOf(
    snippets.flatMap((s) => s.topics),
    topicLabel,
  );
const evalsOf = (snippets: SnippetView[]) =>
  countsOf(
    snippets.map((s) => s.evalName),
    (e) => e,
  );

/** A model's flagged chats, the most severe first, with filters by topic and eval. In a
 * `FlaggedTopicProvider`, the pills of the topics and the evals set the filters too. The list scrolls in the height that
 * its parent gives. A model can have thousands, so only the rows in view (and a few more) render.
 * `jlensNames`: the model's name and aliases. With them, the last topic is `JLENS_TOPIC`; it loads
 * Neuronpedia's J-Lens models when the topic menu first opens. */
export function FlaggedChatFeed({
  snippets,
  jlensNames,
  className,
}: {
  snippets: SnippetView[];
  jlensNames?: string[];
  className?: string;
}) {
  const params = useSearchParams();
  const shared = useFlaggedTopic();
  const [own, setOwn] = useState<string | null>(null);
  const topic = (shared ? shared.topic : own) ?? ALL;
  const [menuOpened, setMenuOpened] = useState(false);
  const jlensModels = useJlensModels(!!jlensNames && (menuOpened || topic === JLENS_TOPIC));
  const tokenLimit =
    jlensNames && jlensModels !== undefined
      ? jlensModelFor(jlensNames, jlensModels ?? [DEFAULT_JLENS_MODEL]).model.tokenLimit
      : null;
  // A locked reply cannot go to Neuronpedia.
  const fits = useCallback(
    (s: SnippetView) => tokenLimit !== null && !s.locked && s.tokens != null && s.tokens <= tokenLimit,
    [tokenLimit],
  );
  // After the reader picks a topic, a link's chat does not change it.
  const picked = useRef(false);
  const setTopic = (t: string) => {
    picked.current = true;
    (shared?.setTopic ?? setOwn)(t === ALL ? null : t);
  };
  const list = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const prev = useRef(`${topic}\n${ALL}`);
  const markCite = useMarkCite();
  const target = runPanelFromParams(new URLSearchParams(params?.toString()))?.snippet;
  const [ownEval, setOwnEval] = useState<string | null>(null);
  const evalName = (shared ? shared.evalName : ownEval) ?? ALL;
  const setEvalName = (e: string) => {
    picked.current = true;
    (shared?.setEvalName ?? setOwnEval)(e === ALL ? null : e);
  };
  const sorted = useMemo(() => [...snippets].sort(bySeverity), [snippets]);
  // Each menu's counts are of the chats that the other filter shows.
  const topics = useMemo(() => topicsOf(snippets.filter((s) => inEval(s, evalName))), [snippets, evalName]);
  const jlensCount = useMemo(
    () => (tokenLimit === null ? null : snippets.filter((s) => inEval(s, evalName) && fits(s)).length),
    [snippets, evalName, fits, tokenLimit],
  );
  const evals = useMemo(() => evalsOf(snippets.filter((s) => inTopic(s, topic, fits))), [snippets, topic, fits]);
  const shown = useMemo(
    () => sorted.filter((s) => inTopic(s, topic, fits) && inEval(s, evalName)),
    [sorted, topic, evalName, fits],
  );
  const filtered = topic !== ALL || evalName !== ALL;
  const filters = `${topic}\n${evalName}`;
  const narrow = useNarrow();
  // The rows shown below `lg`. A new filter starts again at one page.
  const [more, setMore] = useState({ filters, n: PAGE });
  const targetAt = target ? shown.findIndex((x) => x.id === target) : -1;
  const limit = Math.max(more.filters === filters ? more.n : PAGE, targetAt + 1);
  // The compiler does not memoize this component, which the virtualizer needs.
  // eslint-disable-next-line react-hooks/incompatible-library
  const rows = useVirtualizer({
    count: shown.length,
    getScrollElement: () => list.current,
    estimateSize: () => ROW_ESTIMATE,
    getItemKey: (i) => shown[i]!.id,
    overscan: 6,
    // The server and the first render show the first rows.
    initialRect: { width: 0, height: 640 },
  });
  const items = rows.getVirtualItems();

  useEffect(() => {
    if (prev.current === filters) return;
    prev.current = filters;
    if (filtered) picked.current = true;
    list.current?.scrollTo({ top: 0 });
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // A short pulse shows that the list changed.
    box.current?.animate?.(
      [
        { boxShadow: '0 0 0 0 rgb(14 165 233 / 0.45)', backgroundColor: 'rgb(224 242 254)' },
        { boxShadow: '0 0 0 8px rgb(14 165 233 / 0)', backgroundColor: 'rgb(255 255 255)' },
      ],
      { duration: 900, easing: 'ease-out' },
    );
    list.current?.animate?.([{ opacity: 0.35 }, { opacity: 1 }], { duration: 350, easing: 'ease-out' });
  }, [filters, filtered]);

  useEffect(() => {
    const at = targetAt;
    if (at < 0 || picked.current || location.hash !== `#${EVALUATIONS_HASH}`) return;
    // After the viewer opens. The row renders only after the list scrolls to it.
    const t = setTimeout(() => {
      rows.scrollToIndex(at, { align: 'center' });
      requestAnimationFrame(() => {
        const row = list.current?.querySelector<HTMLElement>(`[data-snippet="${CSS.escape(target!)}"]`);
        if (!row) return;
        row.closest('section')?.scrollIntoView({ block: 'start' });
        markCite?.(row.querySelector('a') ?? row);
      });
    }, 150);
    return () => clearTimeout(t);
    // `rows` is a new object at each render; `shown` stands for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, shown, markCite, narrow]);
  return (
    <div
      ref={box}
      id={FLAGGED_CHATS_ID}
      className={cn(
        'flex min-h-0 scroll-mt-20 flex-col overflow-hidden rounded-md border border-slate-200 bg-white',
        className,
        narrow && 'h-auto',
      )}
    >
      <div className="flex shrink-0 flex-col gap-1.5 bg-slate-50 px-4 py-2">
        <div className="flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1">
          <div className="mr-auto flex items-center gap-x-1">
            <MessageSquareWarning aria-hidden className="size-3 shrink-0 text-slate-400" />
            <h3 className={INSET_TITLE}>Flagged Chats</h3>
            <InfoPopover label="Flagged Chats" iconClassName="size-3">
              {FLAGGED_CHATS_INFO}
            </InfoPopover>
          </div>
          {topics.length > 0 && (
            <FilterMenu
              label="Topic"
              all="All Topics"
              placeholder="Topics"
              value={topic}
              options={topics.map(([t, n]) => [t, topicLabel(t), n])}
              last={jlensNames ? [[JLENS_TOPIC, JLENS_LABEL, jlensCount, JLENS_LOOK]] : []}
              name={topicLabel}
              onChange={setTopic}
              onOpenChange={(open) => open && setMenuOpened(true)}
            />
          )}
          {evals.length > 0 && (
            <FilterMenu
              label="Evaluation"
              all="All Evaluations"
              placeholder="Evaluations"
              value={evalName}
              options={evals.map(([e, n]) => [e, e, n])}
              name={(e) => e}
              onChange={setEvalName}
            />
          )}
        </div>
        {filtered && (
          <ClearFilters
            shown={shown.length}
            total={sorted.length}
            noun="Chats"
            onClear={() => {
              setTopic(ALL);
              setEvalName(ALL);
            }}
          />
        )}
      </div>
      {shown.length && narrow ? (
        <div>
          <ul className="flex flex-col [&>li]:border-b [&>li]:border-slate-100">
            {shown.slice(0, limit).map((s, i) => (
              <FlaggedChat key={s.id} index={i} snippet={s} feed />
            ))}
          </ul>
          {shown.length > limit && (
            <button
              type="button"
              onClick={() => setMore({ filters, n: limit + PAGE })}
              className="w-full cursor-pointer py-3 text-xs font-medium text-sky-800 hover:bg-sky-50"
            >
              Show More{' '}
              <span className="font-normal text-slate-400">
                ({(shown.length - limit).toLocaleString('en-US')} left)
              </span>
            </button>
          )}
        </div>
      ) : shown.length ? (
        <div ref={list} className="min-h-0 flex-1 overflow-y-auto">
          <div className="relative" style={{ height: rows.getTotalSize() }}>
            <ul
              className="absolute inset-x-0 top-0 flex flex-col [&>li]:border-b [&>li]:border-slate-100"
              style={{ transform: `translateY(${items[0]?.start ?? 0}px)` }}
            >
              {items.map((v) => (
                <FlaggedChat key={v.key} ref={rows.measureElement} index={v.index} snippet={shown[v.index]!} feed />
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p className="px-4 py-6 text-center text-xs text-slate-500">No flagged chats.</p>
      )}
    </div>
  );
}
