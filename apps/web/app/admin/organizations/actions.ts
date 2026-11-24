'use server';

import { setModelHidden, setOrganizationHidden } from '@/lib/server/org-admin';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import { revalidatePath } from 'next/cache';

export type HideResult = { ok: true } | { ok: false; error: string };

/** Admins only: hides the organization and its models from the public, or shows them. */
export async function hideOrganizationAction(id: string, hidden: boolean): Promise<HideResult> {
  if (!isAdmin(await getViewer())) return { ok: false, error: 'Only admins can do this.' };
  if (!(await setOrganizationHidden(id, hidden))) return { ok: false, error: 'No such organization.' };
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Admins only: hides the model, its page and its runs from the public, or shows them. */
export async function hideModelAction(id: string, hidden: boolean): Promise<HideResult> {
  if (!isAdmin(await getViewer())) return { ok: false, error: 'Only admins can do this.' };
  if (!(await setModelHidden(id, hidden))) return { ok: false, error: 'No such model.' };
  revalidatePath('/', 'layout');
  return { ok: true };
}
