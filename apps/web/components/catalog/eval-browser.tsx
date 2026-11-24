'use client';

import { EVAL_STATUS_LABELS } from '@/components/catalog/eval-status';
import { ClearFilters } from '@/components/catalog/filter-menu';
import { BestWorst, Leaders } from '@/components/catalog/leaders';
import { Branch } from '@/components/catalog/method-browser';
import { TOPIC_LABELS } from '@/components/catalog/parts';
import { BoxTitle, SearchToggle } from '@/components/catalog/title-search';
import { AboutLink, EvalLink } from '@/components/eval-link';
import { Input } from '@/components/ui/input';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { monthYear } from '@/lib/card-heading';
import { evalListQuery, isDefaultFilter, type EvalKind, type EvalListFilter } from '@/lib/eval-list-filter';
import type { Leader } from '@/lib/leaders';
import { suitePath } from '@/lib/methods';
import { cn } from '@/lib/utils';
import type { EvalStatus } from '@openaudit/spec';
import { Search, X } from 'lucide-react';
import { useRouter } from 'nextjs-toploader/app';
import { useMemo, useState, type MouseEvent, type ReactNode } from 'react';

/** One model or method eval in the list. `creator`, `date`, `summary`: as in its `EvalHover`. `count`: the
 * models with a finished public run, or the method variants with a result. `worst` and `best`: the
 * 3 at each end of its ranking. */
export type EvalListRow = {
  slug: string;
  label: string;
  kind: 'model' | 'method';
  creator: string | null;
  date: string | null;
  summary: string | null;
  status: EvalStatus;
  topics: string[];
  count: number;
  /** A model eval: how many of the `count` models came out after it. */
  newer?: number;
  worst: Leader[];
  best: Leader[];
  /** The first 3, which can overlap `worst`. */
  top?: Leader[];
  /** The suite that the eval is part of. A podium list shows its evals as a tree under it. */
  suite?: SuiteInfo;
};

export type SuiteInfo = {
  slug: string;
  label: string;
  summary: string;
  creator: string | null;
  date: string | null;
  /** Its eval slugs in display order. Others follow in list order. */
  order: string[];
};

type Suited = { slug: string; label: string; suite?: SuiteInfo };
type Item<T extends Suited> = { row: T } | { suite: SuiteInfo; rows: T[] };

/** The suite's hover card. */
export const suiteHover = (s: SuiteInfo) => ({
  name: s.label,
  creator: s.creator,
  date: s.date,
  summary: s.summary,
  topics: [],
});

/** The rows, with each suite's rows together at the place of its first row. A suite with one
 * shown row is a plain row. */
export function bySuite<T extends Suited>(rows: T[]): Item<T>[] {
  const items: Item<T>[] = [];
  const groups = new Map<string, T[]>();
  for (const r of rows) {
    if (!r.suite) {
      items.push({ row: r });
      continue;
    }
    const group = groups.get(r.suite.slug);
    if (group) group.push(r);
    else {
      groups.set(r.suite.slug, [r]);
      items.push({ suite: r.suite, rows: groups.get(r.suite.slug)! });
    }
  }
  const at = (r: T) => {
    const i = r.suite!.order.indexOf(r.slug);
    return i < 0 ? Infinity : i;
  };
  return items.map((i) => {
    if (!('rows' in i)) return i;
    if (i.rows.length === 1) return { row: i.rows[0] };
    return { ...i, rows: i.rows.toSorted((a, b) => (at(a) === at(b) ? 0 : at(a) - at(b))) };
  });
}

/** An eval's name under its suite, with no suite name in front ("SAEBench SCR" is "SCR"). */
export const childLabel = (r: Suited) =>
  r.suite && r.label.startsWith(`${r.suite.label} `) ? r.label.slice(r.suite.label.length + 1) : r.label;

const TREE_LINE =
  "before:absolute before:left-[26px] before:w-px before:bg-slate-300 before:content-[''] sm:before:left-[30px]";

const KIND_OF_ROW: Record<EvalKind, EvalListRow['kind']> = { models: 'model', methods: 'method' };
const SHOW = [
  { value: 'public', label: 'Public' },
  { value: 'all', label: 'All' },
] as const;

const topicName = (v: string) => (TOPIC_LABELS as Record<string, string>)[v] ?? v.replaceAll('_', ' ');
const ofKind = (row: EvalListRow, kind: EvalKind) => row.kind === KIND_OF_ROW[kind];
const shownBy = (row: EvalListRow, filter: EvalListFilter) => filter.show === 'all' || row.count > 0;

/** The search text is in the eval's name, creator or topics. */
function found(row: EvalListRow, q: string | undefined) {
  if (!q) return true;
  const text = [row.label, row.creator ?? '', ...row.topics.map(topicName)].join(' ');
  return text.toLowerCase().includes(q.trim().toLowerCase());
}

/** The evals of `kind`. Above them: a search toggle, and at the right the Show toggle. `filter`: from the URL. A
 * change of filter updates the URL. `title`: a white head with `titleIcon` and the title, and at the
 * right the search toggle (no Show) or `action`, as an `InfiniteFeed` with `inset`. `podium`: each row shows its
 * summary, and its best 3 with medals at the right (no worst). */
export function EvalBrowser({
  rows,
  kind,
  filter: initial,
  title,
  titleIcon,
  titleInfo,
  podium = false,
  search = true,
  action,
  chain = false,
  id,
  className,
}: {
  rows: EvalListRow[];
  kind: EvalKind;
  filter: EvalListFilter;
  title?: string;
  titleIcon?: ReactNode;
  /** Shown from a help icon at the right of `title`. */
  titleInfo?: ReactNode;
  podium?: boolean;
  /** The search toggle at the right of `title`. */
  search?: boolean;
  /** At the right of `title`. */
  action?: ReactNode;
  /** At the end of the list's scroll, the page scrolls on. */
  chain?: boolean;
  /** An anchor id for the section, so a link can jump to it. It clears the navbar. */
  id?: string;
  className?: string;
}) {
  const [filter, setFilter] = useState<EvalListFilter>(initial);
  const [searching, setSearching] = useState(!!initial.q);
  const mine = useMemo(() => rows.filter((r) => ofKind(r, kind)), [rows, kind]);
  const shown = useMemo(() => mine.filter((r) => shownBy(r, filter) && found(r, filter.q)), [mine, filter]);
  const set = (next: EvalListFilter) => {
    setFilter(next);
    const url = new URL(location.href);
    for (const k of ['show', 'q']) url.searchParams.delete(k);
    for (const [k, v] of new URLSearchParams(evalListQuery(next))) url.searchParams.set(k, v);
    history.replaceState(null, '', url);
  };
  const closeSearch = () => {
    setSearching(false);
    set({ ...filter, q: undefined });
  };
  return (
    <section
      id={id}
      aria-label="Evaluations"
      className={cn(
        'isolate flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white',
        id && 'scroll-mt-20',
        className,
      )}
    >
      {title ? (
        <div className="shrink-0 bg-slate-50">
          <div className="flex h-10 items-center justify-between gap-x-3 pr-4 pl-2 sm:pr-5 sm:pl-3">
            <BoxTitle title={title} icon={titleIcon} info={titleInfo} />
            {search && (
              <SearchToggle
                open={searching}
                onOpenChange={setSearching}
                value={filter.q ?? ''}
                onChange={(q) => set({ ...filter, q: q || undefined })}
                placeholder="Search Evaluations"
              />
            )}
            {action}
          </div>
          {!isDefaultFilter(filter) && (
            <div className="px-5 pb-2 sm:px-6">
              <ClearFilters
                shown={shown.length}
                total={mine.length}
                noun="Evaluations"
                onClear={() => {
                  setSearching(false);
                  set({});
                }}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="flex shrink-0 flex-col gap-2 bg-slate-50 px-4 py-2">
          <div className="flex items-center gap-x-2">
            <button
              type="button"
              aria-label="Show search"
              aria-expanded={searching}
              onClick={() => (searching ? closeSearch() : setSearching(true))}
              className={cn(
                '-mr-0.5 flex h-6 w-4 shrink-0 cursor-pointer items-center justify-center transition-colors',
                searching ? 'text-sky-800' : 'text-slate-500 hover:text-slate-800',
              )}
            >
              {searching ? <X className="size-3.5" /> : <Search className="size-3.5" />}
            </button>
            <SegmentedToggle
              label="Show"
              value={filter.show ?? 'public'}
              options={SHOW}
              onValueChange={(v) => v && set({ ...filter, show: v === 'all' ? 'all' : undefined })}
              className="ml-auto"
            />
          </div>
          {searching && (
            <Input
              type="search"
              autoFocus
              aria-label="Search evaluations"
              placeholder="Search Evaluations"
              value={filter.q ?? ''}
              onChange={(e) => set({ ...filter, q: e.target.value || undefined })}
              onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
              className="h-7 bg-white text-xs sm:h-7 md:text-xs"
            />
          )}
          {!isDefaultFilter(filter) && (
            <ClearFilters
              shown={shown.length}
              total={mine.length}
              noun="Evaluations"
              onClear={() => {
                setSearching(false);
                set({});
              }}
            />
          )}
        </div>
      )}
      <div className={cn('min-h-0 flex-1 overflow-y-auto', !chain && 'overscroll-contain')}>
        {shown.length && podium ? (
          <ul className="py-1.5">
            {bySuite(shown).map((item) =>
              'row' in item ? (
                <PodiumRow key={item.row.slug} row={item.row} />
              ) : (
                <SuiteGroup key={item.suite.slug} suite={item.suite} rows={item.rows} />
              ),
            )}
          </ul>
        ) : shown.length ? (
          <ul className="divide-y divide-slate-100">
            {shown.map((r) => (
              <Row key={r.slug} row={r} inline={!!title} />
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-center text-xs text-slate-500">No evaluations match these filters.</p>
        )}
      </div>
    </section>
  );
}

/** Opens `href` on a click that is not on a link or a text selection. */
function useOpenRow(href: string) {
  const router = useRouter();
  return (ev: MouseEvent) => !(ev.target as Element).closest('a') && !getSelection()?.toString() && router.push(href);
}

/** A suite as in the Methods page's list: a header that opens it, with its creator and date at the
 * right. Then its summary next to the tree line, and its evals as branches of the
 * tree. Only the name shows its card. */
function SuiteGroup({ suite, rows }: { suite: SuiteInfo; rows: EvalListRow[] }) {
  const open = useOpenRow(suitePath(suite.slug));
  const date = monthYear(suite.date);
  return (
    <li className="py-1.5">
      <div onClick={open} className="group/head relative cursor-pointer transition-colors hover:bg-sky-50">
        <div className="flex items-baseline gap-x-1.5 pt-2 pr-4 pb-1 pl-5 sm:pr-5 sm:pl-6">
          <AboutLink
            href={suitePath(suite.slug)}
            info={suiteHover(suite)}
            className="max-w-full shrink-0 truncate text-base leading-6 font-semibold text-slate-800 group-hover/head:text-sky-800 group-hover/head:underline"
          >
            {suite.label}
          </AboutLink>
          {(suite.creator || date) && (
            <span className="ml-auto min-w-0 truncate text-[11px] text-slate-400">
              {suite.creator}
              {suite.creator && date && ' · '}
              {date}
            </span>
          )}
        </div>
        <p
          className={cn(
            'relative pr-4 pl-10 text-[11px] leading-snug text-slate-500 sm:pr-5 sm:pl-11',
            TREE_LINE,
            'before:inset-y-0',
          )}
        >
          {suite.summary}
        </p>
      </div>
      <ul
        aria-label={`${suite.label} evaluations`}
        className={cn('relative pt-1.5', TREE_LINE, 'before:top-0 before:h-1.5')}
      >
        {rows.map((r) => (
          <PodiumRow key={r.slug} row={r} tree />
        ))}
      </ul>
    </li>
  );
}

/** A click on the row opens the eval. At the left: the name and its topic, the creator and date,
 * and the summary. At the right (else under): the best 3, with medals. `tree`: a branch of its suite,
 * with no suite name and no creator or date. */
function PodiumRow({ row: r, tree = false }: { row: EvalListRow; tree?: boolean }) {
  const open = useOpenRow(`/evaluations/${r.slug}`);
  const top = r.top ?? r.best;
  const status = r.status !== 'active' && EVAL_STATUS_LABELS[r.status];
  const topic = r.topics.slice(0, 1).map(topicName)[0];
  const date = monthYear(r.date);
  return (
    <li
      onClick={open}
      className="group/eval group/variant @container relative cursor-pointer transition-colors hover:bg-sky-50"
    >
      {tree && <Branch className={cn('left-[26px] sm:left-[30px]', status ? '[--branch:33px]' : '[--branch:20px]')} />}
      <div
        className={cn(
          'grid grid-cols-1 gap-x-4 gap-y-2 pr-4 sm:pr-5 @min-[30rem]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]',
          tree ? 'py-2.5 pl-10 sm:pl-11' : 'py-3.5 pl-5 sm:pl-6',
        )}
      >
        <div className="flex min-w-0 flex-col">
          {status && (
            <span className="block truncate text-[9px] font-bold tracking-wide text-slate-500 uppercase">{status}</span>
          )}
          <span className="flex min-w-0 items-baseline gap-x-2">
            <EvalLink
              slug={r.slug}
              className={cn(
                'block min-w-0 truncate font-semibold text-slate-800 group-hover/eval:text-sky-800 group-hover/eval:underline',
                tree ? 'text-sm' : 'text-base',
              )}
            >
              {tree ? childLabel(r) : r.label}
            </EvalLink>
            {topic && (
              <span className="shrink-0 text-[9px] font-bold tracking-wide text-slate-300 uppercase">{topic}</span>
            )}
          </span>
          {!tree && (r.creator || date) && (
            <span className="truncate text-[11px] text-slate-400">
              {r.creator}
              {r.creator && date && ' · '}
              {date}
            </span>
          )}
          {r.summary && <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-slate-500">{r.summary}</p>}
        </div>
        {top.length > 0 && (
          <Leaders
            leaders={top}
            medals
            scores={false}
            barClassName="h-2"
            nameClassName="text-xs"
            className="gap-y-2 self-start @min-[30rem]:pt-3 [&_a]:font-medium [&_a]:text-slate-600"
          />
        )}
      </div>
    </li>
  );
}

/** A click on the row opens the eval; a click on a link opens the link. Above the name: its status
 * and first topic; under it, its creator and date. `inline`, as in a titled list: the creator above
 * the name, the topic and date at its right, and no ranks. */
function Row({ row: r, inline }: { row: EvalListRow; inline: boolean }) {
  const open = useOpenRow(`/evaluations/${r.slug}`);
  const status = r.status !== 'active' && EVAL_STATUS_LABELS[r.status];
  const tags = r.topics.slice(0, 1).map(topicName);
  const date = monthYear(r.date);
  const above = inline ? [r.creator].filter((c) => c != null) : tags;
  const name = (
    <EvalLink
      slug={r.slug}
      className={cn(
        'block w-fit max-w-full truncate font-semibold text-slate-800 group-hover/eval:text-sky-800 group-hover/eval:underline',
        inline ? 'shrink-0 text-sm' : 'text-[15px]',
      )}
    >
      {r.label}
    </EvalLink>
  );
  return (
    <li
      onClick={open}
      className={cn(
        'group/eval flex cursor-pointer flex-col gap-y-1.5 transition-colors hover:bg-sky-50',
        inline ? 'py-3.5 pr-4 pl-5 sm:pr-5 sm:pl-6' : 'px-4 py-2.5',
      )}
    >
      <div className="min-w-0">
        {(status || above.length > 0) && (
          <span className="block truncate text-[9px] font-bold tracking-wide text-slate-400 uppercase">
            {status && <span className="text-slate-500">{status}</span>}
            {status && above.length > 0 && ' · '}
            {above.join(' · ')}
          </span>
        )}
        {inline ? (
          <span className="flex min-w-0 items-baseline gap-x-1.5">
            {name}
            {(tags.length > 0 || date) && (
              <span className="flex min-w-0 items-baseline gap-x-1 text-[11px] text-slate-400">
                {tags.length > 0 && <span className="truncate">{tags.join(' · ')}</span>}
                {tags.length > 0 && date && <span className="shrink-0">·</span>}
                {date && <span className="shrink-0 text-slate-400">{date}</span>}
              </span>
            )}
          </span>
        ) : (
          <>
            {name}
            {(r.creator || date) && (
              <span className="block truncate text-[11px] text-slate-500">
                {r.creator}
                {r.creator && date && ' · '}
                {date && <span className="text-slate-400">{date}</span>}
              </span>
            )}
          </>
        )}
      </div>
      {r.worst.length + r.best.length > 0 && (
        <BestWorst
          best={r.best}
          worst={r.worst}
          ranked={!inline}
          warnBest
          className={inline ? 'pl-3 [&_ol_a]:font-medium [&_ol_a]:text-slate-600' : 'pl-1.5'}
        />
      )}
    </li>
  );
}
