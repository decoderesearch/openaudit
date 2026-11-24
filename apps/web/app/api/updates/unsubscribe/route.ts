import { clientIp } from '@/lib/rate-limit';
import { allow, tooMany } from '@/lib/server/limits';
import { blockUpdates, readUnsubscribeToken, updatesOff } from '@/lib/server/updates';

// The one-click unsubscribe of a mail app (RFC 8058): a POST to the `List-Unsubscribe` URL of an
// email. It stops all update emails to the address in the signed token `t`.

export async function POST(request: Request) {
  if (!(await allow('general', 'unsubscribe', clientIp(request.headers)))) return tooMany();
  const email = await readUnsubscribeToken(new URL(request.url).searchParams.get('t') ?? '');
  if (!email) return Response.json({ error: 'This link is not valid.' }, { status: 400 });
  const off = updatesOff();
  if (off) return Response.json({ error: off }, { status: 503 });
  try {
    await blockUpdates(email);
  } catch (e) {
    console.error('[updates] one-click unsubscribe failed', e);
    return Response.json({ error: 'We could not save it. Try again later.' }, { status: 502 });
  }
  return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}
