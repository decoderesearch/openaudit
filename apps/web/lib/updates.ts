// The email update lists. Each is a Topic in Resend with this label. People pick lists in the
// navbar's Subscribe dialog, or in Settings when signed in.

export const UPDATE_LISTS = [
  {
    id: 'incidents',
    label: 'Safety Incidents',
    description: 'New incidents, updates to incidents, and notable departures at AI developers.',
  },
  {
    id: 'evals',
    label: 'New Eval Results',
    description: 'New eval runs on OpenAudit, new OpenAudit Card versions, and new system cards.',
  },
] as const;

export type UpdateList = (typeof UPDATE_LISTS)[number]['id'];

export const SUBSCRIBE_TURNSTILE_ACTION = 'subscribe';

/** The page that an email's unsubscribe link opens, and the POST for a mail app's unsubscribe
 * button. Both take `t`, a signed token. The site gate lets both through. */
export const UNSUBSCRIBE_PATH = '/updates/unsubscribe';
export const UNSUBSCRIBE_API = '/api/updates/unsubscribe';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A trimmed, lower-case address, or null when it is not one. */
export function parseEmail(value: unknown): string | null {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

/** The known lists in `value`, once each, in the order of `UPDATE_LISTS`. */
export function parseLists(value: unknown): UpdateList[] {
  const given = new Set(Array.isArray(value) ? value : []);
  return UPDATE_LISTS.filter((l) => given.has(l.id)).map((l) => l.id);
}
