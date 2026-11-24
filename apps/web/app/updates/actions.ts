'use server';

import {
  blockUpdates,
  readConfirmToken,
  readUnsubscribeToken,
  setSubscription,
  updatesOff,
} from '@/lib/server/updates';
import { getViewer } from '@/lib/server/viewer';
import { parseLists } from '@/lib/updates';
import { revalidatePath } from 'next/cache';

export type UpdatesResult = { ok: true } | { ok: false; error: string };

const FAILED = 'We could not save it. Try again later.';

/** Starts the updates in a confirm link. */
export async function confirmUpdatesAction(token: string): Promise<UpdatesResult> {
  const req = await readConfirmToken(token);
  if (!req) return { ok: false, error: 'This link is not valid or it expired. Subscribe again.' };
  try {
    await setSubscription(req.email, req.lists);
    return { ok: true };
  } catch (e) {
    console.error('[updates] confirm failed', e);
    return { ok: false, error: FAILED };
  }
}

/** Stops all update emails to the address in an unsubscribe link. */
export async function unsubscribeAction(token: string): Promise<UpdatesResult> {
  const email = await readUnsubscribeToken(token);
  if (!email) return { ok: false, error: 'This link is not valid.' };
  const off = updatesOff();
  if (off) return { ok: false, error: off };
  try {
    await blockUpdates(email);
    return { ok: true };
  } catch (e) {
    console.error('[updates] unsubscribe failed', e);
    return { ok: false, error: FAILED };
  }
}

/** Signed-in users: sets the lists for the account's email. No lists stops all updates. */
export async function saveUpdatesAction(lists: string[]): Promise<UpdatesResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: 'Sign in first.' };
  const off = updatesOff();
  if (off) return { ok: false, error: off };
  try {
    await setSubscription(viewer.email.toLowerCase(), parseLists(lists));
    revalidatePath('/settings');
    return { ok: true };
  } catch (e) {
    console.error('[updates] save failed', e);
    return { ok: false, error: FAILED };
  }
}
