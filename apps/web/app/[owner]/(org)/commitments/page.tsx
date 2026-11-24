import { INSET_TITLE } from '@/components/box-title';
import { LevelPill, ScoreBar } from '@/components/commitments/level-pill';
import Link from '@/components/link';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  COMMITMENTS_PATH,
  criteriaScore,
  formatPoints,
  orgCommitmentPath,
  orgCommitmentsPath,
  totalScore,
  type Points,
} from '@/lib/commitments';
import { formatDate, plainText } from '@/lib/org-research';
import { findOrganization, isHiddenOrganization } from '@/lib/server/catalog';
import { listOrgCommitments } from '@/lib/server/commitments';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import { cn } from '@/lib/utils';
import { Handshake } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

// An organization's safety commitments: `/<org>/commitments`, by category.

type Props = { params: Promise<{ owner: string }> };

async function load(params: Props['params']) {
  const named = await findOrganization((await params).owner);
  if (!named) return null;
  if ((await isHiddenOrganization(named.org.id)) && !isAdmin(await getViewer())) return null;
  return { ...named, rows: await listOrgCommitments(named.org.id) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await load(params);
  if (!found) return { title: 'Commitments' };
  return {
    title: `Safety Commitments of ${found.org.displayName}`,
    alternates: { canonical: orgCommitmentsPath(found.org) },
  };
}

export default async function OrgCommitmentsPage({ params }: Props) {
  const found = await load(params);
  if (!found) notFound();
  if (found.redirect) permanentRedirect(orgCommitmentsPath(found.org));
  const { org, rows } = found;
  const scoreOf = (list: typeof rows) =>
    totalScore(
      list.map(({ commitment, cell }) => ({ state: cell?.state, keys: commitment.criteria.map((x) => x.key) })),
    );
  const total = scoreOf(rows);
  const byCategory = CATEGORY_ORDER.map((category) => ({
    category,
    score: scoreOf(rows.filter((r) => r.commitment.category === category)),
  })).filter((c) => c.score.total);
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex h-10 items-center justify-between gap-x-3 bg-slate-50 px-4 sm:px-5">
        <h1 className={cn(INSET_TITLE, 'flex items-center gap-x-1.5 text-xs')}>
          <Handshake aria-hidden className="size-3.5 text-emerald-700" strokeWidth={2.5} />
          Safety Commitments
        </h1>
        <Link href={COMMITMENTS_PATH} className="text-xs font-medium text-sky-800 hover:underline">
          Compare Organizations
        </Link>
      </div>
      {total.total > 0 && (
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3 px-4 py-3 sm:px-5">
          <Score label="Total Score" score={total} large />
          <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            {byCategory.map(({ category, score }) => (
              <Score key={category} label={CATEGORY_LABELS[category]} score={score} />
            ))}
          </dl>
        </div>
      )}
      {CATEGORY_ORDER.map((category) => {
        const list = rows.filter((r) => r.commitment.category === category);
        if (!list.length) return null;
        return (
          <div key={category}>
            <h2 className="border-y border-slate-100 px-4 py-1.5 text-[10px] font-semibold tracking-wide text-slate-500 uppercase sm:px-5">
              {CATEGORY_LABELS[category]}
            </h2>
            <ul>
              {list.map(({ commitment: c, cell }) => (
                <li
                  key={c.slug}
                  className="relative flex items-center justify-between gap-x-4 border-b border-slate-100 py-2.5 pr-4 pl-7 last:border-b-0 hover:bg-sky-50 sm:pr-5 sm:pl-8"
                >
                  <div className="flex min-w-0 flex-col gap-y-0.5">
                    <p className="flex flex-wrap items-baseline gap-x-1.5">
                      <Link
                        href={orgCommitmentPath(org, c.slug)}
                        className="text-[13px] font-semibold text-slate-800 after:absolute after:inset-0"
                      >
                        {c.name}
                      </Link>
                      {cell?.latest && (
                        <>
                          <span aria-hidden className="text-slate-300">
                            ·
                          </span>
                          <span className="text-[10px] text-slate-500 tabular-nums">
                            Updated {formatDate(cell.latest)}
                          </span>
                        </>
                      )}
                    </p>
                    <p className="line-clamp-2 text-xs text-slate-500">
                      {cell?.summary
                        ? plainText(cell.summary)
                        : cell
                          ? 'No public commitment found.'
                          : 'Not checked yet.'}
                    </p>
                  </div>
                  {cell && (
                    <LevelPill
                      state={cell.state}
                      score={criteriaScore(
                        cell.state,
                        c.criteria.map((x) => x.key),
                      )}
                      className="shrink-0"
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

/** A label over a bar that the points fill, with the points in it. `large`: the total, outside a list. */
function Score({ label, score, large }: { label: string; score: Points; large?: boolean }) {
  const Term = large ? 'span' : 'dt';
  const Value = large ? 'span' : 'dd';
  return (
    <div className="flex min-w-0 flex-col justify-end gap-y-0.5">
      <Term className="text-[10px]/3.5 font-semibold tracking-wide text-slate-500 uppercase">{label}</Term>
      <Value>
        <ScoreBar
          score={score}
          text={formatPoints(score.points)}
          label={label}
          size={large ? 'md' : 'sm'}
          className={large ? 'h-7 w-24 text-sm' : undefined}
        />
      </Value>
    </div>
  );
}
