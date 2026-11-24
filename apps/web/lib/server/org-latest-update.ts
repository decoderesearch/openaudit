import { orgFeedFor } from '@/lib/server/org-feed';
import { auditSummary } from '@/lib/server/snippet-feed';

/** The date of the newest update of the organization with slug `org`: its newest incident or
 * departure, or its newest model audit. Null when it has none. */
export async function latestUpdate(org: string): Promise<string | null> {
  const [audits, orgs] = await Promise.all([auditSummary(org), orgFeedFor(org)]);
  return (
    [audits.latest, orgs[0]?.date]
      .filter((d) => d != null)
      .sort()
      .at(-1) ?? null
  );
}
