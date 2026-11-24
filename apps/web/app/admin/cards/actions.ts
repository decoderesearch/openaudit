'use server';

import { discardCardVersion, publishCardVersion, requestCardRebuild, unpublishCard } from '@/lib/server/card-admin';
import { enqueueCards } from '@/lib/server/run-queue';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';

export type RebuildResult = { ok: true } | { ok: false; error: string };

/** Admins only: asks for a build of the model's card, and starts the cards container. */
export async function rebuildCardAction(modelId: string, force: boolean): Promise<RebuildResult> {
  if (!isAdmin(await getViewer())) return { ok: false, error: 'Only admins can do this.' };
  if (!(await requestCardRebuild(modelId, force)))
    return { ok: false, error: 'This model has no public finished run.' };
  after(() => enqueueCards());
  revalidatePath('/admin/cards');
  return { ok: true };
}

/** Admins only: publishes a card draft, or discards it. */
export async function reviewCardVersionAction(versionId: string, publish: boolean): Promise<RebuildResult> {
  if (!isAdmin(await getViewer())) return { ok: false, error: 'Only admins can do this.' };
  const done = await (publish ? publishCardVersion : discardCardVersion)(versionId);
  if (!done) return { ok: false, error: 'This version is not a draft now. Reload the page.' };
  revalidatePath('/admin/cards');
  return { ok: true };
}

/** Admins only: removes the model's OpenAudit from the public site (`unpublishCard`). */
export async function unpublishCardAction(modelId: string): Promise<RebuildResult> {
  if (!isAdmin(await getViewer())) return { ok: false, error: 'Only admins can do this.' };
  if (!(await unpublishCard(modelId))) return { ok: false, error: 'This OpenAudit is not published now.' };
  revalidatePath('/admin/cards');
  return { ok: true };
}
