import { isOrgEventFilter } from '@/lib/org-research';
import { clientIp } from '@/lib/rate-limit';
import { allow, tooMany } from '@/lib/server/limits';
import { navOrgs, navOrgUpdates } from '@/lib/server/nav-orgs';
import { PUBLIC_CACHE } from '@/lib/server/ttl-cache';

// The navbar's Organizations menu, when the page came without it. With `updates` (`departure`):
// only the updates of that filter. Public catalog data only.

export async function GET(request: Request) {
  if (!(await allow('general', 'nav-orgs', clientIp(request.headers)))) return tooMany();
  const headers = PUBLIC_CACHE;
  const filter = new URL(request.url).searchParams.get('updates');
  if (filter !== null) {
    if (!isOrgEventFilter(filter)) return Response.json({ error: 'Unknown filter.' }, { status: 400 });
    return Response.json({ updates: await navOrgUpdates(filter) }, { headers });
  }
  return Response.json(await navOrgs(), { headers });
}
