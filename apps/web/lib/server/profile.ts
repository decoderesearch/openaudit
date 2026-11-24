import { Prisma } from '#prisma';
import { prisma } from '../db';
import { firstIssue, ProfileSchema, type ProfileInput } from '../profile';
import { handleProblem } from './handles';

export type ActionResult = { ok: true } | { ok: false; error: string };

// Validates and saves a user's profile. The username goes through the same rules and
// namespace check as the Better Auth username plugin.
export async function saveProfile(
  userId: string,
  input: ProfileInput,
  extra: { onboardedAt?: Date } = {},
): Promise<ActionResult> {
  const parsed = ProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const d = parsed.data;
  const problem = await handleProblem(d.username, { userId });
  if (problem) return { ok: false, error: `Username: ${problem}` };
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        username: d.username,
        name: d.name,
        affiliation: d.affiliation || null,
        website: d.website || null,
        ...extra,
      },
    });
  } catch (e) {
    // Another account took the username between the check and the write.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { ok: false, error: 'Username: This name is taken.' };
    }
    throw e;
  }
  return { ok: true };
}
