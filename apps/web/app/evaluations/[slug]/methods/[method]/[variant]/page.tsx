import { EvalLink } from '@/components/eval-link';
import { Fold } from '@/components/fold';
import Link from '@/components/link';
import { LinkRow } from '@/components/link-row';
import { SeedCharts } from '@/components/methods/seed-charts';
import { VariantSeedTable } from '@/components/methods/seed-table';
import { FLUSH, ROW, TABLE, TABLE_BOX, THEAD, scrollAfter12 } from '@/components/methods/table';
import { NavSection } from '@/components/nav/nav-section';
import { Page, PageHeader } from '@/components/page';
import { Panel } from '@/components/panel';
import {
  SEED,
  artifactPath,
  formatValue,
  methodPath,
  paramText,
  seedCharts,
  variantPath,
  variantSeedView,
} from '@/lib/methods';
import { getMethod } from '@/lib/server/methods';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

type Props = { params: Promise<{ slug: string; method: string; variant: string }> };

async function load(slug: string, methodSlug: string, variantSlug: string) {
  const data = await getMethod(methodSlug);
  const variant = data?.variants.find((v) => v.slug === variantSlug);
  const view = data && variant ? variantSeedView(data, variant.id, slug) : null;
  return data && variant && view ? { data, variant, view } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, method, variant } = await params;
  const found = await load(slug, method, variant);
  return { title: found ? `${found.variant.displayName} on ${found.view.job.eval.displayName}` : 'Variant Results' };
}

export default async function EvalVariantPage({ params }: Props) {
  const { slug, method: methodSlug, variant: variantSlug } = await params;
  const found = await load(slug, methodSlug, variantSlug);
  if (!found) notFound();
  const {
    data: { method, variants, params: defs, artifacts },
    variant,
    view,
  } = found;
  const { job, key, metrics, groups, seeds } = view;
  const defOf = new Map(defs.map((d) => [d.key, d]));
  const keyDef = key ? defOf.get(key) : undefined;
  const keyLabel = key ? (keyDef?.label ?? key) : 'Group';
  // A baseline with no value of the key (an ICA Lens has no target L0) is the same in each group.
  const fixed = !!key && seeds.every((s) => s.value === '');

  const rows = (fixed ? groups.slice(0, 1) : groups).flatMap((g) => {
    const row = g.means.find((r) => r.variant.id === variant.id);
    return row
      ? [
          {
            label: key && !fixed ? paramText(keyDef, g.value) : 'All',
            cells: row.cells,
            of: g.of,
            seeds: seeds.filter((s) => s.value === g.value || s.value === '').map((s) => ({ id: s.id, seed: s.seed })),
          },
        ]
      : [];
  });

  const charts = seedCharts(view, variants, variant.id);

  const mine = artifacts.filter((a) => seeds.some((s) => s.id === a.id));
  const shared = defs.filter(
    (d) =>
      d.key !== key &&
      d.key !== SEED &&
      mine[0]?.params[d.key] !== undefined &&
      mine.every((a) => a.params[d.key] === mine[0].params[d.key]),
  );
  return (
    <Page>
      <NavSection method />
      <PageHeader
        eyebrow="Variant Evaluation Results"
        title={
          <>
            <Link href={variantPath(method.slug, variant.slug)} className="text-sky-800 hover:underline">
              {variant.displayName}
            </Link>{' '}
            <span className="text-slate-500">on</span>{' '}
            <EvalLink slug={job.eval.slug} className="text-sky-800 hover:underline">
              {job.eval.displayName}
            </EvalLink>
          </>
        }
        description={
          <Link href={methodPath(method.slug)} className="text-sm font-medium text-sky-800 hover:underline">
            {method.displayName}
          </Link>
        }
      />

      {shared.length > 0 && (
        <Panel
          title="Training Setup"
          info={`The settings that all ${seeds.length} artifacts share. Only ${fixed ? 'the seed changes' : `the ${keyLabel.toLowerCase()} and the seed change`}. Hover a setting for what it means.`}
        >
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 px-4 py-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
            {shared.map((d) => (
              <div key={d.key} className="flex min-w-0 justify-between gap-3" title={d.description}>
                <dt className="truncate text-slate-500">{d.label}</dt>
                <dd className="shrink-0 font-medium text-slate-800 tabular-nums">
                  {paramText(d, mine[0].params[d.key])}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      )}

      {charts.length > 0 && (
        <Panel>
          <SeedCharts charts={charts} xLabel={keyLabel} method={method.slug} heading={`Results by ${keyLabel}`} />
        </Panel>
      )}

      <Panel
        title="Mean Over Seeds"
        info="Each value is the mean over the seeds. Hover a value for its standard error and its rank among the variants. Green: first place. Click a seed to open its artifact."
      >
        <Fold more="Show more rows">
          <VariantSeedTable
            rows={rows}
            metrics={metrics}
            method={method.slug}
            groupLabel={keyLabel}
            className={cn(FLUSH, scrollAfter12(rows.length, true))}
          />
        </Fold>
      </Panel>

      <Panel title="Each Seed" info="The value of each artifact on each metric. Click a row to open its artifact.">
        <Fold more="Show more seeds">
          <div className={cn(TABLE_BOX, FLUSH, 'lg:max-h-[32rem] lg:overflow-y-auto')}>
            <table className={TABLE}>
              <thead className={cn(THEAD, 'sticky top-0 z-10')}>
                <tr>
                  {key && !fixed && <th className="px-4 py-2 font-medium">{keyLabel}</th>}
                  <th className="px-2 py-2 font-medium">Seed</th>
                  {metrics.map((m) => (
                    <th key={m.key} className="px-2 py-2 text-right font-medium">
                      {m.displayName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="isolate divide-y divide-slate-100">
                {seeds.map((s, i) => (
                  <LinkRow
                    key={s.id}
                    href={artifactPath(method.slug, s.id)}
                    className={cn(ROW, i > 0 && seeds[i - 1].value !== s.value && 'border-t border-slate-200')}
                  >
                    {key && !fixed && (
                      <td className="px-4 py-1.5 text-slate-800 tabular-nums">
                        {i === 0 || seeds[i - 1].value !== s.value ? paramText(keyDef, s.value) : ''}
                      </td>
                    )}
                    <td className="px-2 py-1.5 text-sky-800 tabular-nums">{s.seed}</td>
                    {metrics.map((m) => (
                      <td key={m.key} className="px-2 py-1.5 text-right tabular-nums">
                        {s.values[m.key] != null ? formatValue(s.values[m.key]) : '—'}
                      </td>
                    ))}
                  </LinkRow>
                ))}
              </tbody>
            </table>
          </div>
        </Fold>
      </Panel>
    </Page>
  );
}
