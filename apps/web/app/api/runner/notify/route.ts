import { cardDraftReady } from '@/lib/server/card-admin';
import { runEnded } from '@/lib/server/run-ended';
import { runnerTokenOk } from '@/lib/server/runner-token';

// The runner calls this with `Authorization: Bearer <token>`: `{ runId }` when a run ends, or
// `{ cardVersionId }` when a card draft is ready. We read the state from the database and send
// the emails. A second call does nothing.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  if (!(await runnerTokenOk(req.headers.get('authorization'))))
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { runId?: unknown; cardVersionId?: unknown } | null;
  if (body?.cardVersionId !== undefined) {
    const id = typeof body.cardVersionId === 'string' ? body.cardVersionId : '';
    if (!UUID.test(id)) return Response.json({ error: 'Give cardVersionId, a UUID.' }, { status: 400 });
    const email = await cardDraftReady(id);
    if (!email) return Response.json({ error: 'No such card version.' }, { status: 404 });
    return Response.json({ email }, { status: email === 'failed' ? 502 : 200 });
  }
  const runId = typeof body?.runId === 'string' ? body.runId : '';
  if (!UUID.test(runId)) return Response.json({ error: 'Give runId, a UUID.' }, { status: 400 });
  const result = await runEnded(runId);
  if (!result) return Response.json({ error: 'No such run.' }, { status: 404 });
  return Response.json(result);
}
