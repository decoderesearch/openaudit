import { clientIp } from '@/lib/rate-limit';
import { commitmentEventsPage } from '@/lib/server/commitments';
import { allow, tooMany } from '@/lib/server/limits';

// More of a commitment's events (`commitment`: its slug), from `offset`. Public catalog data only.

export async function GET(request: Request) {
  if (!(await allow('general', 'commitment-events', clientIp(request.headers)))) return tooMany();
  const params = new URL(request.url).searchParams;
  const offset = Math.max(0, Math.floor(Number(params.get('offset')) || 0));
  const page = await commitmentEventsPage(params.get('commitment') ?? '', offset);
  if (!page) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(page, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
