'use server';

import { prodSyncOff, syncToProd, type SyncResult } from '@/lib/server/prod-sync';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import { revalidatePath } from 'next/cache';

export type SyncActionResult = { ok: true; result: SyncResult } | { ok: false; error: string };

/** Admins only, on a local server: copies the runs and cards that the sync page shows. */
export async function syncToProdAction(): Promise<SyncActionResult> {
  if (!isAdmin(await getViewer())) return { ok: false, error: 'Only admins can do this.' };
  const off = prodSyncOff();
  if (off) return { ok: false, error: off };
  try {
    const result = await syncToProd();
    revalidatePath('/admin/sync');
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
