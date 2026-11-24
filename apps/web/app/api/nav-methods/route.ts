import { clientIp } from '@/lib/rate-limit';
import { allow, tooMany } from '@/lib/server/limits';
import { navMethods } from '@/lib/server/nav-methods';
import { PUBLIC_CACHE } from '@/lib/server/ttl-cache';

// The navbar's Methods menu. Public catalog data only.

export async function GET(request: Request) {
  if (!(await allow('general', 'nav-methods', clientIp(request.headers)))) return tooMany();
  return Response.json(await navMethods(), { headers: PUBLIC_CACHE });
}
