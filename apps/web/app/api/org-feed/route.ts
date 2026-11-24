import { FEED_PAGE } from '@/lib/feed';
import { isOrgEventFilter } from '@/lib/org-research';
import { clientIp } from '@/lib/rate-limit';
import { allow, tooMany } from '@/lib/server/limits';
import { orgFeedPage } from '@/lib/server/org-feed';

// More of the Organizations page's updates feed, from `offset`, of one `filter` (`departure`),
// `size` at a time (at most `FEED_PAGE`). Public catalog data only.

export async function GET(request: Request) {
  if (!(await allow('general', 'org-feed', clientIp(request.headers)))) return tooMany();
  const params = new URL(request.url).searchParams;
  const offset = Math.max(0, Math.floor(Number(params.get('offset')) || 0));
  const size = Math.min(FEED_PAGE, Math.max(1, Math.floor(Number(params.get('size')) || FEED_PAGE)));
  const filter = params.get('filter');
  return Response.json(await orgFeedPage(offset, isOrgEventFilter(filter) ? filter : null, size), {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
