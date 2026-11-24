'use server';

import { isSubmissionStatus } from '@/lib/report';
import { setSubmissionState } from '@/lib/server/submissions-admin';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import { revalidatePath } from 'next/cache';

export type SubmissionResult = { ok: true } | { ok: false; error: string };

/** Admins only: sets a submission's status and note. */
export async function setSubmissionAction(id: string, status: string, note: string): Promise<SubmissionResult> {
  if (!isAdmin(await getViewer())) return { ok: false, error: 'Only admins can do this.' };
  if (!isSubmissionStatus(status)) return { ok: false, error: 'Unknown status.' };
  if (note.length > 4000) return { ok: false, error: 'The note has more than 4000 characters.' };
  if (!(await setSubmissionState(id, status, note))) return { ok: false, error: 'No such submission.' };
  revalidatePath('/admin', 'layout');
  return { ok: true };
}
