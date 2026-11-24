import { clientIp } from '@/lib/rate-limit';
import { allow, tooMany } from '@/lib/server/limits';
import { navTopics } from '@/lib/server/nav-topics';
import { PUBLIC_CACHE } from '@/lib/server/ttl-cache';

// The navbar's Topics menu. Public catalog data only.

export async function GET(request: Request) {
  if (!(await allow('general', 'nav-topics', clientIp(request.headers)))) return tooMany();
  return Response.json(await navTopics(), { headers: PUBLIC_CACHE });
}
