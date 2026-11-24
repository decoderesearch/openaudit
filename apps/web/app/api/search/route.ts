import { clientIp } from '@/lib/rate-limit';
import { SEARCH_MAX_CHARS } from '@/lib/search';
import { allow, tooMany } from '@/lib/server/limits';
import { searchSite } from '@/lib/server/search';

// The navbar search. Public catalog data only: models, public evals and organizations.

export async function GET(request: Request) {
  if (!(await allow('general', 'search', clientIp(request.headers)))) return tooMany();
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (q.length > SEARCH_MAX_CHARS) {
    return Response.json({ error: `Search is at most ${SEARCH_MAX_CHARS} characters.` }, { status: 400 });
  }
  const results = await searchSite(q);
  return Response.json(results, { headers: { 'Cache-Control': 'public, max-age=60' } });
}
