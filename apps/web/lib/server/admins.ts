import { prisma } from '@/lib/db';

/** The addresses of the users with the admin role who are not banned. */
export async function adminEmails(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: 'admin', NOT: { banned: true } },
    select: { email: true },
  });
  return [...new Set(admins.map((a) => a.email.toLowerCase()))];
}
