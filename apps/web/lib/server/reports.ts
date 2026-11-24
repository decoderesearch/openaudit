import { prisma } from '@/lib/db';
import { inboxKey } from '@/lib/email/address';
import { sendEmail } from '@/lib/email/send';
import { escapeHtml, submissionConfirmEmail, type EmailContent } from '@/lib/email/templates';
import { NEXT_PUBLIC_URL, SITE_NAME, SUPPORT_EMAIL } from '@/lib/env';
import { REPLY_TIME, reportLabel, shownFields, submissionRef, type Report } from '@/lib/report';
import { deliver } from '@/lib/server/run-emails';

// Submissions from the navbar's Submit form get a `Submission` row and go to the support inbox. Both
// have only what the sender wrote and the page path: no IP address, account or browser data.

/** The confirmation emails that one inbox can get in a day. */
export const CONFIRMS_PER_DAY = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Saves the submission. Its number is the reference in the emails. */
export async function saveReport(r: Report): Promise<number> {
  const row = await prisma.submission.create({
    data: { type: r.type, body: r.body, email: r.email || null, page: r.page || null, fields: r.fields },
    select: { number: true },
  });
  return row.number;
}

export function reportEmail(r: Report, number: number): EmailContent {
  const label = reportLabel(r.type);
  const ref = submissionRef(number);
  const page = r.page ? `${NEXT_PUBLIC_URL}${r.page}` : '';
  const fields: [string, string][] = [
    ['Type', label],
    ['Page', page || '(none)'],
    ['From', r.email || 'Anonymous'],
    ...shownFields(r.type, r.fields).map((f): [string, string] => [f.label, f.value]),
    ['Submission', r.body],
    ['Admin', `${NEXT_PUBLIC_URL}/admin/submissions#${ref}`],
  ];
  const cell = 'color:#334155;font-size:14px;line-height:22px;margin:0 0 12px;white-space:pre-wrap';
  return {
    subject: `[${SITE_NAME} ${ref}] ${label}${r.fields.name || r.fields.variant ? `: ${r.fields.name || r.fields.variant}` : ''}`,
    text: fields.map(([k, v]) => `${k}:\n${v}`).join('\n\n') + '\n',
    html: `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Inter,Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:32px auto;padding:24px;background:#ffffff;border-radius:8px">
<h2 style="color:#0f172a;font-size:18px;margin:0 0 16px">${escapeHtml(label)} submission ${ref}</h2>
${fields
  .map(
    ([k, v]) =>
      `<p style="color:#64748b;font-size:12px;font-weight:600;margin:0 0 2px">${k}</p><p style="${cell}">${escapeHtml(v)}</p>`,
  )
  .join('\n')}
</div></body></html>`,
  };
}

/** Sends the submission to the support inbox. A sender who gave an email address gets the replies.
 * `EmailLog` keeps the type and subject only. */
export async function sendReport(r: Report, number: number): Promise<boolean> {
  const content = reportEmail(r, number);
  const log = await prisma.emailLog.create({
    data: { to: SUPPORT_EMAIL, toKey: inboxKey(SUPPORT_EMAIL), type: 'report', subject: content.subject },
  });
  const replyTo = r.email || SUPPORT_EMAIL;
  const { providerMessageId, error } = await deliver([SUPPORT_EMAIL], 'report', content, replyTo);
  await prisma.emailLog.update({ where: { id: log.id }, data: { providerMessageId, error } });
  if (error) console.error(`[report] email failed: ${error}`);
  return !error;
}

/** Sends the sender a receipt, when they gave an address and it got fewer than
 * `CONFIRMS_PER_DAY` today. True when it went. A failure does not stop the submission. */
export async function sendReportConfirm(r: Report): Promise<boolean> {
  if (!r.email) return false;
  try {
    const sent = await prisma.emailLog.count({
      where: { type: 'report_confirm', toKey: inboxKey(r.email), sentAt: { gt: new Date(Date.now() - DAY_MS) } },
    });
    if (sent >= CONFIRMS_PER_DAY) return false;
    await sendEmail(r.email, 'report_confirm', submissionConfirmEmail(reportLabel(r.type), REPLY_TIME));
    return true;
  } catch (e) {
    console.error('[report] confirmation email failed', e);
    return false;
  }
}
