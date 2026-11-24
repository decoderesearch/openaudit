import { clientIp } from '@/lib/rate-limit';
import { allow, tooMany } from '@/lib/server/limits';
import { navModels } from '@/lib/server/nav-models';
import { PUBLIC_CACHE } from '@/lib/server/ttl-cache';

// The navbar's Models menu. Public catalog data only.

export async function GET(request: Request) {
  if (!(await allow('general', 'nav-models', clientIp(request.headers)))) return tooMany();
  return Response.json(await navModels(), { headers: PUBLIC_CACHE });
}
