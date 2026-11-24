'use server';

import type { IssueStatus } from '@/lib/sample-issues';
import { getEval } from '@/lib/server/catalog';
import { reviewIssues, reviewIssuesAnyVersion } from '@/lib/server/sample-issues';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import { revalidatePath } from 'next/cache';

export type ReviewResult = { ok: true; changed: number } | { ok: false; error: string };

const revalidateEval = (slug: string) => {
  revalidatePath(`/evaluations/${slug}`);
  revalidatePath(`/evaluations/${slug}/known-errors`);
  revalidatePath('/evaluations/known-errors');
};

/** Admins only: confirms, rejects or reopens known errors. With a slug: those of the eval's newest
 * version. With null: those of any eval (the admin list). */
export async function reviewIssuesAction(
  slug: string | null,
  ids: string[],
  status: IssueStatus,
): Promise<ReviewResult> {
  const viewer = await getViewer();
  if (!isAdmin(viewer)) return { ok: false, error: 'Only admins can do this.' };
  if (!['proposed', 'confirmed', 'rejected'].includes(status)) return { ok: false, error: 'Unknown status.' };
  if (slug === null) {
    const { changed, slugs } = await reviewIssuesAnyVersion(ids.slice(0, 2000), status, viewer!.email);
    slugs.forEach(revalidateEval);
    revalidatePath('/admin/known-errors');
    return { ok: true, changed };
  }
  const latest = (await getEval(slug))?.versions[0];
  if (!latest) return { ok: false, error: 'No such eval.' };
  const changed = await reviewIssues(latest.id, ids.slice(0, 2000), status, viewer!.email);
  revalidateEval(slug);
  revalidatePath('/admin/known-errors');
  return { ok: true, changed };
}
