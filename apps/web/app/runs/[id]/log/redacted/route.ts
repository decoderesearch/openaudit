import { parseId, toUrlId } from '@/lib/ids';
import { forbidden, logGate, logResponse } from '@/lib/server/log-download';
import { r2Get } from '@/lib/server/r2';
import { getRun } from '@/lib/server/runs';

// The run's Inspect log without the attempts that the public cannot read
// (`openaudit_runner/redact.py`). Open it with `inspect view`.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const stop = await logGate(request);
  if (stop) return stop;
  const uuid = parseId((await params).id);
  const found = uuid ? await getRun(uuid) : null;
  const copy = found?.redacted;
  if (!found || !copy) return new Response('Not found', { status: 404 });
  if (!copy.ready) return new Response('We are making the redacted log. Try again later.', { status: 409 });
  if (!found.access.canRead(copy.rule)) return forbidden("The dataset's terms do not let you download this log.");
  const file = await r2Get(copy.key);
  if (!file.ok) return new Response(null, { status: 502 });
  const name = `${found.eval.slug}-${toUrlId(found.run.id)}${copy.omit.length ? '-redacted' : ''}.eval`;
  return logResponse(file.body, name, file.headers.get('content-length'));
}
