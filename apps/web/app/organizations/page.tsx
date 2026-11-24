import { COMMITMENTS_CORNER, CommitmentTable, PAGE_BUTTON } from '@/components/commitments/commitment-table';
import Link from '@/components/link';
import type { OrgCards } from '@/components/org/org-hover-card';
import { OrgPills } from '@/components/org/org-pills';
import { OrgUpdates } from '@/components/org/org-updates';
import { FEED_MAIN, FEED_PAGE, Page, PageTitle } from '@/components/page';
import { GuidedTourButton } from '@/components/why-tour';
import { COMMITMENTS_PATH } from '@/lib/commitments';
import { shareMetadata } from '@/lib/og/meta';
import { organizationPath } from '@/lib/organizations';
import { commitmentGrid } from '@/lib/server/commitments';
import { orgListItems } from '@/lib/server/org-list';
import { cn } from '@/lib/utils';
import { ArrowRight, Grid3x3 } from 'lucide-react';
import type { Metadata } from 'next';

const DESCRIPTION = 'AI organizations, their safety commitments and their safety incidents.';
export const metadata: Metadata = {
  title: 'Organizations',
  description: DESCRIPTION,
  ...shareMetadata('Organizations', DESCRIPTION, '/organizations'),
};
export const dynamic = 'force-dynamic';

/** The incidents at the left, and the commitments table (`small`) at the right. Under `lg`, the
 * commitments are first. */
export default async function OrganizationsPage() {
  const [grid, items] = await Promise.all([commitmentGrid().catch(() => null), orgListItems().catch(() => [])]);
  // Each organization's home card (by href), for a hover on its bar or its pill.
  const cards: OrgCards = Object.fromEntries(items.map((o) => [o.href, o]));
  const pills = (grid?.orgs ?? []).map((o) => ({ id: o.id, name: o.name, href: organizationPath(o), total: o.total }));
  return (
    <Page fit="lg">
      <PageTitle className="shrink-0 text-lg sm:text-xl">Organizations and Commitments</PageTitle>
      <div className={FEED_PAGE}>
        {/* Under `lg`: the organizations strip above the commitments; the feed hides its own. */}
        <OrgPills orgs={pills} bars cards={cards} className="shrink-0 py-1 lg:hidden" />
        <section
          aria-label="Commitments"
          className="flex min-h-0 flex-col overflow-hidden rounded-lg bg-slate-100 lg:w-[66%] lg:flex-none"
        >
          <div className="flex shrink-0 items-center justify-between gap-x-3 px-4 pt-3 pb-3.5">
            <Link href={COMMITMENTS_PATH} hover={false} className={PAGE_BUTTON}>
              <Grid3x3 aria-hidden className="size-3.5" />
              All Commitments
              <ArrowRight aria-hidden className="size-3.5" />
            </Link>
            <GuidedTourButton look="page" ids={['safety-coordination']} />
          </div>
          {grid?.orgs.length ? (
            <CommitmentTable
              grid={grid}
              small
              corner={COMMITMENTS_CORNER}
              cards={cards}
              className="mx-3 mb-3 max-lg:mx-0 max-lg:mb-0"
            />
          ) : (
            <p className="px-4 pb-3 text-sm text-slate-600">No commitments yet.</p>
          )}
        </section>
        <OrgUpdates orgs={grid?.orgs ?? []} cards={cards} className={cn(FEED_MAIN, 'lg:order-first')} />
      </div>
    </Page>
  );
}
