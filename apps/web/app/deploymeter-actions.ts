'use server';

import { prisma } from '@/lib/db';
import { HUMAN_REVIEWS_ENABLED, MAX_REVIEW_CHARS, MIN_REVIEW_CHARS } from '@/lib/deploymeter';
import { deleteHumanReview, reviewPanel, saveHumanReview } from '@/lib/server/deploymeter';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import { revalidatePath } from 'next/cache';

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Admins only: publishes a draft panel, or discards it. */
export async function reviewPanelAction(panelId: string, publish: boolean): Promise<ActionResult> {
  if (!isAdmin(await getViewer())) return { ok: false, error: 'Only admins can do this.' };
  if (!(await reviewPanel(panelId, publish)))
    return { ok: false, error: 'This panel is not a draft now. Reload the page.' };
  revalidatePath('/judges', 'layout');
  revalidatePath('/admin/deploymeter');
  return { ok: true };
}

/** Saves the viewer's review of the model: a score from 0 to 100 (a multiple of 5) and a text. */
export async function saveHumanReviewAction(modelId: string, score: number, text: string): Promise<ActionResult> {
  if (!HUMAN_REVIEWS_ENABLED) return { ok: false, error: 'Reviews are not open yet.' };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: 'Sign in to write a review.' };
  if (viewer.banned) return { ok: false, error: 'Your account cannot write reviews.' };
  if (!Number.isInteger(score) || score < 0 || score > 100 || score % 5 !== 0)
    return { ok: false, error: 'The score must be 0 to 100, in steps of 5.' };
  const body = text.trim();
  if (body.length < MIN_REVIEW_CHARS) return { ok: false, error: `Write at least ${MIN_REVIEW_CHARS} characters.` };
  if (body.length > MAX_REVIEW_CHARS) return { ok: false, error: `Write at most ${MAX_REVIEW_CHARS} characters.` };
  if (!(await prisma.model.findUnique({ where: { id: modelId }, select: { id: true } })))
    return { ok: false, error: 'No such model.' };
  await saveHumanReview(viewer, modelId, score, body);
  return { ok: true };
}

export async function deleteHumanReviewAction(modelId: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: 'Sign in first.' };
  if (!(await deleteHumanReview(viewer, modelId))) return { ok: false, error: 'You have no review of this model.' };
  return { ok: true };
}
