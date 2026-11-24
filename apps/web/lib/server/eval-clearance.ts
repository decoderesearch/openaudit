import { checkClearance, CLEARANCE_COOKIE, signClearance } from '@/lib/clearance-token';
import { BETTER_AUTH_SECRET } from '@/lib/env';
import { getViewer, type Viewer } from '@/lib/server/viewer';
import { cookies, headers } from 'next/headers';

// Who can read eval content: staff (admins and moderators) with any client, and people who made
// the statement in our web pages and passed the browser check. The second group gets a signed
// cookie. A request with an API key that is not staff never passes: no scripts or agents yet.

export { CLEARANCE_COOKIE, CLEARANCE_DAYS } from '@/lib/clearance-token';

/** A signed token for a person who made the statement. */
export const clearanceToken = (now = Date.now()) => signClearance(BETTER_AUTH_SECRET, now);

/** True when the token is ours, for the current statement, and not expired. */
export const clearanceOk = (token: string | undefined, now = Date.now()) =>
  checkClearance(BETTER_AUTH_SECRET, token, now);

export const isStaff = (viewer: Viewer | null) =>
  !!viewer && !viewer.banned && (viewer.role === 'admin' || viewer.role === 'moderator');

/** True when this request may read eval content (before the dataset's own rule). */
export async function hasEvalClearance(): Promise<boolean> {
  const [viewer, h, jar] = await Promise.all([getViewer(), headers(), cookies()]);
  if (isStaff(viewer)) return true;
  if (h.get('x-api-key')) return false;
  return clearanceOk(jar.get(CLEARANCE_COOKIE)?.value);
}

/** The 428 answer for a request without clearance. */
export function clearanceRequired(): Response {
  return Response.json(
    {
      code: 'clearance',
      error:
        'Eval content is open only to people on our web pages, after a short statement and a browser check, and to staff.',
    },
    { status: 428, headers: { 'cache-control': 'no-store' } },
  );
}
