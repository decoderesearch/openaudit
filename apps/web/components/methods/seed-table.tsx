import { MEDALS } from '@/components/catalog/leaders';
import { InfoPopover } from '@/components/info-popover';
import Link from '@/components/link';
import { LinkRow } from '@/components/link-row';
import {
  artifactPath,
  evalVariantPath,
  formatValue,
  ordinal,
  placeText,
  type SeedCell,
  type SeedRow,
} from '@/lib/methods';
import { cn } from '@/lib/utils';
import type { MetricDef } from '@openaudit/spec';
import { ROW, TABLE, TABLE_BOX, THEAD } from './table';

/** One significant digit. */
const errorText = (stderr: number) => `± ${stderr.toPrecision(1)}`;

function Head({ metric }: { metric: MetricDef }) {
  return (
    <th className="px-2 py-2 text-right font-medium">
      {metric.displayName}
      {metric.description && (
        <InfoPopover
          label={metric.displayName}
          iconClassName="size-3"
          triggerClassName="ml-1 align-[-2px]"
          contentClassName="text-xs font-normal"
        >
          {metric.description}
        </InfoPopover>
      )}
    </th>
  );
}

/** The mean; the title has the standard error. `placed`: the cell's place ("1st of 5") above its mean. */
function MeanCell({
  cell,
  of,
  placed,
  className,
}: {
  cell?: SeedCell;
  of: number;
  placed?: boolean;
  className?: string;
}) {
  const error = cell?.stderr != null ? ` ${errorText(cell.stderr)}` : '';
  const first = cell?.rank === 1 && of > 1;
  return (
    <td
      className={cn(
        'px-2 py-2 text-right whitespace-nowrap tabular-nums',
        className,
        !cell && 'text-slate-300',
        first && 'bg-emerald-50 font-semibold text-emerald-900',
      )}
      title={cell ? `${cell.n} seeds${error}${cell.rank ? `, rank ${cell.rank} of ${of}` : ''}` : undefined}
    >
      {!cell ? (
        '—'
      ) : placed && cell.rank ? (
        <>
          {ordinal(cell.rank)}
          <span className="font-normal text-slate-400"> of {of}</span>
          <span className="block text-[10px] font-normal opacity-75">{formatValue(cell.mean)}</span>
        </>
      ) : (
        formatValue(cell.mean)
      )}
    </td>
  );
}

/** The headline metric (else the first ranked one), and the rows by their rank on it: best first,
 * then unranked rows and baselines. */
export function byHeadline(rows: SeedRow[], metrics: MetricDef[]): { key?: string; rows: SeedRow[] } {
  const key = (metrics.find((m) => m.headline) ?? metrics.find((m) => m.direction !== 'neither'))?.key;
  const rank = (r: SeedRow) => (key && r.cells.get(key)?.rank) || Infinity;
  return { key, rows: [...rows].sort((a, b) => rank(a) - rank(b)) };
}

/** "4th of 7": the place of variant `id` on the headline metric. */
export function seedPlace(rows: SeedRow[], metrics: MetricDef[], id: string) {
  const { key } = byHeadline(rows, metrics);
  const rank = key ? rows.find((r) => r.variant.id === id)?.cells.get(key)?.rank : null;
  return placeText(rank, rows.filter((r) => !r.variant.baseline).length);
}

/** Variants by metrics, in one group: the mean over seeds. First is green.
 * Rows go best first on the headline metric, with a medal for the top three.
 * `only`: the id of the one variant to show. Its row has its place at the left (if no medal), and
 * each cell has its place above its mean. */
export function SeedTable({
  rows,
  metrics,
  method,
  evalSlug,
  only,
  className,
}: {
  rows: SeedRow[];
  metrics: MetricDef[];
  method: string;
  /** The eval of the values. Each row opens the results of its variant on it. */
  evalSlug: string;
  only?: string;
  className?: string;
}) {
  const ranked = rows.filter((r) => !r.variant.baseline).length;
  const sorted = byHeadline(rows, metrics);
  const listed = only ? sorted.rows.filter((r) => r.variant.id === only) : sorted.rows;
  const href = (r: SeedRow) => evalVariantPath(evalSlug, method, r.variant.slug);
  return (
    <div className={cn(TABLE_BOX, className)}>
      <table className={TABLE}>
        <thead className={THEAD}>
          <tr>
            <th className="w-px py-2 pr-0 pl-4 font-medium">
              <span className="sr-only">Place</span>
            </th>
            <th className="px-2 py-2 font-medium">{!only && 'Variant'}</th>
            {metrics.map((m) => (
              <Head key={m.key} metric={m} />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {listed.map((r) => {
            const rank = sorted.key ? r.cells.get(sorted.key)?.rank : null;
            const medal = rank && rank <= MEDALS.length && ranked > 1;
            return (
              <LinkRow key={r.variant.id} href={href(r)} className={ROW}>
                <td
                  className={cn(
                    'py-2 pr-0 pl-4 text-center',
                    !medal && 'text-[10px] whitespace-nowrap text-slate-500 tabular-nums',
                  )}
                  title={rank ? `${ordinal(rank)} of ${ranked}` : undefined}
                >
                  {medal ? MEDALS[rank - 1] : only && rank && ranked > 1 ? ordinal(rank) : null}
                </td>
                <td className="px-2 py-2 leading-tight whitespace-nowrap">
                  <Link href={href(r)} className="font-medium text-sky-800 hover:underline">
                    {r.variant.displayName}
                  </Link>
                  {r.variant.author && <span className="block text-[10px] text-slate-400">{r.variant.author}</span>}
                </td>
                {metrics.map((m) => (
                  <MeanCell key={m.key} cell={r.cells.get(m.key)} of={ranked} placed={!!only} />
                ))}
              </LinkRow>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export type VariantSeedRow = {
  label: string;
  /** This variant's cells; `of`: the variants ranked in the group. */
  cells: Map<string, SeedCell>;
  of: number;
  seeds: { id: string; seed: number }[];
};

/** One variant's groups by metrics: the mean over seeds. The title has the standard error and rank. */
export function VariantSeedTable({
  rows,
  metrics,
  method,
  groupLabel,
  className,
}: {
  rows: VariantSeedRow[];
  metrics: MetricDef[];
  method: string;
  groupLabel: string;
  className?: string;
}) {
  return (
    <div className={cn(TABLE_BOX, className)}>
      <table className={TABLE}>
        <thead className={THEAD}>
          <tr>
            <th className="px-4 py-2 font-medium">{groupLabel}</th>
            {metrics.map((m) => (
              <Head key={m.key} metric={m} />
            ))}
            <th className="px-4 py-2 font-medium">Seeds</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.label} className={ROW}>
              <td className="px-4 py-2 whitespace-nowrap text-slate-800 tabular-nums">{r.label}</td>
              {metrics.map((m) => (
                <MeanCell key={m.key} cell={r.cells.get(m.key)} of={r.of} />
              ))}
              <td className="px-4 py-2 text-[11px] whitespace-nowrap">
                {r.seeds.map((s, i) => (
                  <span key={s.id}>
                    {i > 0 && ' '}
                    <Link href={artifactPath(method, s.id)} className="text-sky-800 hover:underline">
                      {s.seed}
                    </Link>
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
