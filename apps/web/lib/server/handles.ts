import { prisma } from '../db';
import { handleError, normalizeHandle, suggestHandle } from '../handles';

// Why `raw` cannot be this user's handle, or null if it can. Checks the rules, other users and
// organization slugs.
export async function handleProblem(raw: string, owner: { userId?: string } = {}): Promise<string | null> {
  const handle = normalizeHandle(raw);
  const rule = handleError(handle);
  if (rule) return rule;
  const [user, org] = await Promise.all([
    prisma.user.findUnique({ where: { username: handle }, select: { id: true } }),
    prisma.organization.findFirst({
      where: { OR: [{ slug: handle }, { slugAliases: { has: handle } }] },
      select: { id: true },
    }),
  ]);
  if ((user && user.id !== owner.userId) || org) return 'This name is taken.';
  return null;
}

// A username from the part of the email before "@", or '' when it is taken or not allowed.
export async function suggestUsername(email: string, userId: string): Promise<string> {
  const handle = suggestHandle(email.split('@')[0] ?? '');
  return (await handleProblem(handle, { userId })) ? '' : handle;
}
