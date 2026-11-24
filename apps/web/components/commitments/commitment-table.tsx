import { CommitmentCell } from '@/components/commitments/commitment-cell';
import { FaqModal } from '@/components/faq-modal';
import Link from '@/components/link';
import { OrgScoreBar, type OrgCards } from '@/components/org/org-hover-card';
import {
  CATEGORY_LABELS,
  commitmentPath,
  formatPoints,
  orgCommitmentPath,
  orgCommitmentsPath,
  SHORT_NAMES,
  type CommitmentGrid,
} from '@/lib/commitments';
import { COMMITMENTS_FAQ } from '@/lib/faqs';
import { organizationPath } from '@/lib/organizations';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

// The table of organizations against safety commitments. Server and client pages use it.

const STICKY_COL = 'sticky left-0 z-10 bg-white';
/** The most organizations in view. It must match the `/8` in the heads' `min-w`. */
const MAX_ORGS = 8;
/** More space under the table's last row. */
const LAST_ROW = '[tbody:last-child>tr:last-child>&]:pb-7';

/** A sky button in the head of the Organizations page's commitments. */
export const PAGE_BUTTON =
  'inline-flex items-center gap-x-1.5 rounded-full bg-sky-700 py-1.5 pr-3.5 pl-4 text-[13px] leading-4 font-semibold whitespace-nowrap text-white transition-colors hover:bg-sky-800';

/** A subtle title for the table's top left cell: the organizations are its columns. */
export const COMMITMENTS_CORNER = (
  <span className="flex h-full items-center justify-center text-center text-[11px]/4 font-bold tracking-wide text-slate-300 uppercase">
    Commitments by Organization
  </span>
);

/** The "How Scores Work" button: opens the scoring FAQ. A subtle slate pill. */
export const HOW_SCORES_WORK = (
  <FaqModal
    faq={COMMITMENTS_FAQ}
    label="How Scores Work"
    className="inline-flex shrink-0 cursor-pointer items-center rounded-full bg-slate-200 px-4 py-1.5 text-center text-[11px]/[13px] font-semibold text-slate-600 transition-colors hover:bg-slate-300"
  />
);

/** The organizations (columns, the most points first) against the commitments (rows, by category).
 * It scrolls in both directions, with the heads and the commitment names in view. `small`: the
 * phone size at all widths, with 6 organizations in view, smaller text, short commitment names
 * on one line (`SHORT_NAMES`), and cells with only a color. A head's name opens the organization's
 * page, and its bar the organization's commitments.
 * `corner`: the top left cell (default: the title). `inset`: `corner` is at the top, 16px
 * in, as a menu's page link; the heads' names are below it, and the left column is in line with it.
 * `cards`: each organization's home card (by href), for a hover on its bar. `onPick`: on a click of
 * a link. */
export function CommitmentTable({
  grid,
  small,
  corner = COMMITMENTS_CORNER,
  inset,
  cards,
  onPick,
  className,
}: {
  grid: CommitmentGrid;
  small?: boolean;
  corner?: ReactNode;
  inset?: boolean;
  cards?: OrgCards;
  onPick?: () => void;
  className?: string;
}) {
  const { orgs, groups } = grid;
  // `small` under `lg`: less space under the last row.
  const lastRow = cn(LAST_ROW, small && 'max-lg:[tbody:last-child>tr:last-child>&]:pb-2');
  return (
    // `relative`: it also clips the `sr-only` text in the cells. `isolate`: its sticky heads stay under
    // the navbar's menus. `@container`: the columns size from its width.
    <div
      className={cn(
        '@container relative isolate min-h-0 overflow-auto rounded-lg [--head:10.5rem]',
        !small && 'sm:[--head:15.5rem]',
        // `small` under `lg` (the phone): wider columns scroll, faded at the right.
        small && 'max-lg:[mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)]',
        className,
      )}
    >
      <table className="w-full border-separate border-spacing-0 text-xs">
        <thead className="sticky top-0 z-20">
          <tr>
            <th
              className={cn(
                'sticky left-0 z-30 w-(--head) min-w-(--head) bg-white pr-4 pb-1',
                inset ? 'pt-3 pl-4 align-top' : 'pt-3.5 pl-3 text-center align-middle',
              )}
            >
              <span className="sr-only">Commitment</span>
              {corner}
            </th>
            {orgs.map((org) => (
              <th
                key={org.id}
                scope="col"
                // The organizations share the width left, at most `MAX_ORGS` in view (`small`: 6).
                // More scroll.
                style={!small && orgs.length <= MAX_ORGS ? { width: `${100 / orgs.length}%` } : undefined}
                className={cn(
                  'bg-white pb-1 align-bottom font-semibold last:pr-3',
                  inset ? 'pt-10.5' : 'pt-3.5',
                  small
                    ? cn(
                        'px-2',
                        inset
                          ? 'min-w-[calc((100cqw-var(--head))/6.5)]'
                          : 'min-w-[calc((100cqw-var(--head))/6)] max-lg:min-w-20',
                      )
                    : 'min-w-[calc((100cqw-var(--head))/8)] px-0.5 sm:px-1.5 sm:last:pr-4',
                )}
              >
                {/* `w-0 min-w-full`: a long name does not widen its column. */}
                <Link
                  href={organizationPath(org)}
                  onClick={onPick}
                  title={org.name}
                  className={cn(
                    'block w-0 min-w-full truncate text-slate-600 hover:underline',
                    small ? 'text-[11px]/4' : 'text-[13px]/4',
                  )}
                >
                  {org.name}
                </Link>
                <OrgScoreBar
                  href={orgCommitmentsPath(org)}
                  score={org.total}
                  text={formatPoints(org.total.points)}
                  card={cards?.[organizationPath(org)]}
                  barClassName={small ? 'h-6 text-[9px]' : 'h-6 text-[10px]'}
                  wrapperClassName={small ? 'mt-1' : 'mt-2'}
                  onPick={onPick}
                />
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.category}>
            <tr>
              <th
                scope="rowgroup"
                className={cn(
                  'sticky left-0 z-10 bg-white pt-2 pr-2 pb-0.5 text-left text-[10px] font-semibold tracking-wide whitespace-nowrap text-slate-400 uppercase',
                  inset ? 'pl-4' : 'pl-2.5',
                  !small && 'sm:pr-4 sm:pl-4',
                )}
              >
                {CATEGORY_LABELS[g.category]}
              </th>
              <td colSpan={orgs.length} className="bg-white" />
            </tr>
            {g.list.map((c) => (
              <tr key={c.slug} className="group">
                <th
                  scope="row"
                  className={cn(
                    STICKY_COL,
                    lastRow,
                    'pr-2 text-left font-semibold whitespace-normal group-hover:bg-sky-50',
                    inset ? 'pl-4' : 'pl-3',
                    small ? 'py-1.25 align-middle leading-4' : 'py-3 align-top sm:pr-4 sm:pl-6 sm:whitespace-nowrap',
                  )}
                >
                  {/* `small`: one line, with the short name. `w-0 min-w-full`: it does not widen
                      the column. */}
                  <Link
                    href={commitmentPath(c.slug)}
                    onClick={onPick}
                    title={small ? `${c.name}: ${c.about}` : c.about}
                    className={cn(
                      'text-sky-900 hover:underline',
                      small ? 'block w-0 min-w-full truncate text-[11px]' : 'text-[13px]',
                    )}
                  >
                    {small ? (SHORT_NAMES[c.slug] ?? c.name) : c.name}
                  </Link>
                </th>
                {orgs.map((org, i) => {
                  const cell = c.cells[i];
                  return (
                    <td
                      key={org.id}
                      className={cn(
                        lastRow,
                        'bg-white text-center group-hover:bg-sky-50 last:pr-3',
                        small ? 'px-2 py-1.25 align-middle' : 'px-0.5 py-3 align-top sm:px-1.5 sm:last:pr-4',
                      )}
                    >
                      {cell && (
                        <CommitmentCell
                          href={orgCommitmentPath(org, c.slug)}
                          small={small}
                          onPick={onPick}
                          facts={{ org: org.name, commitment: c.name, ...cell }}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
