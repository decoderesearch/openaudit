import { Breadcrumbs } from '@/components/nav/breadcrumbs';
import { crumbsFor } from '@/lib/server/breadcrumbs';

export default async function BreadcrumbsSlot({ params }: { params: Promise<{ segments: string[] }> }) {
  const crumbs = await crumbsFor((await params).segments);
  // `contents`: the slot has no box, so Next skips it for the scroll to the top after a navigation.
  // Else the sticky bar is always in view, and the page keeps its scroll position.
  return crumbs ? (
    <div className="contents">
      <Breadcrumbs crumbs={crumbs} />
    </div>
  ) : null;
}
