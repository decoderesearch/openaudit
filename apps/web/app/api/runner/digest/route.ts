import { runnerTokenOk } from '@/lib/server/runner-token';
import { runDigest, updatesAutoSendOn } from '@/lib/server/update-digest';
import { updatesOff } from '@/lib/server/updates';

// The runner Worker's daily cron calls this with `Authorization: Bearer <token>`. With
// UPDATES_AUTO_SEND=1, it sends the update email (lib/server/update-digest.ts); else it only makes
// a preview. A second send on the same day does nothing.

export async function POST(req: Request) {
  if (!(await runnerTokenOk(req.headers.get('authorization'))))
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  if (updatesOff()) return Response.json({ outcome: 'off' });
  try {
    const r = await runDigest({ send: updatesAutoSendOn() });
    return Response.json({
      day: r.day,
      outcome: r.outcome,
      counts: r.counts,
      segments: r.emails.map((e) => e.segment),
      broadcasts: r.broadcasts ?? {},
    });
  } catch (e) {
    console.error('[updates] digest failed', e);
    return Response.json({ error: e instanceof Error ? e.message : 'Digest failed.' }, { status: 502 });
  }
}
