import { MEDALS } from '@/components/catalog/leaders';
import { EvalLink } from '@/components/eval-link';
import { InfoPopover } from '@/components/info-popover';
import Link from '@/components/link';
import { byMeanRank, jobLabel, ordinal, variantPath, type ScoreRow, type VariantView } from '@/lib/methods';
import { cn } from '@/lib/utils';
import { MetricPick } from './metric-choice';
import { TABLE, TABLE_BOX, THEAD } from './table';

const STICKY = 'sticky left-0 z-10 bg-white';
const STICKY_HEAD = 'sticky left-0 z-10 bg-slate-50';

/**
 * `Scorecard` with rows and columns swapped: a row for each variant, a column for each job. Each
 * column ranks its own variants: first place is green. Rows go best first: by rank with one job,
 * else by mean rank. The top three have a medal, the others their place. With more jobs, each
 * cell has its place above its value. Baselines are rows at the end, not ranked.
 * With one job, an empty last column keeps the values next to the names. `evalPage`: the page names the eval, so the column shows only its metric.
 * `only`: the id of the one variant to show, with no baselines or header names but the evals'; each place says "of N".
 */
export function ScoreRows({
  rows,
  variants,
  method,
  empty = 'No value in this group',
  evalPage,
  only,
  className,
}: {
  rows: ScoreRow[];
  variants: VariantView[];
  method: string;
  /** The tooltip for a dash. */
  empty?: string;
  evalPage?: boolean;
  only?: string;
  className?: string;
}) {
  const { compared, ranked } = byMeanRank(rows, variants);
  const listed = only ? compared.filter((v) => v.id === only) : compared;
  const baselines = only
    ? []
    : variants.filter((v) => v.baseline && rows.some((r) => r.baselines.some((b) => b.variant.id === v.id)));
  const place = (v: VariantView) => {
    const i = ranked.indexOf(v);
    if (i < 0 || ranked.length < 2) return undefined;
    return { text: MEDALS[i] ?? ordinal(i + 1), medal: i < MEDALS.length };
  };
  const many = rows.length > 1;
  const fill = !many && <td aria-hidden />;
  return (
    <div className={cn(TABLE_BOX, className)}>
      <table className={TABLE}>
        <thead className={THEAD}>
          <tr>
            {/* The left padding puts the label after the medals. */}
            <th className={cn(STICKY_HEAD, 'w-px py-2 pr-4 pl-[2.625rem] align-bottom font-medium')}>
              {!only && 'Method Variant'}
            </th>
            {rows.map((r) => (
              <th
                key={`${r.job.eval.slug}:${r.job.metric.key}`}
                className="w-24 min-w-24 px-2 py-2 text-right align-bottom leading-tight font-medium"
              >
                {evalPage ? (
                  r.job.metric.displayName
                ) : (
                  <>
                    <EvalLink slug={r.job.eval.slug} className="text-sky-800 hover:underline">
                      {jobLabel(r.job.eval)}
                    </EvalLink>
                    {!only && (
                      <span className="block text-[10px] font-normal text-slate-500">{r.job.metric.displayName}</span>
                    )}
                  </>
                )}
              </th>
            ))}
            {!many && <th aria-hidden />}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {listed.map((v) => (
            <tr key={v.id} className="hover:bg-slate-50/60">
              <VariantHead variant={v} method={method} place={place(v)} />
              {rows.map((r) => {
                const cell = r.cells.get(v.id);
                const first = cell?.rank === 1 && r.count > 1;
                return (
                  <td
                    key={`${r.job.eval.slug}:${r.job.metric.key}`}
                    className={cn(
                      'px-2 py-2.5 text-right text-xs whitespace-nowrap tabular-nums',
                      !cell && 'text-slate-300',
                      first && 'bg-emerald-50 font-semibold text-emerald-900',
                      cell && cell.rank === r.count && r.count > 2 && 'text-slate-400',
                    )}
                    title={cell ? `Rank ${cell.rank} of ${r.count}` : empty}
                  >
                    {!cell ? (
                      '—'
                    ) : many ? (
                      <>
                        {ordinal(cell.rank)}
                        {only && <span className="font-normal text-slate-400"> of {r.count}</span>}
                        <span className="block text-[10px] font-normal opacity-75">{cell.value.toFixed(3)}</span>
                      </>
                    ) : (
                      cell.value.toFixed(3)
                    )}
                  </td>
                );
              })}
              {fill}
            </tr>
          ))}
          {baselines.map((v) => (
            <tr key={v.id} className="hover:bg-slate-50/60">
              <VariantHead variant={v} method={method} />
              {rows.map((r) => {
                const values = r.baselines.filter((b) => b.variant.id === v.id).map((b) => b.value.toFixed(3));
                return (
                  <td
                    key={`${r.job.eval.slug}:${r.job.metric.key}`}
                    className={cn(
                      'px-2 py-2.5 text-right text-xs whitespace-nowrap italic tabular-nums',
                      values.length ? 'text-slate-500' : 'text-slate-300',
                    )}
                  >
                    {values.length ? values.join(', ') : '—'}
                  </td>
                );
              })}
              {fill}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One variant's place on each metric, as a grid of cells (up to 4 across). First place is green.
 * A click on a cell shows the samples of the eval `scope` by its metric. */
export function MetricCells({ rows, only, scope }: { rows: ScoreRow[]; only: string; scope: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {rows.map((r) => {
        const cell = r.cells.get(only);
        const first = cell?.rank === 1 && r.count > 1;
        const { metric } = r.job;
        return (
          <MetricPick
            key={`${r.job.eval.slug}:${metric.key}`}
            scope={scope}
            metric={metric.key}
            label={metric.displayName}
            className={cn(
              'flex flex-col gap-1 rounded-md border px-3 py-2 text-xs tabular-nums',
              first
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-slate-200 bg-slate-50 text-slate-700',
            )}
          >
            <span className="text-[11px] leading-tight font-medium text-slate-600">
              {metric.displayName}
              {metric.description && (
                <InfoPopover
                  label={metric.displayName}
                  iconClassName="size-3"
                  triggerClassName="relative z-10 ml-1 align-[-2px]"
                  contentClassName="text-xs"
                >
                  {metric.description}
                </InfoPopover>
              )}
            </span>
            {cell ? (
              <span>
                <span className="font-semibold">{ordinal(cell.rank)}</span>
                <span className="ml-1.5 text-[10px] opacity-75">{cell.value.toFixed(3)}</span>
              </span>
            ) : (
              <span className="text-slate-300">—</span>
            )}
          </MetricPick>
        );
      })}
    </div>
  );
}

/** A row's head: the medal or place, the variant's name and its authors. A baseline is in italics. */
function VariantHead({
  variant: v,
  method,
  place,
}: {
  variant: VariantView;
  method: string;
  place?: { text: string; medal: boolean };
}) {
  return (
    <th
      scope="row"
      className={cn(
        STICKY,
        'px-4 py-2.5 text-left text-[13.5px] leading-tight font-medium whitespace-nowrap',
        v.baseline && 'italic',
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          className={cn(
            'w-5 text-center leading-none',
            place?.medal ? 'text-base' : 'text-[10px] font-normal text-slate-500 tabular-nums',
          )}
          aria-hidden={place?.medal}
        >
          {place?.text}
        </span>
        <span className="flex flex-col">
          <Link href={variantPath(method, v.slug)} className="text-sky-800 hover:underline">
            {v.displayName}
          </Link>
          {v.author && <span className="text-[10px] font-normal text-slate-400">{v.author}</span>}
        </span>
      </span>
    </th>
  );
}
