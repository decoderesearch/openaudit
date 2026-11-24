import { INSET_TITLE } from '@/components/box-title';
import { LevelPill } from '@/components/commitments/level-pill';
import { CommitmentTimeline, CriteriaTable } from '@/components/commitments/timeline';
import Link from '@/components/link';
import { Markdown } from '@/components/markdown';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import {
  CATEGORY_LABELS,
  commitmentPath,
  COMMITMENTS_PATH,
  criteriaScore,
  LEVELS,
  orgCommitmentPath,
} from '@/lib/commitments';
import { formatDate, plainText } from '@/lib/org-research';
import { findOrganization, isHiddenOrganization } from '@/lib/server/catalog';
import { getOrgCommitment } from '@/lib/server/commitments';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import { cn } from '@/lib/utils';
import { Grid3x3 } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

// One organization's state and timeline for one commitment: `/<org>/commitments/<slug>`.

type Props = { params: Promise<{ owner: string; commitment: string }> };

async function load(params: Props['params']) {
  const { owner, commitment } = await params;
  const named = await findOrganization(owner);
  if (!named) return null;
  if ((await isHiddenOrganization(named.org.id)) && !isAdmin(await getViewer())) return null;
  const found = await getOrgCommitment(named.org.id, decodeURIComponent(commitment));
  return found && { ...named, ...found };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await load(params);
  if (!found) return { title: 'Commitment' };
  const title = `${found.commitment.name}: ${found.org.displayName}`;
  return {
    title,
    description: found.cell?.summary ? plainText(found.cell.summary) : plainText(found.commitment.summary),
    alternates: { canonical: orgCommitmentPath(found.org, found.commitment.slug) },
  };
}

export default async function OrgCommitmentPage({ params }: Props) {
  const found = await load(params);
  if (!found) notFound();
  const { org, commitment: c, cell, events } = found;
  if (found.redirect) permanentRedirect(orgCommitmentPath(org, c.slug));
  const state = cell?.state;
  const keys = c.criteria.map((x) => x.key);
  const score = state && criteriaScore(state, keys);

  return (
    <article className="flex flex-col gap-y-6 rounded-lg border border-slate-200 bg-white px-4 py-4 sm:px-5">
      <header className="flex flex-col gap-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className={cn(INSET_TITLE, 'text-slate-400')}>
            Safety Commitment <span aria-hidden>·</span> {CATEGORY_LABELS[c.category]}
          </span>
          <Link
            href={COMMITMENTS_PATH}
            className="inline-flex items-center gap-x-1 text-xs font-medium text-sky-800 hover:underline"
          >
            <Grid3x3 aria-hidden className="size-3.5" />
            All Commitments
          </Link>
        </div>
        <h1 className="font-display text-lg font-semibold text-slate-800">
          <HoverCard>
            <HoverCardTrigger asChild>
              <Link href={commitmentPath(c.slug)} className="hover:text-sky-800">
                {c.name}
              </Link>
            </HoverCardTrigger>
            <HoverCardContent side="bottom" className="text-xs">
              <span className={cn(INSET_TITLE, 'block')}>Criteria</span>
              <span className="mt-1 block font-sans font-normal text-slate-700">{plainText(c.summary)}</span>
            </HoverCardContent>
          </HoverCard>
        </h1>
        <div className="flex items-center gap-x-3">
          {state ? (
            <LevelPill state={state} score={score} size="md" className="h-7" />
          ) : (
            <span className="text-xs text-slate-500">Not checked yet.</span>
          )}
          <Markdown
            text={cell?.summary ?? (state ? LEVELS[state.level].about : c.summary)}
            className="max-w-3xl min-w-0 text-[13px]/[18px] text-slate-800"
          />
        </div>
      </header>

      <CriteriaTable criteria={c.criteria} state={state} />

      {events.length > 0 && (
        <section aria-label="Timeline">
          <CommitmentTimeline events={events} keys={keys} />
        </section>
      )}

      {cell && (
        <p className="text-right text-[11px] text-slate-400">
          Checked {formatDate(cell.checkedAt)}
          {cell.checkedBy && ` by ${cell.checkedBy}`}
        </p>
      )}
    </article>
  );
}
