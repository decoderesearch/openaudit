import { COMMITMENTS_CORNER, CommitmentTable, HOW_SCORES_WORK } from '@/components/commitments/commitment-table';
import type { OrgCards } from '@/components/org/org-hover-card';
import { Page, PageTitle } from '@/components/page';
import { GuidedTourButton } from '@/components/why-tour';
import { COMMITMENTS_PATH } from '@/lib/commitments';
import { shareMetadata } from '@/lib/og/meta';
import { commitmentGrid } from '@/lib/server/commitments';
import { orgListItems } from '@/lib/server/org-list';
import type { Metadata } from 'next';

// The table of organizations against safety commitments: `/organizations/commitments`.

const DESCRIPTION = 'Which AI organizations have made which safety commitments, and how far.';
export const metadata: Metadata = {
  title: 'Safety Commitments',
  description: DESCRIPTION,
  alternates: { canonical: COMMITMENTS_PATH },
  ...shareMetadata('Safety Commitments', DESCRIPTION, COMMITMENTS_PATH, `${COMMITMENTS_PATH}/opengraph-image`),
};
export const dynamic = 'force-dynamic';

export default async function CommitmentsPage() {
  const [grid, items] = await Promise.all([commitmentGrid(), orgListItems().catch(() => [])]);
  // Each organization's home card (by href), for a hover on its bar.
  const cards: OrgCards = Object.fromEntries(items.map((o) => [o.href, o]));
  return (
    <Page fit>
      <div className="flex flex-col gap-y-1">
        <div className="flex items-center justify-between gap-x-3">
          <PageTitle>Safety Commitments</PageTitle>
          <GuidedTourButton look="page" ids={['safety-coordination']} />
        </div>
        <div className="flex items-end justify-between gap-x-4">
          <p className="text-[13px] text-slate-500 max-lg:hidden">
            An organization&apos;s safety commitments are policies or processes they&apos;ve publicly committed to.
            Click a commitment, an organization, or a cell to view more details.
          </p>
          {HOW_SCORES_WORK}
        </div>
      </div>
      {grid.orgs.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-500">No Commitments Found</p>
      ) : (
        <CommitmentTable grid={grid} corner={COMMITMENTS_CORNER} cards={cards} />
      )}
    </Page>
  );
}
