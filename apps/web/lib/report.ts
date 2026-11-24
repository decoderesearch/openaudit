// The Submit form in the navbar: submission types, limits and the input check. The client and
// /api/report use the same rules.

import { parseEmail } from '@/lib/updates';

/** `needsEmail`: we reply by email, so the sender must give an address. `about`: what the type is. */
export const REPORT_TYPES = [
  {
    id: 'incident',
    label: 'Incident',
    needsEmail: false,
    about:
      "An organization's AI system did something harmful or unsafe in real use. Include logs too, if relevant, but first remove passwords, keys and personal data.",
    placeholder: 'Describe the incident, or paste the JSON from your agent.',
  },
  {
    id: 'evaluation',
    label: 'Evaluation',
    needsEmail: true,
    about: 'A test that we can run on models or on safety methods.',
    placeholder:
      'Describe your evaluation: what it measures, how it scores, and the models or methods that you ran it on.',
  },
  {
    id: 'method',
    label: 'Method',
    needsEmail: true,
    about: 'A new safety method, or a new variant of a method on our site.',
    placeholder:
      'Describe your method or variant: what is new, and the evaluations that you ran it on, with your scores.',
  },
  {
    id: 'other',
    label: 'Other',
    needsEmail: false,
    about: 'A commitment, a correction, feedback, a question or anything else.',
    placeholder: 'Your message.',
  },
] as const;

export type ReportType = (typeof REPORT_TYPES)[number]['id'];

type Option = { id: string; label: string };
/** An extra field of a type. `showIf`: show it only when another field has one of these values. */
export type SubmissionField = {
  id: string;
  label: string;
  kind: 'text' | 'url' | 'select' | 'check' | 'textarea';
  placeholder?: string;
  /** The field spans the form's two columns. */
  wide?: boolean;
  options?: readonly Option[];
  showIf?: { field: string; values: readonly string[] };
};

/** The extra fields of each type. All are optional: the text box is the submission. */
export const SUBMISSION_FIELDS: Record<ReportType, readonly SubmissionField[]> = {
  incident: [],
  evaluation: [
    { id: 'name', label: 'Name', kind: 'text', placeholder: 'The name of the evaluation' },
    {
      id: 'tests',
      label: 'What It Evaluates',
      kind: 'select',
      options: [
        { id: 'models', label: 'Models' },
        { id: 'methods', label: 'Safety methods' },
        { id: 'both', label: 'Both' },
      ],
    },
    {
      id: 'access',
      label: 'Access',
      kind: 'select',
      options: [
        { id: 'public', label: 'All public' },
        { id: 'partly', label: 'Partly private (a held-out set)' },
        { id: 'private', label: 'Private' },
      ],
    },
    { id: 'link', label: 'Link', kind: 'url', placeholder: 'https:// (paper, code or data)' },
    {
      id: 'runPrivately',
      label: 'You can run it on your side and keep the private parts private',
      kind: 'check',
      showIf: { field: 'access', values: ['partly', 'private'] },
    },
  ],
  method: [
    { id: 'method', label: 'Method', kind: 'text', placeholder: 'E.g., Workspace Lenses' },
    { id: 'variant', label: 'Variant', kind: 'text', placeholder: 'E.g., Jacobian Lens' },
    { id: 'link', label: 'Link', kind: 'url', placeholder: 'https:// (pull request, code or weights)', wide: true },
    {
      id: 'recipe',
      label: 'Recipe (optional but recommended)',
      kind: 'textarea',
      placeholder:
        'How you made it: the data and its size, how you chose the settings, and if you used items of our evaluations for the fit or the choice.',
    },
  ],
  other: [{ id: 'link', label: 'Link', kind: 'url', placeholder: 'https:// (the page that it is about)', wide: true }],
};

export const FIELD_LIMITS = { text: 200, url: 500, textarea: 8_000 } as const;

export const REPORT_LIMITS = { body: 32_768, email: 254, page: 300 } as const;

export const REPORT_TURNSTILE_ACTION = 'report';

/** The time that the confirmation email gives for a reply. */
export const REPLY_TIME = '2–5 business days';

export type Report = {
  type: ReportType;
  body: string;
  /** A lower-case address. Empty: anonymous. */
  email: string;
  /** The path of the page the submission came from. */
  page: string;
  /** The type's extra fields that the sender filled in. A check box is "yes". */
  fields: Record<string, string>;
};

/** The review states of a submission, in order. `received` is new: admins have not read it. */
export const SUBMISSION_STATUSES = [
  { id: 'received', label: 'Received' },
  { id: 'reviewing', label: 'Reviewing' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'declined', label: 'Declined' },
] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number]['id'];

export const isSubmissionStatus = (v: unknown): v is SubmissionStatus => SUBMISSION_STATUSES.some((s) => s.id === v);

/** The reference in the emails and the admin page. */
export const submissionRef = (n: number) => `SUB-${n}`;

/** The fields of `type` that `fields` shows, in order, with their display values. */
export function shownFields(type: ReportType, fields: Record<string, string>): { label: string; value: string }[] {
  return SUBMISSION_FIELDS[type].flatMap((f) => {
    const v = fields[f.id];
    if (!v) return [];
    return [{ label: f.label, value: f.options?.find((o) => o.id === v)?.label ?? (f.kind === 'check' ? 'Yes' : v) }];
  });
}

export function reportType(type: ReportType) {
  return REPORT_TYPES.find((t) => t.id === type)!;
}

export function reportLabel(type: ReportType): string {
  return reportType(type).label;
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** The submission from a request body, or why it is not valid. */
export function parseReport(input: unknown): { ok: true; report: Report } | { ok: false; error: string } {
  const o = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const type = REPORT_TYPES.find((t) => t.id === o.type)?.id;
  if (!type) return { ok: false, error: 'Select a submission type.' };
  const body = text(o.body);
  if (!body) return { ok: false, error: 'Write your submission first.' };
  if (body.length > REPORT_LIMITS.body) {
    return { ok: false, error: `The text has more than ${REPORT_LIMITS.body} characters.` };
  }
  const given = text(o.email);
  const email = given ? parseEmail(given) : '';
  if (email === null) return { ok: false, error: 'Give a valid email address, or leave it empty.' };
  if (!email && reportType(type).needsEmail) {
    return { ok: false, error: 'Give your email address, so that we can reply.' };
  }
  const fields = parseFields(type, o.fields);
  if (typeof fields === 'string') return { ok: false, error: fields };
  const page = text(o.page);
  return {
    ok: true,
    report: { type, body, email, page: page.startsWith('/') ? page.slice(0, REPORT_LIMITS.page) : '', fields },
  };
}

/** The known fields of `type`, or why one is not valid. Unknown keys and empty values are dropped. */
function parseFields(type: ReportType, input: unknown): Record<string, string> | string {
  const o = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const f of SUBMISSION_FIELDS[type]) {
    const raw = o[f.id];
    if (f.kind === 'check') {
      if (raw === true || raw === 'yes') out[f.id] = 'yes';
      continue;
    }
    const v = text(raw);
    if (!v) continue;
    if (f.kind === 'select') {
      if (!f.options?.some((x) => x.id === v)) return `Select a value for "${f.label}".`;
    } else if (v.length > FIELD_LIMITS[f.kind]) {
      return `"${f.label}" has more than ${FIELD_LIMITS[f.kind]} characters.`;
    } else if (f.kind === 'url' && !/^https?:\/\/\S+$/.test(v)) {
      return `"${f.label}" must be a link that starts with https://.`;
    }
    out[f.id] = v;
  }
  for (const f of SUBMISSION_FIELDS[type]) {
    if (f.showIf && !f.showIf.values.includes(out[f.showIf.field] ?? '')) delete out[f.id];
  }
  return out;
}

// Links to the form: `?submit=<type>` on any page opens the navbar form, and `/submit` is the form
// on its own page.

/** The page with the form, for links. The navbar form does not read `?submit=` there. */
export const SUBMIT_PAGE = '/submit';

/** A form type and its field values, from a link. */
export type Preset = { type: ReportType; fields: Record<string, string> };

/** The form preset of a `?submit=` link, or null. */
export function presetFromQuery(search: string): Preset | null {
  const q = new URLSearchParams(search);
  const type = REPORT_TYPES.find((t) => t.id === q.get('submit'))?.id;
  if (!type) return null;
  return { type, fields: presetFields(type, q) };
}

/** The type's text fields from the query values of a link. */
function presetFields(type: ReportType, q: URLSearchParams): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const f of SUBMISSION_FIELDS[type]) {
    const v = q.get(f.id);
    if (v && f.kind !== 'check') fields[f.id] = v.slice(0, FIELD_LIMITS.text);
  }
  return fields;
}

/** The type in a `/submit` link: `#<type>` or `#type=<type>&...`, else `?type=` or `?submit=`. */
function typeOfUrl(hash: string, search: string): ReportType | undefined {
  const q = new URLSearchParams(search);
  const h = hash.replace(/^#/, '');
  const fromHash = h.includes('=') ? new URLSearchParams(h).get('type') : decodeURIComponent(h);
  const id = fromHash || q.get('type') || q.get('submit');
  return REPORT_TYPES.find((t) => t.id === id)?.id;
}

/** The start text of a `/submit` link: `#...&body=<text>`. The browser does not send the hash, so the
 * text does not go to the server or its logs. */
export function bodyOfHash(hash: string): string {
  const h = hash.replace(/^#/, '');
  if (!h.includes('=')) return '';
  return (new URLSearchParams(h).get('body') ?? '').slice(0, REPORT_LIMITS.body);
}

/** The start values of a `/submit` link: the type, and the type's text fields from the other query
 * values (`/submit?type=method&method=Workspace Lenses`). */
export function submitPreset(hash: string, search: string): Preset | null {
  const type = typeOfUrl(hash, search);
  return type ? { type, fields: presetFields(type, new URLSearchParams(search)) } : null;
}
