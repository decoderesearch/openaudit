import { clientIp } from '@/lib/rate-limit';
import { allow, tooMany } from '@/lib/server/limits';
import { modelHovers } from '@/lib/server/model-hovers';

// The hover cards of model links, for all models of shown organizations. Public catalog data only.

export async function GET(request: Request) {
  if (!(await allow('general', 'model-hovers', clientIp(request.headers)))) return tooMany();
  return Response.json(await modelHovers(), { headers: { 'Cache-Control': 'public, max-age=300' } });
}
