import { BETTER_AUTH_SECRET, RESEND_API_KEY } from '@/lib/env';
import { UPDATE_LISTS, type UpdateList } from '@/lib/updates';
import { Resend } from 'resend';

// Subscribers of the email update lists live in Resend: a contact, a Topic for each list, and
// one Segment for each mix of lists. A daily Broadcast goes to each Segment, so each person gets
// at most one email a day. `scripts/updates-setup.ts` makes the Topics and Segments.

export const UPDATES_FROM = process.env.UPDATES_FROM_ADDRESS || 'OpenAudit <updates@mail.openaudit.com>';

/** The Segment for each mix of lists. Resend's plan allows 3 Segments. */
export const MIXES: { lists: UpdateList[]; segment: string }[] = [
  { lists: ['incidents'], segment: 'Updates: Safety Incidents' },
  { lists: ['evals'], segment: 'Updates: New Eval Results' },
  { lists: ['incidents', 'evals'], segment: 'Updates: Both' },
];

const mixKey = (lists: readonly UpdateList[]) => [...lists].sort().join('+');

/** The Segment name for exactly these lists, or null for none. */
export function segmentFor(lists: readonly UpdateList[]): string | null {
  return MIXES.find((m) => mixKey(m.lists) === mixKey(lists))?.segment ?? null;
}

/** The events that app/api/resend/webhook gets: a change of a contact's Topics, or unsubscribe. */
export const WEBHOOK_EVENTS = ['contact.topics.updated', 'contact.updated'] as const;
export const WEBHOOK_PATH = '/api/resend/webhook';

/** Why updates do not work here, or null. */
export function updatesOff(): string | null {
  return RESEND_API_KEY ? null : 'Email updates need RESEND_API_KEY.';
}

export function resend(): Resend {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set.');
  return new Resend(RESEND_API_KEY);
}

type Result<T> = { data: T | null; error: { message: string; name?: string } | null };

/** The data, or an error with `what` in the message. */
export async function need<T>(call: Promise<Result<T>>, what: string): Promise<T> {
  const { data, error } = await call;
  if (error || !data) throw new Error(`Resend ${what}: ${error?.message ?? 'no data'}`);
  return data;
}

type Ids = { topics: Record<UpdateList, string>; segments: Record<string, string> };
let ids: Ids | null = null;

/** The Resend ids of our Topics and Segments, found by name once per isolate. Keeps only found ids:
 * a Worker request must not wait on another request's I/O. */
export async function resendIds(): Promise<Ids> {
  if (ids) return ids;
  ids = await (async () => {
    const r = resend();
    const [topics, segments] = await Promise.all([
      need(r.topics.list(), 'list topics'),
      need(r.segments.list({ limit: 100 }), 'list segments'),
    ]);
    const topic = (name: string) => topics.data.find((t) => t.name === name)?.id;
    const segment = (name: string) => segments.data.find((s) => s.name === name)?.id;
    const missing = [
      ...UPDATE_LISTS.filter((l) => !topic(l.label)).map((l) => `Topic "${l.label}"`),
      ...MIXES.filter((m) => !segment(m.segment)).map((m) => `Segment "${m.segment}"`),
    ];
    if (missing.length) throw new Error(`Resend has no ${missing.join(', ')}. Run scripts/updates-setup.ts.`);
    return {
      topics: Object.fromEntries(UPDATE_LISTS.map((l) => [l.id, topic(l.label)!])) as Record<UpdateList, string>,
      segments: Object.fromEntries(MIXES.map((m) => [m.segment, segment(m.segment)!])),
    };
  })();
  return ids;
}

/** The contacts in each Segment, for the admin page. At most 100 each; `more` says there are more. */
export async function segmentSizes(): Promise<{ segment: string; contacts: number; more: boolean }[]> {
  const { segments } = await resendIds();
  return Promise.all(
    MIXES.map(async (m) => {
      const r = await need(resend().contacts.list({ segmentId: segments[m.segment], limit: 100 }), 'list contacts');
      return { segment: m.segment, contacts: r.data.filter((c) => !c.unsubscribed).length, more: r.has_more };
    }),
  );
}

export type Subscription = { lists: UpdateList[]; contactId: string | null };

/** The contact id of `email`, or null when it has no contact. */
export async function contactIdOf(email: string): Promise<string | null> {
  return (await findContact(email))?.id ?? null;
}

async function findContact(email: string) {
  const { data, error } = await resend().contacts.get({ email } as never);
  if (error?.name === 'not_found') return null;
  if (error || !data) throw new Error(`Resend get contact: ${error?.message ?? 'no data'}`);
  return data;
}

async function optedIn(contactId: string, topics: Record<UpdateList, string>): Promise<UpdateList[]> {
  const { data } = await need(resend().contacts.topics.list({ id: contactId, limit: 100 }), 'list contact topics');
  const on = new Set(data.filter((t) => t.subscription === 'opt_in').map((t) => t.id));
  return UPDATE_LISTS.filter((l) => on.has(topics[l.id])).map((l) => l.id);
}

/** The lists that `email` gets. None when it has no contact or unsubscribed from all. */
export async function getSubscription(email: string): Promise<Subscription> {
  const [contact, { topics }] = await Promise.all([findContact(email), resendIds()]);
  if (!contact) return { lists: [], contactId: null };
  return { lists: contact.unsubscribed ? [] : await optedIn(contact.id, topics), contactId: contact.id };
}

/** Puts the contact in the one Segment for its lists, and takes it out of the others. */
export async function syncSegments(contactId: string, lists?: UpdateList[]): Promise<void> {
  const r = resend();
  const { topics, segments } = await resendIds();
  const want = segmentFor(lists ?? (await optedIn(contactId, topics)));
  const ours = new Set(Object.values(segments));
  const { data } = await need(r.contacts.segments.list({ contactId, limit: 100 }), 'list contact segments');
  const have = data.filter((s) => ours.has(s.id)).map((s) => s.id);
  const target = want ? segments[want] : null;
  for (const id of have)
    if (id !== target) await need(r.contacts.segments.remove({ contactId, segmentId: id }), 'remove from segment');
  if (target && !have.includes(target))
    await need(r.contacts.segments.add({ contactId, segmentId: target }), 'add to segment');
}

/** Sets the lists of `email`. With lists, also ends an "unsubscribe from all". */
export async function setSubscription(email: string, lists: UpdateList[]): Promise<void> {
  const r = resend();
  const { topics } = await resendIds();
  const subscriptions = UPDATE_LISTS.map((l) => ({
    id: topics[l.id],
    subscription: lists.includes(l.id) ? ('opt_in' as const) : ('opt_out' as const),
  }));
  const contact = await findContact(email);
  if (!contact && !lists.length) return;
  let id: string;
  if (!contact) {
    id = (await need(r.contacts.create({ email, unsubscribed: false, topics: subscriptions }), 'create contact')).id;
  } else {
    id = contact.id;
    if (lists.length && contact.unsubscribed)
      await need(r.contacts.update({ id, unsubscribed: false }), 'update contact');
    await need(r.contacts.topics.update({ id, topics: subscriptions }), 'update contact topics');
  }
  await syncSegments(id, lists);
}

// ---------------------------------------------------------------------------------------------
// Confirm links: a signed token with the address, the lists and an expiry. No database row.
// ---------------------------------------------------------------------------------------------

const TOKEN_DAYS = 7;

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

function fromB64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmac(body: string, purpose = 'updates'): Promise<Uint8Array> {
  if (!BETTER_AUTH_SECRET) throw new Error('BETTER_AUTH_SECRET is not set.');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(BETTER_AUTH_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${purpose}:${body}`)));
}

/** True when `sig` is the HMAC of `body` for `purpose`, in constant time. */
async function signed(body: string, sig: string, purpose?: string): Promise<boolean> {
  const want = await hmac(body, purpose);
  const got = fromB64url(sig);
  let diff = want.length ^ got.length;
  for (let i = 0; i < want.length; i++) diff |= want[i] ^ (got[i] ?? 0);
  return !diff;
}

export type ConfirmRequest = { email: string; lists: UpdateList[] };

export async function confirmToken(req: ConfirmRequest, now = Date.now()): Promise<string> {
  const body = b64url(
    new TextEncoder().encode(JSON.stringify({ e: req.email, l: req.lists, x: now + TOKEN_DAYS * 864e5 })),
  );
  return `${body}.${b64url(await hmac(body))}`;
}

/** The request in a token, or null when the token is bad or expired. */
export async function readConfirmToken(token: string, now = Date.now()): Promise<ConfirmRequest | null> {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  try {
    if (!(await signed(body, sig))) return null;
    const { e, l, x } = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    if (typeof e !== 'string' || !Array.isArray(l) || typeof x !== 'number' || x < now) return null;
    return { email: e, lists: l.filter((id): id is UpdateList => UPDATE_LISTS.some((u) => u.id === id)) };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Unsubscribe links: a signed token with the address and no expiry. Each update email has one,
// the confirm email too. An unsubscribed address gets no more update emails.
// ---------------------------------------------------------------------------------------------

const UNSUBSCRIBE = 'unsubscribe';

export async function unsubscribeToken(email: string): Promise<string> {
  const body = b64url(new TextEncoder().encode(email));
  return `${body}.${b64url(await hmac(body, UNSUBSCRIBE))}`;
}

/** The address in a token, or null when the token is bad. */
export async function readUnsubscribeToken(token: string): Promise<string | null> {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  try {
    return (await signed(body, sig, UNSUBSCRIBE)) ? new TextDecoder().decode(fromB64url(body)) : null;
  } catch {
    return null;
  }
}

/** Stops all update emails to `email`: its contact is unsubscribed and in no list. An address with
 * no contact gets one, unsubscribed, so that a later Subscribe form sends it nothing. */
export async function blockUpdates(email: string): Promise<void> {
  const r = resend();
  const contact = await findContact(email);
  if (!contact) {
    await need(r.contacts.create({ email, unsubscribed: true }), 'create contact');
    return;
  }
  const { topics } = await resendIds();
  if (!contact.unsubscribed) await need(r.contacts.update({ id: contact.id, unsubscribed: true }), 'update contact');
  await need(
    r.contacts.topics.update({
      id: contact.id,
      topics: UPDATE_LISTS.map((l) => ({ id: topics[l.id], subscription: 'opt_out' as const })),
    }),
    'update contact topics',
  );
  await syncSegments(contact.id, []);
}

/** True when `email` unsubscribed from all update emails. */
export async function updatesBlocked(email: string): Promise<boolean> {
  return (await findContact(email))?.unsubscribed === true;
}
