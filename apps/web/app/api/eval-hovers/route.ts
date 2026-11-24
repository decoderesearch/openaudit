import { clientIp } from '@/lib/rate-limit';
import { evalHovers } from '@/lib/server/eval-hovers';
import { allow, tooMany } from '@/lib/server/limits';

// The hover cards of eval links, for all public evals. Public catalog data only.

export async function GET(request: Request) {
  if (!(await allow('general', 'eval-hovers', clientIp(request.headers)))) return tooMany();
  return Response.json(await evalHovers(), { headers: { 'Cache-Control': 'public, max-age=300' } });
}
