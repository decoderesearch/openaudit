import { FEED_PAGE } from '@/lib/feed';
import { ORG_SORTS, sortOf } from '@/lib/home-sorts';
import { clientIp } from '@/lib/rate-limit';
import { homeOrgsPage } from '@/lib/server/home-orgs';
import { allow, tooMany } from '@/lib/server/limits';

// More of the home page's organizations, from `offset`, `size` at a time (at most `FEED_PAGE`), in
// the order of `sort` (`ORG_SORTS`).

const CACHE = { 'Cache-Control': 'public, max-age=300' };

export async function GET(request: Request) {
  if (!(await allow('general', 'home-orgs', clientIp(request.headers)))) return tooMany();
  const params = new URL(request.url).searchParams;
  const offset = Math.max(0, Math.floor(Number(params.get('offset')) || 0));
  const size = Math.min(FEED_PAGE, Math.max(1, Math.floor(Number(params.get('size')) || FEED_PAGE)));
  return Response.json(await homeOrgsPage(offset, size, sortOf(ORG_SORTS, params.get('sort'))), { headers: CACHE });
}
