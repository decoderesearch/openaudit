import { EvalBrowser } from '@/components/catalog/eval-browser';
import { VariantBox } from '@/components/catalog/method-browser';
import { Fold } from '@/components/fold';
import { MethodExpertViews } from '@/components/methods/expert-views';
import { LinkButtons } from '@/components/methods/link-buttons';
import type { Search } from '@/components/methods/suite-results';
import { Eyebrow, Page, PageTitle } from '@/components/page';
import { evalListQuery, parseEvalListFilter } from '@/lib/eval-list-filter';
import { METHOD_GROUPS, methodPath } from '@/lib/methods';
import { shareMetadata } from '@/lib/og/meta';
import { plainText } from '@/lib/org-research';
import { methodEvalRows } from '@/lib/server/eval-list-rows';
import { getMethod } from '@/lib/server/methods';
import { methodsWithVariants, withMedals } from '@/lib/server/nav-methods';
import { cn } from '@/lib/utils';
import { BookCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

type Props = { params: Promise<{ method: string }>; searchParams: Promise<Search> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getMethod((await params).method);
  if (!data) return { title: 'Method' };
  const { displayName: title, summary, slug } = data.method;
  const description = plainText(summary ?? '');
  const url = methodPath(slug);
  return { title, description, ...shareMetadata(title, description, url, `${url}/opengraph-image`) };
}

export default async function MethodPage({ params, searchParams }: Props) {
  const [{ method: slug }, sp] = await Promise.all([params, searchParams]);
  const data = await getMethod(slug);
  if (!data) notFound();
  const { method, evals, views } = data;
  const [navMethods, methodRows] = await Promise.all([methodsWithVariants(), methodEvalRows()]);
  const evalSlugs = new Set(evals.map((e) => e.slug));
  const evalRows = methodRows.filter((r) => evalSlugs.has(r.slug));
  const nav = withMedals(navMethods, evalRows).find((m) => m.href === methodPath(method.slug));
  const evalFilter = parseEvalListFilter(sp);
  return (
    <Page className="lg:flex-1 lg:pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Eyebrow>Method</Eyebrow>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <PageTitle>{method.displayName}</PageTitle>
            <p className="text-[11px] font-semibold text-slate-400 uppercase">{METHOD_GROUPS[method.group].title}</p>
          </div>
          <p className="mt-1 max-w-3xl text-sm/normal text-slate-600">{method.summary}</p>
        </div>
        {method.links.length > 0 && <LinkButtons links={method.links} />}
      </div>

      <div className={cn('grid grid-cols-1 gap-4 lg:flex-1', nav && 'lg:grid-cols-2')}>
        <div className="flex min-w-0 flex-col gap-4">
          <MethodExpertViews views={views} />
          <Fold more="Show more evaluations">
            <EvalBrowser
              key={evalListQuery(evalFilter)}
              rows={evalRows}
              kind="methods"
              filter={evalFilter}
              title="Evaluations"
              titleIcon={<BookCheck aria-hidden />}
              podium
              search={false}
              className="lg:max-h-[44rem] lg:flex-auto"
            />
          </Fold>
        </div>
        {nav && (
          // Its size does not count for the rows: it fills the left column's height.
          <div className="grid min-h-0 min-w-0 lg:[contain:size]">
            <Fold more="Show more variants">
              <VariantBox method={nav} />
            </Fold>
          </div>
        )}
      </div>
    </Page>
  );
}
