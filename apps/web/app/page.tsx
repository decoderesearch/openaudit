import { Fold } from '@/components/fold';
import { HomeHeader } from '@/components/home-header';
import { HomeMethodEvals } from '@/components/home-method-evals';
import { HomeModels } from '@/components/home-models';
import { HomeOrgs } from '@/components/home-orgs';
import { Page } from '@/components/page';
import { SITE_TAGLINE } from '@/lib/env';
import { HERO_SMALL_COOKIE } from '@/lib/home-hero';
import { evalOfTheDay, methodEvalRows, runnableModelEvalRows } from '@/lib/server/eval-list-rows';
import { homeCounts } from '@/lib/server/home-counts';
import { allModels } from '@/lib/server/home-models';
import { homeOrgsPage } from '@/lib/server/home-orgs';
import { navMethods } from '@/lib/server/nav-methods';
import { orgListItems } from '@/lib/server/org-list';
import { cn } from '@/lib/utils';
import { cookies } from 'next/headers';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

// On a wide screen, the large hero panel is 44% of the screen below the navbar (3rem) and above the
// footer (2rem), from 352px to 512px. The three columns of one width are as tall as the screen below the navbar, less
// the page's padding and the footer, so that the page scrolls only until the hero is gone; then the
// lists scroll in them. Under `lg`, each list is in a `Fold` and the page scrolls.
const HERO = 'lg:h-[calc((100dvh-5rem)*0.44)] lg:min-h-88 lg:max-h-128';
const COLUMNS = 'grid grid-cols-1 gap-8 lg:h-[calc(100dvh-7.25rem)] lg:min-h-96 lg:grid-cols-3 lg:gap-3';
/** A no-break space keeps "of" with "AI", so the second line starts with "of". */
const TITLE = SITE_TAGLINE.replace('of AI', 'of\u00a0AI');
const LIST = 'min-w-0 lg:h-auto';
const LOADING = 'max-lg:h-[36rem]';
/** The organizations with updates that load at a time. */
const ORG_UPDATES = 12;

export default async function HomePage() {
  const [models, orgs, updates, methods, counts, modelEvals, methodEvals, jar] = await Promise.all([
    allModels().catch(() => ({ cards: [], others: [] })),
    orgListItems().catch(() => []),
    homeOrgsPage(0, ORG_UPDATES).catch(() => ({ entries: [], more: false })),
    navMethods().catch(() => null),
    homeCounts().catch(() => null),
    runnableModelEvalRows().catch(() => null),
    methodEvalRows().catch(() => null),
    cookies(),
  ]);
  const ofTheDay = evalOfTheDay(modelEvals ?? [], methodEvals ?? []);
  // Each part is in its own Suspense boundary, so it hydrates on its own.
  return (
    <>
      <HomeHeader title={TITLE} small={jar.has(HERO_SMALL_COOKIE)} ofTheDay={ofTheDay} className={HERO} />
      <Page className="pt-6 sm:pt-6 lg:px-6 lg:pt-5 lg:pb-4">
        <div className={COLUMNS}>
          <Suspense fallback={<div className={cn(LIST, LOADING)} />}>
            <Fold size="lg" more="Show more models">
              <HomeModels models={models} count={counts?.models} evalCount={modelEvals?.length} className={LIST} />
            </Fold>
          </Suspense>
          <Suspense fallback={<div className={cn(LIST, LOADING)} />}>
            <Fold size="lg" more="Show more organizations">
              <HomeOrgs
                items={orgs}
                first={updates}
                size={ORG_UPDATES}
                orgCount={counts?.organizations}
                commitmentCount={counts?.commitments}
                className={LIST}
              />
            </Fold>
          </Suspense>
          <Suspense fallback={<div className={cn(LIST, LOADING)} />}>
            <Fold size="lg" more="Show more safety methods">
              <HomeMethodEvals
                evals={methods?.evals ?? []}
                methods={(methods?.methods ?? []).map(({ label, href, summary }) => ({ label, href, summary }))}
                count={counts?.methods}
                evalCount={methodEvals?.length}
                className={LIST}
              />
            </Fold>
          </Suspense>
        </div>
      </Page>
    </>
  );
}
