import { clientIp } from '@/lib/rate-limit';
import { parseReport, REPORT_TURNSTILE_ACTION, submissionRef } from '@/lib/report';
import { allow, tooMany } from '@/lib/server/limits';
import { reportLimitError } from '@/lib/server/report-limits';
import { saveReport, sendReport, sendReportConfirm } from '@/lib/server/reports';
import { verifyTurnstile } from '@/lib/server/turnstile';

// The navbar's Submit form: 1 a minute per IP (Cloudflare), a Turnstile check and a total hourly
// limit. Then a `Submission` row, one email to the support inbox, and a receipt to the sender if
// they gave an address.

export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  if (!(await allow('once', 'report', ip))) return tooMany();
  let input: { turnstileToken?: unknown } & Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return problem(400, 'Malformed request.');
  }
  const parsed = parseReport(input);
  if (!parsed.ok) return problem(400, parsed.error);
  const token = typeof input.turnstileToken === 'string' ? input.turnstileToken : null;
  if (!(await verifyTurnstile(token, REPORT_TURNSTILE_ACTION, ip))) {
    return problem(403, 'The browser check failed. Try again.');
  }
  const limited = await reportLimitError();
  if (limited) return problem(429, limited);
  let number: number;
  try {
    number = await saveReport(parsed.report);
  } catch (e) {
    console.error('[report] save failed', e);
    return problem(502, 'We could not save your submission. Try again later.');
  }
  if (!(await sendReport(parsed.report, number)))
    console.error(`[report] ${submissionRef(number)} saved, email failed`);
  const confirmed = await sendReportConfirm(parsed.report);
  return Response.json({ ok: true, confirmed }, { headers: { 'cache-control': 'no-store' } });
}

function problem(status: number, error: string) {
  return Response.json({ error }, { status, headers: { 'cache-control': 'no-store' } });
}
