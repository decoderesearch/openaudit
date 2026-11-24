import { Resend } from 'resend';
import { EMAIL_FROM_ADDRESS, REPLY_TO_ADDRESS, RESEND_API_KEY } from '../env';
import { inboxKey } from './address';
import type { EmailContent } from './templates';

export type EmailType = 'magic_link' | 'admin_alert' | 'updates_confirm' | 'report_confirm';

// Sends one email through Resend and records it in `EmailLog`. Without a Resend key the text
// prints to the server console, which is enough for local development.
export async function sendEmail(to: string, type: EmailType, content: EmailContent): Promise<void> {
  let providerMessageId: string | null = null;
  let error: string | null = null;

  if (!RESEND_API_KEY) {
    console.log(`\n[email:${type}] to=${to} subject=${content.subject}\n${content.text}\n`);
  } else {
    const resend = new Resend(RESEND_API_KEY);
    const result = await resend.emails.send({
      from: EMAIL_FROM_ADDRESS,
      to,
      replyTo: REPLY_TO_ADDRESS,
      subject: content.subject,
      html: content.html,
      text: content.text,
      headers: content.headers,
    });
    providerMessageId = result.data?.id ?? null;
    error = result.error?.message ?? null;
  }

  // Logging must never block the action that sent the email.
  try {
    const { prisma } = await import('../db');
    await prisma.emailLog.create({
      data: { to, toKey: inboxKey(to), type, subject: content.subject, providerMessageId, error },
    });
  } catch (e) {
    console.error('[email] failed to write EmailLog', e);
  }

  if (error) {
    throw new Error(`Failed to send ${type} email: ${error}`);
  }
}
