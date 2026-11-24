import { parseId, toUrlId } from '@/lib/ids';
import { forbidden, logGate, logResponse } from '@/lib/server/log-download';
import { r2Get } from '@/lib/server/r2';
import { getRun } from '@/lib/server/runs';

// The run's full Inspect log from R2, for staff only: it has all replies. Others download the
// copy without the hidden attempts (`./redacted`). Open it with `inspect view`.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const stop = await logGate(request);
  if (stop) return stop;
  const uuid = parseId((await params).id);
  const found = uuid ? await getRun(uuid) : null;
  if (!found?.logKey) return new Response('Not found', { status: 404 });
  if (!found.access.staff) return forbidden('Only staff can download the full log. Download the redacted log.');
  if (!found.access.canRead(found.logRule)) return forbidden("The dataset's terms do not let you download this log.");
  const file = await r2Get(found.logKey);
  if (!file.ok) return new Response(null, { status: 502 });
  return logResponse(file.body, `${found.eval.slug}-${toUrlId(found.run.id)}.eval`, file.headers.get('content-length'));
}
