import { OrgFeed } from '@/components/org/org-feed';
import type { OrgCards } from '@/components/org/org-hover-card';
import type { CommitmentGrid } from '@/lib/commitments';
import { organizationPath } from '@/lib/organizations';
import { orgFeedPage } from '@/lib/server/org-feed';

/** The Organizations page's updates feed, with its first page from the server. `orgs`: the
 * commitment grid's organizations, most prominent first, for the pill strip. `cards`: each
 * organization's home card, for a hover. */
export async function OrgUpdates({
  orgs,
  cards,
  className,
}: {
  orgs: CommitmentGrid['orgs'];
  cards?: OrgCards;
  className?: string;
}) {
  const first = await orgFeedPage().catch(() => ({ entries: [], more: false }));
  const pills = orgs.map((o) => ({ id: o.id, name: o.name, href: organizationPath(o), total: o.total }));
  return <OrgFeed first={first} orgs={pills} cards={cards} className={className} />;
}
