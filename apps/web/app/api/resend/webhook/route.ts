import { contactIdOf, resend, syncSegments, WEBHOOK_EVENTS } from '@/lib/server/updates';

// Resend calls this when a contact changes. A person can change their Topics on Resend's
// preferences page; then we move the contact to the Segment for its new Topics. Resend signs
// each call (Svix headers) with RESEND_WEBHOOK_SECRET.

const EVENTS = new Set<string>(WEBHOOK_EVENTS);

type Event = { type?: string; data?: { id?: string; email?: string } };

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: 'Webhook is off.' }, { status: 503 });
  const payload = await request.text();
  const h = request.headers;
  let event: Event;
  try {
    event = resend().webhooks.verify({
      payload,
      headers: {
        id: h.get('svix-id') ?? '',
        timestamp: h.get('svix-timestamp') ?? '',
        signature: h.get('svix-signature') ?? '',
      },
      webhookSecret: secret,
    }) as Event;
  } catch {
    return Response.json({ error: 'Bad signature.' }, { status: 401 });
  }
  if (!event.type || !EVENTS.has(event.type)) return Response.json({ ignored: event.type ?? null });
  const { id, email } = event.data ?? {};
  try {
    // contact.topics.updated gives only the email.
    const contactId = id ?? (email ? await contactIdOf(email) : null);
    if (!contactId) return Response.json({ ignored: 'no contact' });
    await syncSegments(contactId);
  } catch (e) {
    console.error(`[updates] webhook ${event.type} sync failed`, e);
    // A 5xx makes Resend send the event again later.
    return Response.json({ error: 'Sync failed.' }, { status: 500 });
  }
  return Response.json({ ok: true });
}
