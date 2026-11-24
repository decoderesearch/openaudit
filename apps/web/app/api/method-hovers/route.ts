import { clientIp } from '@/lib/rate-limit';
import { allow, tooMany } from '@/lib/server/limits';
import { methodHovers } from '@/lib/server/method-hovers';

// The hover cards of method and variant links. Public catalog data only.

export async function GET(request: Request) {
  if (!(await allow('general', 'method-hovers', clientIp(request.headers)))) return tooMany();
  return Response.json(await methodHovers(), { headers: { 'Cache-Control': 'public, max-age=300' } });
}
