import { auth } from '@/lib/auth';
import { SIGN_IN_ENABLED } from '@/lib/env';
import { clientIp } from '@/lib/rate-limit';
import { allow, tooMany } from '@/lib/server/limits';
import { toNextJsHandler } from 'better-auth/next-js';

const handler = toNextJsHandler(auth.handler);
const off = () => new Response('Not found.', { status: 404 });

// Each magic-link request sends an email.
async function post(request: Request) {
  const magicLink = new URL(request.url).pathname.endsWith('/sign-in/magic-link');
  if (magicLink && !(await allow('strict', 'sign-in', clientIp(request.headers)))) return tooMany();
  return handler.POST(request);
}

export const GET = SIGN_IN_ENABLED ? handler.GET : off;
export const POST = SIGN_IN_ENABLED ? post : off;
