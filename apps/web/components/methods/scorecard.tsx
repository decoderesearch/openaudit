import { MEDALS } from '@/components/catalog/leaders';
import { EvalLink } from '@/components/eval-link';
import Link from '@/components/link';
import { LinkRow } from '@/components/link-row';
import { jobLabel, variantPath, type ScoreRow, type VariantView } from '@/lib/methods';
import { cn } from '@/lib/utils';
import { CELL, Frame } from './highlight';
import { ROW, TABLE, TABLE_BOX, THEAD } from './table';

export { jobLabel };

/** The ranked variants. With one row: by rank in it, best first, then the ones with no value. */
export function byRank(rows: ScoreRow[], variants: VariantView[]): VariantView[] {
  const compared = variants.filter((v) => !v.baseline);
  if (rows.length !== 1) return compared;
  const rank = (v: VariantView) => rows[0].cells.get(v.id)?.rank ?? Infinity;
  return [...compared].sort((a, b) => rank(a) - rank(b));
}

/** Jobs by variants in one group. First place is green; a dash is a variant with no value. With
 * one row, the variants go best first, with a medal for the top three. */
export function Scorecard({
  rows,
  variants,
  method,
  empty = 'No value in this group',
  highlight,
  className,
}: {
  rows: ScoreRow[];
  variants: VariantView[];
  method: string;
  /** The tooltip for a dash. */
  empty?: string;
  /** The id of a variant whose column has a sky frame. */
  highlight?: string;
  className?: string;
}) {
  const compared = byRank(rows, variants);
  const lit = (v: VariantView) => v.id === highlight;
  const medal = (v: VariantView) => {
    const rank = rows.length === 1 && rows[0].count > 1 ? rows[0].cells.get(v.id)?.rank : undefined;
    return rank && MEDALS[rank - 1];
  };
  return (
    <div className={cn(TABLE_BOX, className)}>
      <table className={TABLE}>
        <thead className={THEAD}>
          <tr>
            <th className="px-4 py-2 align-bottom font-medium">Evaluation</th>
            {compared.map((m) => (
              <th
                key={m.id}
                className={cn(
                  'w-24 px-2 py-2 text-right align-bottom leading-tight font-medium',
                  lit(m) && cn(CELL, 'font-semibold text-sky-900'),
                )}
              >
                {lit(m) && <Frame edge="top" />}
                <span className="inline-flex items-center justify-end gap-1">
                  {medal(m) && <span aria-hidden>{medal(m)}</span>}
                  <Link href={variantPath(method, m.slug)} className="hover:text-sky-800 hover:underline">
                    {m.displayName.replaceAll('-', '\u2011')}
                  </Link>
                </span>
              </th>
            ))}
            <th className="px-4 py-2 align-bottom font-medium">Baselines</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <LinkRow
              key={row.job.eval.slug}
              href={`/evaluations/${row.job.eval.slug}`}
              className={cn(ROW, 'group/row')}
            >
              <td className="max-w-72 px-4 py-2 align-top">
                <EvalLink
                  slug={row.job.eval.slug}
                  className="text-[13px] font-medium text-sky-800 group-hover/row:underline"
                >
                  {jobLabel(row.job.eval)}
                </EvalLink>
                <span className="block text-[10px] text-slate-500">{row.job.metric.displayName}</span>
              </td>
              {compared.map((m) => {
                const cell = row.cells.get(m.id);
                const first = cell?.rank === 1 && row.count > 1;
                return (
                  <td
                    key={m.id}
                    className={cn(
                      'px-2 py-2 text-right align-middle whitespace-nowrap tabular-nums',
                      !cell && 'text-slate-300',
                      first && 'bg-emerald-50 font-semibold text-emerald-900',
                      cell && cell.rank === row.count && row.count > 2 && 'text-slate-400',
                      lit(m) && CELL,
                    )}
                    title={cell ? `Rank ${cell.rank} of ${row.count}` : empty}
                  >
                    {lit(m) && <Frame edge={i === rows.length - 1 ? 'bottom' : undefined} green={first} />}
                    {cell ? cell.value.toFixed(3) : '—'}
                  </td>
                );
              })}
              <td className="px-4 py-2 align-top text-[11px] whitespace-nowrap text-slate-500">
                {row.baselines.length
                  ? row.baselines.map((b) => (
                      <div key={b.variant.id}>{`${b.variant.displayName} ${b.value.toFixed(3)}`}</div>
                    ))
                  : '—'}
              </td>
            </LinkRow>
          ))}
        </tbody>
      </table>
    </div>
  );
}
