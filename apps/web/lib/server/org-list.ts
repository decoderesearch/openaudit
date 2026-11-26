import type { OrgListItem } from '@/components/org/org-list';
import { organizationPath } from '@/lib/organizations';
import { listOrganizations } from '@/lib/server/catalog';
import { commitmentSummaries } from '@/lib/server/commitments';
import { homeOrgsPage } from '@/lib/server/home-orgs';
import { incidentCounts, lastUpdateDates } from '@/lib/server/org-research';
import { ttlCache } from '@/lib/server/ttl-cache';

/** All organizations for `OrgList`, the newest update first, each with its commitment score. One
 * with no updates has only its name and counts. */
export const orgListItems = ttlCache(async (): Promise<OrgListItem[]> => {
  const [organizations, home, incidents, updated, commitments] = await Promise.all([
    listOrganizations(),
    homeOrgsPage(0, Number.MAX_SAFE_INTEGER),
    incidentCounts(),
    lastUpdateDates(),
    commitmentSummaries(),
  ]);
  const boxes = new Map(home.entries.map((o) => [o.href, o]));
  return [...organizations]
    .sort(
      (a, b) =>
        (updated.get(b.id) ?? '').localeCompare(updated.get(a.id) ?? '') ||
        a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }),
    )
    .map((o) => {
      const href = organizationPath(o);
      const count = Object.values(incidents.get(o.id) ?? {}).reduce((s, n) => s + (n ?? 0), 0);
      return {
        ...(boxes.get(href) ?? {
          key: href,
          href,
          date: '',
          incidents: count,
          audits: o.openAuditCards,
          recent: [],
          leavers: [],
        }),
        label: o.displayName,
        commitments: commitments.get(o.id),
        search: [o.displayName, o.slug, ...o.aliases, ...o.slugAliases].join(' '),
      };
    });
}, 300_000, 'org-list-items');
