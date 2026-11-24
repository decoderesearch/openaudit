'use client';

import { CommitmentTable } from '@/components/commitments/commitment-table';
import { MENU_HEIGHT, MenuFeed, MenuPageLink, NavMenu } from '@/components/nav/nav-menu';
import type { OrgCards } from '@/components/org/org-hover-card';
import { OrgPills } from '@/components/org/org-pills';
import { OrgUpdateItem } from '@/components/org/org-update-row';
import { COMMITMENTS_PATH, type CommitmentGrid } from '@/lib/commitments';
import { organizationPath } from '@/lib/organizations';
import type { NavOrgs } from '@/lib/server/nav-orgs';
import { cn } from '@/lib/utils';
import { BuildingComplex } from 'lucide-react';
/** The width of the Safety Commitments column, in px. */
const COMMITMENTS_WIDTH = 660;
/** The width of the updates column, in px. */
const UPDATES_WIDTH = 310;
/** This menu's maximum height, in px: a little shorter than the other large menus. */
const ORGS_MAX_HEIGHT = 680;

/** The navbar's Organizations menu, in the form of the Organizations page: the newest updates and
 * the commitments table. */
export function OrgsMenu({ active, orgs }: { active: boolean; orgs: NavOrgs | null }) {
  return (
    <NavMenu<NavOrgs>
      label="Organizations"
      icon={BuildingComplex}
      href="/organizations"
      active={active}
      api="/api/nav-orgs"
      initial={orgs}
      width={COMMITMENTS_WIDTH + UPDATES_WIDTH}
      maxHeight={ORGS_MAX_HEIGHT}
      noun="organizations"
      inlineFilter
      body={OrgsBody}
    />
  );
}

function OrgsBody({ data, onPick }: { data: NavOrgs; onPick: () => void }) {
  // Each organization's home card (by href), for a hover on its pill or its bar.
  const cards: OrgCards = Object.fromEntries(
    data.all.map((o) => [
      o.href,
      {
        key: o.href,
        label: o.label,
        href: o.href,
        date: '',
        incidents: o.incidentCount,
        audits: o.audits,
        recent: [],
        leavers: o.leavers,
        commitments: o.commitments,
      },
    ]),
  );
  return (
    <div
      className="grid divide-x-4 divide-slate-100"
      style={{ gridTemplateColumns: `minmax(0, 1fr) ${COMMITMENTS_WIDTH}px` }}
    >
      <MenuFeed
        title="Latest Incidents"
        head={
          <OrgPills
            orgs={data.grid.orgs.map((o) => ({ id: o.id, name: o.name, href: organizationPath(o), total: o.total }))}
            onPick={onPick}
            bars
            cards={cards}
            className="w-full py-1.5"
          />
        }
        link={
          <MenuPageLink href="/organizations" onPick={onPick} count={data.counts?.organizations} className="pl-4">
            Organizations
          </MenuPageLink>
        }
        entries={data.updates}
        href="/organizations"
        onPick={onPick}
        dense
        item={(o) => <OrgUpdateItem org={o} onPick={onPick} />}
        // Not in the row height: the menu is as tall as the commitments table, and this column scrolls.
        className="[contain:size]"
      />
      {/* The browser can keep a response from before a deploy, with no `grid`. */}
      <MenuCommitments grid={data.grid} count={data.counts?.commitments} cards={cards} onPick={onPick} />
    </div>
  );
}

/** The commitments table (`small`), with a "Commitments" page link in its top left cell, in line
 * with the "Organizations" link of the updates column. No "How Scores Work": its dialog is outside
 * the menu, so a click in it closes the menu. */
function MenuCommitments({
  grid,
  count,
  cards,
  onPick,
}: {
  grid?: CommitmentGrid;
  count?: number;
  cards?: OrgCards;
  onPick: () => void;
}) {
  return (
    <section aria-label="Safety Commitments" className="flex min-w-0 flex-col">
      {grid?.orgs.length ? (
        <CommitmentTable
          grid={grid}
          small
          corner={
            <MenuPageLink href={COMMITMENTS_PATH} onPick={onPick} count={count}>
              Commitments
            </MenuPageLink>
          }
          inset
          cards={cards}
          onPick={onPick}
          className={cn(MENU_HEIGHT, 'overscroll-contain rounded-none')}
        />
      ) : (
        <p className="px-5 py-2 text-slate-500">No commitments yet.</p>
      )}
    </section>
  );
}
