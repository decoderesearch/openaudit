import { EvalBrowser } from '@/components/catalog/eval-browser';
import { ModelUpdates } from '@/components/catalog/model-updates';
import { Fold } from '@/components/fold';
import { FEED_PAGE, Page, PageTitle } from '@/components/page';
import { SubmitEvaluation } from '@/components/submit-buttons';
import { GuidedTourButton } from '@/components/why-tour';
import { evalListQuery, parseEvalListFilter } from '@/lib/eval-list-filter';
import { MODEL_SORTS, sortOf } from '@/lib/home-sorts';
import { shareMetadata } from '@/lib/og/meta';
import { modelEvalRows } from '@/lib/server/eval-list-rows';
import { BookCheck } from 'lucide-react';
import type { Metadata } from 'next';

const DESCRIPTION = 'AI models with their Deploymeter scores and flagged chats, and the model evaluations that we run.';
export const metadata: Metadata = {
  title: 'Models',
  description: DESCRIPTION,
  ...shareMetadata('Models', DESCRIPTION, '/models', '/models/opengraph-image'),
};
export const dynamic = 'force-dynamic';

/** The models' updates at the left, and the model evals at the right. */
export default async function ModelsPage({ searchParams }: { searchParams: Promise<Record<string, unknown>> }) {
  const params = await searchParams;
  const filter = parseEvalListFilter(params);
  const rows = await modelEvalRows();

  return (
    <Page fit="lg">
      <PageTitle className="shrink-0 text-lg sm:text-xl">Models and Model Evaluations</PageTitle>
      <div className={FEED_PAGE}>
        <Fold more="Show more models">
          <ModelUpdates
            sort={sortOf(MODEL_SORTS, typeof params.sort === 'string' ? params.sort : null)}
            className="min-h-0 min-w-0 flex-1"
          />
        </Fold>
        <EvalBrowser
          key={evalListQuery(filter)}
          rows={rows}
          kind="models"
          filter={filter}
          title="Model Evaluations"
          titleIcon={<BookCheck aria-hidden />}
          id="model-evaluations"
          search={false}
          action={
            // `key`: without it, React warns of a child with no key in a list.
            <div key="actions" className="flex items-center gap-x-2">
              <SubmitEvaluation tests="models" plain />
              <GuidedTourButton look="tag" ids={['evaluations']} />
            </div>
          }
          className="min-h-0 flex-1 lg:w-2/5 lg:flex-none"
        />
      </div>
    </Page>
  );
}
