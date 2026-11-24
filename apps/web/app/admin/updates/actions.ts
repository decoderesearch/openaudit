'use server';

import { runDigest, updatesSendOn } from '@/lib/server/update-digest';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import { revalidatePath } from 'next/cache';

export type SendResult = { ok: true; message: string } | { ok: false; error: string };

/** Admins only: sends today's update email now, if the cron did not yet. */
export async function sendDigestAction(): Promise<SendResult> {
  if (!isAdmin(await getViewer())) return { ok: false, error: 'Only admins can do this.' };
  if (!updatesSendOn()) return { ok: false, error: 'Sending is off here (UPDATES_SEND is not 1).' };
  try {
    const r = await runDigest({ send: true });
    revalidatePath('/admin/updates');
    const message = {
      sent: `Sent ${r.emails.length} ${r.emails.length === 1 ? 'Broadcast' : 'Broadcasts'}.`,
      nothing: 'Nothing new, so no email.',
      already: `The ${r.day} email exists already.`,
      preview: 'Not sent.',
    }[r.outcome];
    return { ok: true, message };
  } catch (e) {
    revalidatePath('/admin/updates');
    return { ok: false, error: e instanceof Error ? e.message : 'Send failed.' };
  }
}
