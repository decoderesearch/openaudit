'use client';

import { MEDALS } from '@/components/catalog/leaders';
import { InfoPopover } from '@/components/info-popover';
import Link from '@/components/link';
import { RunLink, useRunViewerIfAny } from '@/components/pdf-viewer';
import {
  coreCount,
  coreFirst,
  coreRows,
  formatValue,
  median,
  ordinal,
  variantMedians,
  variantPath,
  type BoardRow,
  type BoardVariant,
} from '@/lib/methods';
import { panelFromPath } from '@/lib/run-panel';
import { cn } from '@/lib/utils';
import type { Direction } from '@openaudit/spec';
import { useRouter } from 'nextjs-toploader/app';
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { condense, GapRow } from './condense';
import { CELL, Frame } from './highlight';
import { useModelFilter } from './model-filter';
import type { SubjectLink } from './subject-board';
import { TABLE, TABLE_BOX, THEAD } from './table';

const STICKY = 'sticky left-0 z-10 bg-white';
const STICKY_HEAD = 'sticky left-0 z-10 bg-slate-50';
/** The median column stays at the right of the variant column, as wide as `--lead`. */
const STICKY_MEDIAN = 'sticky left-(--lead) z-10';

/**
 * Variants by subject models on one metric: `SubjectBoard` with rows and columns swapped. Each
 * column ranks its own variants: first place is green. Rows go by median, best first, with a medal
 * for the top three. A subject's `href` opens from any cell of its column: a run opens in the
 * viewer when there is one, and with Ctrl or Cmd in a new tab. Hover frames the column.
 * `tone`: the color of the hover frame. `highlight`: the id of a variant whose row has a sky frame.
 * `filter`: the column of the page's model filter (`useModelFilter`) has a frame; else the column
 * `selected` has one.
 */
export function SubjectColumns({ filter, ...props }: Props & { filter?: boolean }) {
  return filter ? <FilterColumns {...props} /> : <Columns {...props} />;
}

/** A `SubjectColumns` head: the metric name, with how to read the board on hover. `order`: the
 * label of the column order, if the columns have one. */
export function MetricLabel({ name, order }: { name: string; order?: string }) {
  return (
    <span className="inline-flex items-center gap-x-1">
      {name}
      <InfoPopover label={name} iconClassName="size-3">
        {name} of each variant, one column for each model. Each column ranks its own variants; green is first. Rows go
        by median, best first. Baselines are references, not ranked. Click a column to open that model&apos;s run and
        read its chats.
        {order && <> Columns are by {order}, highest first.</>}
      </InfoPopover>
    </span>
  );
}

function FilterColumns(props: Props) {
  const [model] = useModelFilter();
  return <Columns {...props} selected={model} />;
}

type Props = {
  rows: BoardRow[];
  variants: BoardVariant[];
  subjects: Record<string, SubjectLink>;
  /** The head of the variant column. Default: "Method Variant". */
  label?: ReactNode;
  /** The label of the sort row (a capability index). No row without it. */
  orderLabel?: string;
  direction: Direction;
  tone?: 'sky' | 'slate';
  highlight?: string;
  /** Only the top three and `highlight`, and no baselines. */
  condensed?: boolean;
  /** The id of the one variant to show. Each cell has its place ("2nd of 6") above its value. */
  only?: string;
  className?: string;
  /** A bar above the table, as the first row of its head. */
  header?: ReactNode;
  /** In place of the median column: this row's values, which also rank the rows. */
  summary?: { label: ReactNode; row: BoardRow };
  /** A click on a column calls this with its subject, not the subject's `href`. */
  onPick?: (subject: string) => void;
  selected?: string | null;
  /** The models that rank the rows: the median is over them, and a variant needs a value on each. */
  core?: string[];
};

function Columns({
  rows: allRows,
  variants,
  subjects,
  orderLabel,
  direction,
  tone = 'sky',
  highlight,
  condensed,
  only,
  label,
  className,
  header,
  summary,
  onPick,
  selected,
  core: coreProp,
}: Props) {
  const router = useRouter();
  const openRun = useRunViewerIfAny();
  const [hover, setHover] = useState<string>();
  const lead = useRef<HTMLTableCellElement>(null);
  const [leadWidth, setLeadWidth] = useState(0);
  useEffect(() => {
    const cell = lead.current;
    if (!cell) return;
    const observer = new ResizeObserver(() => setLeadWidth(cell.offsetWidth));
    observer.observe(cell);
    return () => observer.disconnect();
  }, []);
  // The summary row has the core rule in it already.
  const core = summary ? undefined : coreProp?.length ? coreProp : undefined;
  const rows = coreFirst(allRows, core);
  const ranks = summary ? [summary.row] : rows;
  const present = variants.filter((v) =>
    [...rows, ...ranks].some((r) => r.cells.has(v.id) || r.baselineValues.has(v.id)),
  );
  const medians = variantMedians(
    ranks,
    present.filter((v) => !v.baseline),
    direction,
    core,
  );
  const ranked = medians.map((m) => m.variant);
  const best = medians.length > 1 ? medians[0].median : undefined;
  const shown = [...ranked, ...present.filter((v) => !ranked.includes(v))];
  const listed = only
    ? shown.filter((v) => v.id === only)
    : condensed
      ? condense(ranked, (v) => v.id === highlight)
      : shown;
  /** "2nd" above the value. */
  const placed = (rank: number, value: string) => (
    <>
      {ordinal(rank)}
      <span className="block text-[10px] font-normal opacity-75">{value}</span>
    </>
  );
  const lastAt = listed.findLastIndex(Boolean);
  const medal = (v: BoardVariant) => (ranked.length > 1 ? MEDALS[ranked.indexOf(v)] : undefined);
  const valueOf = (r: BoardRow, id: string) => r.cells.get(id)?.value ?? r.baselineValues.get(id) ?? null;
  const linkOf = (r: BoardRow) => subjects[r.subject] ?? { label: r.subject };
  /** The props of each cell of a subject's column. */
  const column = (r: BoardRow) => {
    if (onPick) {
      return {
        onMouseEnter: () => setHover(r.subject),
        onClick: () => onPick(r.subject),
        className: cn('cursor-pointer', (hover === r.subject || selected === r.subject) && CELL),
      };
    }
    const href = linkOf(r).href;
    const panel = href ? panelFromPath(href) : null;
    const go = (e: MouseEvent) => {
      if (!href || (e.target as Element).closest('a')) return;
      if (e.button === 1 || e.metaKey || e.ctrlKey) window.open(href, '_blank', 'noopener');
      else if (e.button === 0 && openRun && panel) openRun(panel);
      else if (e.button === 0) router.push(href);
    };
    const lit = hover === r.subject || selected === r.subject;
    return {
      onMouseEnter: () => setHover(r.subject),
      onClick: href ? go : undefined,
      onAuxClick: href ? go : undefined,
      className: cn(href && 'cursor-pointer', lit && CELL),
    };
  };
  const lit = (r: BoardRow) => hover === r.subject || selected === r.subject;
  return (
    <div className={cn(TABLE_BOX, className)} onMouseLeave={() => setHover(undefined)}>
      {header && (
        <div className={cn(THEAD, 'sticky left-0 flex items-center justify-between gap-x-2 px-4 pt-2 pb-0.5')}>
          {header}
        </div>
      )}
      <table className={TABLE} style={{ '--lead': `${leadWidth}px` } as CSSProperties}>
        <thead className={THEAD}>
          <tr>
            {/* The left padding puts the label after the medals. The widths make the model columns
                the same width. */}
            <th
              ref={lead}
              className={cn(
                STICKY_HEAD,
                'w-px py-2 pr-4 pl-[2.625rem] align-bottom',
                label ? 'font-semibold' : 'font-medium',
              )}
            >
              {label ?? 'Method Variant'}
            </th>
            <th
              className={cn(
                STICKY_MEDIAN,
                'w-20 bg-slate-50 px-3 py-2 text-right align-bottom font-medium',
                summary && 'whitespace-nowrap',
              )}
            >
              {summary?.label ?? (core ? 'Core Median' : 'Median')}
            </th>
            {rows.map((r) => {
              const s = linkOf(r);
              const c = column(r);
              return (
                <th
                  key={r.subject}
                  {...c}
                  className={cn(
                    'w-24 min-w-24 px-1.5 py-2 text-right align-bottom font-medium',
                    c.className,
                    lit(r) && (tone === 'sky' ? 'text-sky-900' : 'text-slate-900'),
                  )}
                >
                  {lit(r) && <Frame edge="top" tone={tone} />}
                  {core?.includes(r.subject) && (
                    <span className="block text-[9px] font-semibold tracking-wide text-sky-700 uppercase">Core</span>
                  )}
                  {/* No width of its own, so a long name does not widen its column; it fills the
                      column and ends with "…". */}
                  <span title={s.label} className="block w-0 min-w-full truncate">
                    {s.href ? (
                      <RunLink
                        href={s.href}
                        className={cn(
                          'hover:text-slate-900 hover:underline',
                          selected === r.subject ? 'text-slate-900' : 'text-slate-600',
                        )}
                      >
                        {s.label}
                      </RunLink>
                    ) : (
                      s.label
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
          {orderLabel && (
            <tr>
              <th className={cn(STICKY_HEAD, 'px-4 py-1.5 font-medium')}>{orderLabel}</th>
              <th className={cn(STICKY_MEDIAN, 'bg-slate-50')} />
              {rows.map((r) => (
                <th
                  key={r.subject}
                  {...column(r)}
                  className={cn('px-1.5 py-1.5 text-right font-normal tabular-nums', column(r).className)}
                >
                  {lit(r) && <Frame tone={tone} />}
                  {r.order ?? '—'}
                </th>
              ))}
            </tr>
          )}
        </thead>
        <tbody className="divide-y divide-slate-100">
          {listed.map((v, i) => {
            if (!v) return <GapRow key={`gap-${i}`} span={rows.length + 2} />;
            const last = i === lastAt;
            const xs = coreRows(ranks, core).flatMap((r) => valueOf(r, v.id) ?? []);
            // With core models, a variant without a value on each has no rank and no median.
            const have = core && !v.baseline ? coreCount(ranks, v.id, core) : null;
            const m = have != null && have < core!.length ? null : median(xs);
            const top = !v.baseline && m != null && m === best;
            const mine = !only && v.id === highlight;
            const place = ranked.indexOf(v) + 1;
            return (
              <tr key={v.id} className="hover:bg-slate-50/60">
                <th
                  scope="row"
                  className={cn(
                    STICKY,
                    'px-4 py-2.5 text-left text-[13.5px] leading-tight font-medium whitespace-nowrap',
                    v.baseline && 'italic',
                    mine && 'font-semibold',
                  )}
                >
                  {mine && <Frame row edge="left" />}
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className={cn(
                        'w-5 text-center leading-none',
                        medal(v) ? 'text-base' : 'text-[10px] font-normal text-slate-500 tabular-nums',
                      )}
                      aria-hidden={!!medal(v)}
                    >
                      {medal(v) ?? (only && place > 0 && ranked.length > 1 ? ordinal(place) : null)}
                    </span>
                    <span className="flex flex-col">
                      <Link href={variantPath(v.method.slug, v.slug)} className="text-sky-800 hover:underline">
                        {v.displayName}
                      </Link>
                      {v.author && <span className="text-[10px] font-normal text-slate-400">{v.author}</span>}
                    </span>
                  </span>
                </th>
                <td
                  className={cn(
                    STICKY_MEDIAN,
                    'bg-slate-50 px-3 py-2.5 text-right text-xs whitespace-nowrap text-slate-600 tabular-nums',
                    top && 'bg-emerald-50 font-semibold text-emerald-900',
                  )}
                >
                  {mine && <Frame row edge={rows.length ? undefined : 'right'} green={top} />}
                  {m == null && have != null ? (
                    <span
                      className="text-[10px] text-slate-400"
                      title={`Not ranked: a value on ${have} of ${core!.length} core models`}
                    >
                      {have} of {core!.length} core
                    </span>
                  ) : m == null ? (
                    '—'
                  ) : only && place > 0 && ranked.length > 1
                      ? placed(place, formatValue(m))
                      : formatValue(m)}
                </td>
                {rows.map((r, j) => {
                  const cell = r.cells.get(v.id);
                  const base = r.baselineValues.get(v.id);
                  const first = cell?.rank === 1 && r.cells.size > 1;
                  const c = column(r);
                  return (
                    <td
                      key={r.subject}
                      {...c}
                      className={cn(
                        'px-1.5 py-2.5 text-right text-xs whitespace-nowrap tabular-nums',
                        first && 'bg-emerald-50 font-semibold text-emerald-900',
                        !cell && base == null && 'text-slate-300',
                        base != null && 'text-slate-500 italic',
                        c.className,
                        mine && CELL,
                      )}
                      title={cell ? `Rank ${cell.rank} of ${r.cells.size}` : undefined}
                    >
                      {mine && <Frame row edge={j === rows.length - 1 ? 'right' : undefined} green={first} />}
                      {lit(r) && <Frame edge={last ? 'bottom' : undefined} green={first} tone={tone} />}
                      {cell && only && r.cells.size > 1
                        ? placed(cell.rank, formatValue(cell.value))
                        : cell
                          ? formatValue(cell.value)
                          : base != null
                            ? formatValue(base)
                            : '—'}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
