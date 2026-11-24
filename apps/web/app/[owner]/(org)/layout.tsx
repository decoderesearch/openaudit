import { InfoPopover } from '@/components/info-popover';
import { Markdown } from '@/components/markdown';
import { OrgHeader, OrgSidebar } from '@/components/org/org-sidebar';
import { Page } from '@/components/page';
import { hostOf } from '@/lib/org-research';
import { findOrganization, getOrganization, isHiddenOrganization } from '@/lib/server/catalog';
import { orgCommitmentStates } from '@/lib/server/commitments';
import { latestUpdate } from '@/lib/server/org-latest-update';
import { listDepartures, listIncidents } from '@/lib/server/org-research';
import { auditSummary, unauditedModels } from '@/lib/server/snippet-feed';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';

// An organization's pages: its updates (`/<org>`), commitments, models, departures and incidents. The column at
// the left stays as a link changes the page at the right. A page does its own not-found and
// redirect, so with no such organization this shows the page alone.

type Props = { children: ReactNode; params: Promise<{ owner: string }> };

export default async function OrganizationLayout({ children, params }: Props) {
  const named = await findOrganization((await params).owner);
  if (!named || named.redirect) return <Page>{children}</Page>;
  const hidden = (await isHiddenOrganization(named.org.id)) && !isAdmin(await getViewer());
  const [found, audits, unaudited, latest, departures, incidents, commitments] = await Promise.all([
    getOrganization(named.org.slug),
    hidden ? { models: 0, average: null } : auditSummary(named.org.slug),
    hidden ? [] : unauditedModels(named.org.slug),
    hidden ? null : latestUpdate(named.org.slug),
    hidden ? [] : listDepartures(named.org.id),
    listIncidents(named.org.id),
    hidden ? [] : orgCommitmentStates(named.org.id),
  ]);
  if (!found) return <Page>{children}</Page>;
  const o = found.organization;
  const org = { slug: o.slug, displayName: o.displayName };

  return (
    <Page fit="lg">
      <div className="flex flex-col gap-y-3 lg:min-h-0 lg:flex-1">
        <OrgHeader
          org={org}
          hidden={hidden}
          // The key: the header shows this element beside the name, and React checks keys there.
          about={
            (o.website || o.summary) && (
              <p key="about" className="flex flex-wrap items-center gap-x-2 gap-y-1 pb-1 text-xs text-slate-500">
                {o.website && (
                  <a
                    href={o.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-x-1 font-medium text-slate-600 hover:text-slate-900 hover:underline"
                  >
                    {hostOf(o.website)}
                    <ExternalLink className="size-3" />
                  </a>
                )}
                {o.website && o.summary && <span aria-hidden>·</span>}
                {o.summary && (
                  <InfoPopover
                    label={`About ${o.displayName}`}
                    trigger="Organization Info"
                    click
                    triggerClassName="text-slate-600 decoration-slate-400 hover:text-slate-900"
                    contentClassName="w-[32rem] max-w-[calc(100vw_-_2rem)]"
                  >
                    <Markdown text={o.summary} className="text-[13px] text-slate-700" />
                  </InfoPopover>
                )}
              </p>
            )
          }
        />
        <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,30fr)_minmax(0,70fr)] lg:grid-rows-[minmax(0,1fr)] lg:gap-6">
          <OrgSidebar
            org={org}
            hidden={hidden}
            latest={latest}
            audits={{ ...audits, unaudited: unaudited.length }}
            departures={departures}
            incidents={incidents}
            commitments={commitments}
          />
          {/* From `lg` up, only this column scrolls. A page in it can use `cqh` for its height. */}
          <div className="min-w-0 lg:[container-type:size] lg:relative lg:col-start-2 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">
            {children}
          </div>
        </div>
      </div>
    </Page>
  );
}
