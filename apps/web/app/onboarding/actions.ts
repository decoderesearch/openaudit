'use server';

import type { ProfileInput } from '@/lib/profile';
import { saveProfile, type ActionResult } from '@/lib/server/profile';
import { getViewer } from '@/lib/server/viewer';

export async function completeOnboarding(input: ProfileInput): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: 'Not signed in.' };
  return saveProfile(viewer.id, input, { onboardedAt: viewer.onboardedAt ?? new Date() });
}
