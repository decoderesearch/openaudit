import { EvalBrowser } from '@/components/catalog/eval-browser';
import { MethodBrowser } from '@/components/catalog/method-browser';
import { Fold } from '@/components/fold';
import { FEED_PAGE, Page, PageTitle } from '@/components/page';
import { SubmitEvaluation } from '@/components/submit-buttons';
import { evalListQuery, parseEvalListFilter } from '@/lib/eval-list-filter';
import { shareMetadata } from '@/lib/og/meta';
import { methodEvalRows } from '@/lib/server/eval-list-rows';
import { methodsWithVariants, withMedals } from '@/lib/server/nav-methods';
import { BookCheck } from 'lucide-react';
import type { Metadata } from 'next';

const DESCRIPTION = 'How well interpretability and monitoring tools (SAEs, probes, LLM monitors) do their safety jobs.';
export const metadata: Metadata = {
  title: 'Methods',
  description: DESCRIPTION,
  ...shareMetadata('Methods', DESCRIPTION, '/methods', '/methods/opengraph-image'),
};
export const dynamic = 'force-dynamic';

/** The methods at the left, and the method evals at the right. */
export default async function MethodsPage({ searchParams }: { searchParams: Promise<Record<string, unknown>> }) {
  const filter = parseEvalListFilter(await searchParams);
  const [methods, rows] = await Promise.all([methodsWithVariants(), methodEvalRows()]);
  const items = withMedals(methods, rows);

  return (
    <Page fit="lg">
      <PageTitle className="shrink-0 text-lg sm:text-xl">Safety Methods and Method Evaluations</PageTitle>
      <div className={FEED_PAGE}>
        <Fold more="Show more methods">
          <MethodBrowser methods={items} className="min-h-0 min-w-0 flex-1" />
        </Fold>
        <EvalBrowser
          key={evalListQuery(filter)}
          rows={rows}
          kind="methods"
          filter={filter}
          title="Method Evaluations"
          titleIcon={<BookCheck aria-hidden />}
          id="method-evaluations"
          search={false}
          action={<SubmitEvaluation tests="methods" plain />}
          titleInfo="Tests that score how well each method does a safety job, for example finding lies or removing a concept from a model. Each eval shows its 3 best variants."
          podium
          className="min-h-0 min-w-0 flex-1"
        />
      </div>
    </Page>
  );
}
