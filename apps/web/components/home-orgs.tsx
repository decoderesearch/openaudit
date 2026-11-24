'use client';

import { HOME_BOX, HOME_BUTTON, HOME_HEAD, HOME_SCROLL } from '@/components/home-models';
import { HomeOrgUpdates } from '@/components/home-org-updates';
import { MenuPageLink } from '@/components/nav/nav-menu';
import { OrgList, type OrgListItem } from '@/components/org/org-list';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { COMMITMENTS_PATH } from '@/lib/commitments';
import type { FeedPage } from '@/lib/feed';
import type { HomeOrg } from '@/lib/server/home-orgs';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const VIEWS = [
  { value: 'incidents', label: 'Incidents' },
  { value: 'commitments', label: 'Commitments' },
] as const;
type View = (typeof VIEWS)[number]['value'];

/** The home page's Organizations column. A control in its head picks the view: `items` by
 * commitment score (`OrgList`), or the organizations with updates and their newest incidents
 * (`HomeOrgUpdates`, from `first`, `size` at a time). */
export function HomeOrgs({
  items,
  first,
  size,
  orgCount,
  commitmentCount,
  className,
}: {
  items: OrgListItem[];
  first: FeedPage<HomeOrg>;
  size: number;
  orgCount?: number;
  commitmentCount?: number;
  className?: string;
}) {
  const [view, setView] = useState<View>('commitments');
  const head = {
    insetHead: (
      <h2 className="flex shrink-0">
        <MenuPageLink href="/organizations" count={orgCount} className={HOME_BUTTON}>
          <span className="sm:hidden">Orgs</span>
          <span className="max-sm:hidden">Organizations</span>
        </MenuPageLink>
      </h2>
    ),
    actions: (
      <>
        <MenuPageLink href={COMMITMENTS_PATH} count={commitmentCount} className={HOME_BUTTON}>
          Commitments
        </MenuPageLink>
        <SegmentedControl
          label="Show organizations by"
          small
          round
          value={view}
          options={VIEWS}
          onValueChange={setView}
          className="flex h-6 w-full"
          itemClassName="flex-1 border-slate-300 bg-slate-300 text-slate-600 hover:border-slate-400/60 hover:bg-slate-400/60 data-[state=on]:border-white data-[state=on]:bg-white data-[state=on]:text-slate-500 data-[state=on]:hover:border-white data-[state=on]:hover:bg-white"
        />
      </>
    ),
    headClassName: cn(HOME_HEAD, 'flex-wrap gap-y-2.5'),
    boxClassName: HOME_BOX,
    scrollClassName: HOME_SCROLL,
  };
  return view === 'commitments' ? (
    <OrgList items={items} home {...head} className={className} />
  ) : (
    <HomeOrgUpdates first={first} size={size} {...head} className={className} />
  );
}
