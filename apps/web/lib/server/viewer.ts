import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PUBLIC_RUNS_ENABLED, SIGN_IN_ENABLED } from '@/lib/env';
import { SITE_ROLES, type SiteRole } from '@/lib/roles';
import { APIError } from 'better-auth/api';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';

export type Viewer = {
  id: string;
  email: string;
  name: string;
  username: string | null;
  role: SiteRole;
  banned: boolean;
  onboardedAt: Date | null;
  affiliation: string | null;
  website: string | null;
};

function asRole(value: string | null): SiteRole {
  return (SITE_ROLES as readonly string[]).includes(value ?? '') ? (value as SiteRole) : 'user';
}

// The signed-in user, read from the database so role and onboarding changes show up without
// waiting for the session cookie cache to expire. A bad API key gives null, not an error.
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!SIGN_IN_ENABLED) return null;
  const session = await auth.api.getSession({ headers: await headers() }).catch((error: unknown) => {
    if (error instanceof APIError) return null;
    throw error;
  });
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      role: true,
      banned: true,
      onboardedAt: true,
      affiliation: true,
      website: true,
    },
  });
  if (!user) return null;
  return { ...user, role: asRole(user.role), banned: Boolean(user.banned) };
});

// For pages that need a signed-in user. Redirects to sign-in, then back.
export async function requireViewer(returnTo: string): Promise<Viewer> {
  if (!SIGN_IN_ENABLED) notFound();
  const viewer = await getViewer();
  if (!viewer) redirect(`/signin?returnTo=${encodeURIComponent(returnTo)}`);
  return viewer;
}

// For pages that need a signed-in user who finished onboarding.
export async function requireOnboarded(returnTo: string): Promise<Viewer> {
  const viewer = await requireViewer(returnTo);
  if (!viewer.onboardedAt) redirect(`/onboarding?returnTo=${encodeURIComponent(returnTo)}`);
  return viewer;
}

export function isAdmin(viewer: Viewer | null): boolean {
  return viewer?.role === 'admin';
}

// Who can start runs that our OpenRouter key pays for. With sign-in off: local development only.
// With `PUBLIC_RUNS_ENABLED` off: admins only.
export function canSpend(viewer: Viewer | null): boolean {
  if (!SIGN_IN_ENABLED) return process.env.NODE_ENV === 'development';
  if (!viewer || viewer.banned) return false;
  return viewer.role === 'admin' || (PUBLIC_RUNS_ENABLED && viewer.role === 'moderator');
}
