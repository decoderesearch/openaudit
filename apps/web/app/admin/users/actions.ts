'use server';

import { SITE_ROLES, type SiteRole } from '@/lib/roles';
import { setUserRole } from '@/lib/server/user-admin';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import { revalidatePath } from 'next/cache';

export type SetRoleResult = { ok: true } | { ok: false; error: string };

/** Admins only. An admin cannot change their own role, so that the site always keeps an admin. */
export async function setRoleAction(userId: string, role: SiteRole): Promise<SetRoleResult> {
  const viewer = await getViewer();
  if (!viewer || !isAdmin(viewer)) return { ok: false, error: 'Only admins can do this.' };
  if (!SITE_ROLES.includes(role)) return { ok: false, error: 'That is not a role.' };
  if (userId === viewer.id) return { ok: false, error: 'You cannot change your own role. Ask another admin.' };
  if (!(await setUserRole(viewer.id, userId, role))) return { ok: false, error: 'We could not find this user.' };
  revalidatePath('/admin/users');
  return { ok: true };
}
