import { Prisma } from '#prisma';
import { prisma } from '@/lib/db';
import { inboxKey } from '@/lib/email/address';
import { escapeHtml, type EmailContent } from '@/lib/email/templates';
import { EMAIL_FROM_ADDRESS, NEXT_PUBLIC_URL, REPLY_TO_ADDRESS, RESEND_API_KEY, SITE_NAME } from '@/lib/env';
import { runPath } from '@/lib/server/runs';
import { Resend } from 'resend';

// Emails to the owner of a run: queued, and at the end. `EmailLog` keeps one row for each run
// and type, so each email goes once. Runs with no owner get no email.

export const RUN_EMAIL_TYPES = ['run_queued', 'run_cancelled', 'run_succeeded', 'run_failed'] as const;
export type RunEmailType = (typeof RUN_EMAIL_TYPES)[number];

/** Run emails to one inbox per day, at most. More are not sent. */
export const RUN_EMAILS_PER_DAY = 30;

const DAY = 24 * 60 * 60 * 1000;

/** The email for a run's status, or null when the run is not done. */
export function emailTypeFor(status: string): RunEmailType | null {
  if (status === 'succeeded') return 'run_succeeded';
  if (status === 'failed') return 'run_failed';
  if (status === 'cancelled') return 'run_cancelled';
  return null;
}

const HEADING: Record<RunEmailType, string> = {
  run_queued: 'Your run is queued',
  run_cancelled: 'Your run was cancelled',
  run_succeeded: 'Your run is done',
  run_failed: 'Your run failed',
};

export type RunEmailInput = {
  type: RunEmailType;
  evalName: string;
  modelName: string;
  status: string;
  costUsd?: number | null;
  error?: string | null;
  url: string;
};

export function runEmail(input: RunEmailInput): EmailContent {
  const { type, evalName, modelName, status, costUsd, error, url } = input;
  const heading = HEADING[type];
  const lines = [
    `Eval: ${evalName}`,
    `Model: ${modelName}`,
    `Status: ${status}`,
    ...(type !== 'run_queued' && typeof costUsd === 'number' ? [`Cost: $${costUsd.toFixed(4)}`] : []),
    ...(error && type !== 'run_queued' ? [`Error: ${error}`] : []),
  ];
  const p = 'color:#334155;font-size:14px;line-height:22px;margin:0 0 8px';
  const button =
    'display:inline-block;background:#0369a1;color:#ffffff;font-size:14px;font-weight:600;padding:10px 16px;border-radius:6px;text-decoration:none';
  return {
    subject: `${heading}: ${evalName} on ${modelName}`,
    text: `${lines.join('\n')}\n\nOpen the run:\n${url}\n`,
    html: `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Inter,Helvetica,Arial,sans-serif">
<div style="max-width:520px;margin:32px auto;padding:24px;background:#ffffff;border-radius:8px">
<a href="${NEXT_PUBLIC_URL}" style="color:#0369a1;font-weight:600;font-size:16px;text-decoration:none">${SITE_NAME}</a>
<hr style="border:0;border-top:1px solid #e2e8f0;margin:16px 0">
<h2 style="color:#0f172a;font-size:18px;margin:0 0 12px">${escapeHtml(heading)}</h2>
${lines.map((l) => `<p style="${p}">${escapeHtml(l)}</p>`).join('\n')}
<p style="margin:16px 0 0"><a href="${escapeHtml(url)}" style="${button}">Open the run</a></p>
</div></body></html>`,
  };
}

export type RunEmailResult = 'sent' | 'failed' | 'no_run' | 'no_owner' | 'already_sent' | 'capped';

/** Sends one run email to the run's owner, once. Never throws: the action that calls it must go on. */
export async function sendRunEmail(runId: string, type: RunEmailType, now = new Date()): Promise<RunEmailResult> {
  try {
    const run = await prisma.evalRun.findUnique({
      where: { id: runId },
      select: {
        status: true,
        provenance: true,
        error: true,
        owner: { select: { email: true } },
        eval: { select: { displayName: true } },
        model: { select: { name: true } },
      },
    });
    if (!run) return 'no_run';
    if (!run.owner) return 'no_owner';
    const to = run.owner.email;
    const toKey = inboxKey(to);
    const sentToday = await prisma.emailLog.count({
      where: { toKey, type: { in: [...RUN_EMAIL_TYPES] }, sentAt: { gte: new Date(now.getTime() - DAY) } },
    });
    if (sentToday >= RUN_EMAILS_PER_DAY) {
      console.error(`[email] ${type} for run ${runId} not sent: inbox at ${RUN_EMAILS_PER_DAY} run emails today`);
      return 'capped';
    }
    const content = runEmail({
      type,
      evalName: run.eval.displayName,
      modelName: run.model.name,
      status: run.status,
      costUsd: (run.provenance as { costUsd?: number } | null)?.costUsd,
      error: run.error,
      url: `${NEXT_PUBLIC_URL}${runPath({ id: runId })}`,
    });
    return await sendOnce(runId, type, to, content);
  } catch (e) {
    console.error(`[email] ${type} for run ${runId} failed`, e);
    return 'failed';
  }
}

/** Sends an email about a run once for each (run, type). The request alert also uses it. */
export async function sendOnce(
  runId: string,
  type: RunEmailType | 'run_request_alert',
  to: string | string[],
  content: EmailContent,
): Promise<'sent' | 'failed' | 'already_sent'> {
  const list = typeof to === 'string' ? [to] : to;
  // The row comes first: its unique (runId, type) stops a second send.
  let logId: string;
  try {
    logId = (
      await prisma.emailLog.create({
        data: { to: list.join(', '), toKey: inboxKey(list[0]), type, subject: content.subject, runId },
      })
    ).id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return 'already_sent';
    throw e;
  }
  const { providerMessageId, error } = await deliver(list, type, content);
  await prisma.emailLog.update({ where: { id: logId }, data: { providerMessageId, error } });
  if (error) console.error(`[email] ${type} for run ${runId} failed: ${error}`);
  return error ? 'failed' : 'sent';
}

// Without a Resend key the text prints to the server console.
export async function deliver(to: string[], type: string, content: EmailContent, replyTo: string = REPLY_TO_ADDRESS) {
  if (!RESEND_API_KEY) {
    console.log(`\n[email:${type}] to=${to.join(', ')} subject=${content.subject}\n${content.text}\n`);
    return { providerMessageId: null, error: null };
  }
  const result = await new Resend(RESEND_API_KEY).emails.send({
    from: EMAIL_FROM_ADDRESS,
    to,
    replyTo,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });
  return { providerMessageId: result.data?.id ?? null, error: result.error?.message ?? null };
}
