'use server';

import type { ProfileInput } from '@/lib/profile';
import { saveProfile, type ActionResult } from '@/lib/server/profile';
import { getViewer } from '@/lib/server/viewer';
import { revalidatePath } from 'next/cache';

export async function updateProfile(input: ProfileInput): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: 'Not signed in.' };
  const result = await saveProfile(viewer.id, input);
  if (result.ok) revalidatePath('/', 'layout');
  return result;
}
