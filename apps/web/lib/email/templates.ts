import { NEXT_PUBLIC_URL, SITE_NAME, SUPPORT_EMAIL } from '../env';

// Each email is a subject, a plain-text body and a small HTML body in one frame. Values from
// users are escaped.

/** `headers`: extra mail headers, for example `List-Unsubscribe`. */
export type EmailContent = { subject: string; text: string; html: string; headers?: Record<string, string> };

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function frame(heading: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Inter,Helvetica,Arial,sans-serif">
<div style="max-width:520px;margin:32px auto;padding:24px;background:#ffffff;border-radius:8px">
<a href="${NEXT_PUBLIC_URL}" style="color:#0369a1;font-weight:600;font-size:16px;text-decoration:none">${SITE_NAME}</a>
<hr style="border:0;border-top:1px solid #e2e8f0;margin:16px 0">
<h2 style="color:#0f172a;font-size:18px;margin:0 0 12px">${escapeHtml(heading)}</h2>
${bodyHtml}
<hr style="border:0;border-top:1px solid #e2e8f0;margin:20px 0 12px">
<p style="color:#94a3b8;font-size:11px;margin:0">Questions? Write to <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
</div></body></html>`;
}

export const P = 'color:#334155;font-size:14px;line-height:22px;margin:0 0 12px';
const BUTTON =
  'display:inline-block;background:#0369a1;color:#ffffff;font-size:14px;font-weight:600;padding:10px 16px;border-radius:6px;text-decoration:none';

function button(url: string, label: string): string {
  return `<p style="margin:0 0 12px"><a href="${escapeHtml(url)}" style="${BUTTON}">${escapeHtml(label)}</a></p>`;
}

export function magicLinkEmail(url: string): EmailContent {
  return {
    subject: `Sign in to ${SITE_NAME}`,
    text: `Open this link, then press "Sign in". It works once and expires in 5 minutes.\n\n${url}\n\nIf you did not ask for it, ignore this email. Nothing happens unless you press "Sign in".`,
    html: frame(
      `Sign in to ${SITE_NAME}`,
      `<p style="${P}">Open the link, then press "Sign in". It works once and expires in 5 minutes.</p>
${button(url, 'Open sign-in page')}
<p style="${P};font-size:12px;color:#64748b">If you did not ask for it, ignore this email. Nothing happens unless you press "Sign in".</p>`,
    ),
  };
}

/** The link that starts email updates for `lists` (their labels). */
/** `unsubscribe`: the page that stops all update emails to the address. `oneClick`: the same, as a
 * POST for the mail app's unsubscribe button (RFC 8058). */
export function updatesConfirmEmail(
  url: string,
  lists: string[],
  { unsubscribe, oneClick }: { unsubscribe: string; oneClick: string },
): EmailContent {
  const which = lists.join(' and ');
  return {
    subject: `Confirm your ${SITE_NAME} updates`,
    text: `Open this link, then press "Confirm" to get ${which} by email, at most one email per week. The link expires in 7 days.\n\n${url}\n\nIf you did not ask for it, ignore this email. Nothing happens unless you press "Confirm".\n\nTo get no more emails from ${SITE_NAME} updates, unsubscribe: ${unsubscribe}`,
    html: frame(
      `Confirm your ${SITE_NAME} updates`,
      `<p style="${P}">Open the link, then press "Confirm" to get ${escapeHtml(which)} by email, at most one email per week. The link expires in 7 days.</p>
${button(url, 'Open confirm page')}
<p style="${P};font-size:12px;color:#64748b">If you did not ask for it, ignore this email. Nothing happens unless you press "Confirm".</p>
<p style="${P};font-size:12px;color:#64748b">To get no more emails from ${escapeHtml(SITE_NAME)} updates, <a href="${escapeHtml(unsubscribe)}" style="color:#0369a1">unsubscribe</a>.</p>`,
    ),
    headers: { 'List-Unsubscribe': `<${oneClick}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
  };
}

/** The receipt for a submission from the Submit form. It does not repeat what the sender wrote,
 * so the form cannot send other text to an address. `label`: the submission type. */
export function submissionConfirmEmail(label: string, replyTime: string): EmailContent {
  const lines = [
    `Thank you for your ${label.toLowerCase()} submission to ${SITE_NAME}. We will review it and reply to this address in ${replyTime}, depending on our backlog.`,
    'If you did not send it, ignore this email.',
  ];
  return {
    subject: `We got your ${SITE_NAME} submission`,
    text: lines.join('\n\n'),
    html: frame(
      'We got your submission',
      `<p style="${P}">${escapeHtml(lines[0])}</p>
<p style="${P};font-size:12px;color:#64748b">${escapeHtml(lines[1])}</p>`,
    ),
  };
}

export function adminAlertEmail(input: { subject: string; lines: string[] }): EmailContent {
  return {
    subject: `[${SITE_NAME}] ${input.subject}`,
    text: input.lines.join('\n\n'),
    html: frame(input.subject, input.lines.map((l) => `<p style="${P}">${escapeHtml(l)}</p>`).join('\n')),
  };
}
