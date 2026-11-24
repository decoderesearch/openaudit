import { SIGN_IN_ENABLED } from '@/lib/env';
import { VERIFY_PARAMS } from '@/lib/sign-in';
import { NextResponse } from 'next/server';

// The confirm page's form posts here. A redirect (303, so the browser uses GET) sends it to
// Better Auth's verify endpoint, which uses the token and sets the session cookie.
export async function POST(request: Request) {
  if (!SIGN_IN_ENABLED) return new Response('Not found.', { status: 404 });
  const form = await request.formData();
  const params = new URLSearchParams();
  for (const key of VERIFY_PARAMS) {
    const value = form.get(key);
    if (typeof value === 'string' && value) params.set(key, value);
  }
  return NextResponse.redirect(new URL(`/api/auth/magic-link/verify?${params}`, request.url), 303);
}
