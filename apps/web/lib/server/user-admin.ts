import { prisma } from '@/lib/db';
import { SITE_ROLES, type SiteRole } from '@/lib/roles';

export const USERS_SHOWN = 200;

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  username: string | null;
  role: SiteRole;
  banned: boolean;
  createdAt: Date;
};

const asRole = (value: string | null): SiteRole =>
  (SITE_ROLES as readonly string[]).includes(value ?? '') ? (value as SiteRole) : 'user';

/** Users that match `q` (email, name or handle), admins and moderators first, then newest first. */
export async function adminUsers(q?: string): Promise<{ users: AdminUser[]; total: number }> {
  const text = q?.trim();
  const where = text
    ? {
        OR: [
          { email: { contains: text, mode: 'insensitive' as const } },
          { name: { contains: text, mode: 'insensitive' as const } },
          { username: { contains: text, mode: 'insensitive' as const } },
        ],
      }
    : {};
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, email: true, name: true, username: true, role: true, banned: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: USERS_SHOWN,
    }),
    prisma.user.count({ where }),
  ]);
  const rank: Record<SiteRole, number> = { admin: 0, moderator: 1, user: 2 };
  const users = rows
    .map((u) => ({ ...u, role: asRole(u.role), banned: Boolean(u.banned) }))
    .sort((a, b) => rank[a.role] - rank[b.role]);
  return { users, total };
}

/** Sets the user's role and writes it to the audit log. False when there is no such user. */
export async function setUserRole(actorId: string, userId: string, role: SiteRole) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user) return false;
    const from = asRole(user.role);
    if (from === role) return true;
    await tx.user.update({ where: { id: userId }, data: { role } });
    await tx.auditLog.create({
      data: { actorId, action: 'set_role', targetType: 'user', targetId: userId, meta: { from, to: role } },
    });
    return true;
  });
}
