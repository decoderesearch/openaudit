import { parseId, toUrlId } from '@/lib/ids';
import { attemptLog } from '@/lib/server/attempt-log';
import { forbidden, logGate, logResponse } from '@/lib/server/log-download';
import { getRun, getShownAttempt } from '@/lib/server/runs';

// One attempt's Inspect log, made from the run's log. Staff get it from the full log. Others get it
// only from the redacted copy, so a reply that the copy leaves out cannot get into it.
export async function GET(request: Request, { params }: { params: Promise<{ id: string; n: string }> }) {
  const stop = await logGate(request);
  if (stop) return stop;
  const { id, n } = await params;
  const uuid = parseId(id);
  const ordinal = Number(n);
  const found = uuid && Number.isInteger(ordinal) && ordinal >= 1 ? await getRun(uuid) : null;
  const attempt = found && (await getShownAttempt(found.run.id, ordinal, found));
  if (!found || !attempt) return new Response('Not found', { status: 404 });
  const { access, redacted } = found;
  if (attempt.hidden) return forbidden("The dataset's terms do not let you download this log.");
  let key: string | null;
  if (access.staff) key = found.logKey;
  else {
    if (attempt.withheld) return forbidden('You cannot read this reply, so you cannot download its log.');
    if (!redacted?.ready) return new Response('We are making the redacted log. Try again later.', { status: 409 });
    if (redacted.omit.includes(attempt.id)) return forbidden('The redacted log leaves out this attempt.');
    key = redacted.key;
  }
  const log = key ? await attemptLog(key, attempt) : null;
  if (!log) return new Response('Not found', { status: 404 });
  const name = `${found.eval.slug}-${toUrlId(found.run.id)}-${attempt.ordinal}.eval`;
  return logResponse(log as BodyInit, name, log.length);
}
