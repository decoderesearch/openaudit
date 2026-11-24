import type {
  DatePrecision,
  DepartureKind,
  IncidentCategory,
  IncidentPrimaryCategory,
  IncidentSeverity,
  IncidentStatus,
  OrgSource,
} from '@openaudit/spec';

// Labels, dates and links for organization research (incidents and departures). No server code
// here.

/** The path segment after `/<org>` of incident pages. No model repo may have this name. */
export const INCIDENTS_SEGMENT = 'incidents';

/** An organization's incidents page: `/<org>/incidents`. */
export const incidentsPath = (org: { slug: string }) => `/${org.slug}/${INCIDENTS_SEGMENT}`;

/** An incident's page: `/<org>/incidents/<slug>`. */
export const incidentPath = (org: { slug: string }, slug: string) =>
  `${incidentsPath(org)}/${encodeURIComponent(slug)}`;

/** An incident's data as a JSON file: its facts, events and log excerpts. */
export const incidentDownloadPath = (org: { slug: string }, slug: string) => `${incidentPath(org, slug)}/download`;

/** The path segment after `/<org>` of the departures page. No model repo may have this name. */
export const DEPARTURES_SEGMENT = 'departures';

/** An organization's departures page: `/<org>/departures`. */
export const departuresPath = (org: { slug: string }) => `/${org.slug}/${DEPARTURES_SEGMENT}`;

/** The id of a person's card on the departures page: "Jan Leike" is "jan-leike". */
export const departureAnchor = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** A person on an organization's departures page. */
export const departurePath = (org: { slug: string }, name: string) => `${departuresPath(org)}#${departureAnchor(name)}`;

const DEPARTURE_KINDS: [DepartureKind, string][] = [
  ['resigned', 'Resigned'],
  ['fired', 'Fired'],
  ['laid_off', 'Laid Off'],
  ['unclear', 'Unknown'],
];

/** The number of departures of each kind, as "17 Resigned". No 0s. */
export function departureCounts(departures: { kind: DepartureKind }[]): string[] {
  return DEPARTURE_KINDS.flatMap(([k, label]) => {
    const n = departures.filter((d) => d.kind === k).length;
    return n ? [`${n} ${label}`] : [];
  });
}

export const MODELS_SEGMENT = 'models';

/** An organization's models page: `/<org>/models`. */
export const orgModelsPath = (org: { slug: string }) => `/${org.slug}/${MODELS_SEGMENT}`;

/** An incident in the list at the side of an organization's pages. `logs`: its number of log
 * excerpts. `disclosed`: the earliest full date of its sources. */
export type IncidentListItem = {
  slug: string;
  title: string;
  date: string;
  datePrecision: DatePrecision;
  primaryCategory: IncidentPrimaryCategory;
  logs: number;
  disclosed: string | null;
};

/** An incident on the Incidents page and the overview: a list item with its summary. */
export type IncidentCard = IncidentListItem & { summary: string };

/** The story to link to: the newest dated source in the `sources` lists (JSON from the database),
 * else the first source. Undefined with no sources. */
export function storyUrl(...lists: unknown[]): string | undefined {
  const all = lists
    .flatMap((l) => (Array.isArray(l) ? l : []))
    .filter((s): s is OrgSource => typeof (s as OrgSource | null)?.url === 'string');
  const dated = all.filter((s) => s.date).sort((a, b) => b.date!.localeCompare(a.date!));
  return (dated[0] ?? all[0])?.url;
}

export const SEVERITY: Record<IncidentSeverity, { label: string; dot: string; badge: string }> = {
  red: { label: 'Serious', dot: 'bg-red-600', badge: 'bg-red-50 text-red-800' },
  orange: { label: 'Significant', dot: 'bg-orange-500', badge: 'bg-orange-50 text-orange-800' },
  yellow: { label: 'Limited', dot: 'bg-yellow-400', badge: 'bg-yellow-50 text-yellow-800' },
};
export const SEVERITY_ORDER: IncidentSeverity[] = ['red', 'orange', 'yellow'];

/** A filter of an organization feed: only the departures. `null` is all. */
export type OrgEventFilter = 'departure';
export const isOrgEventFilter = (v: unknown): v is OrgEventFilter => v === 'departure';

/** The feeds' label of an incident: what went wrong. */
export const PRIMARY_CATEGORY_LABELS: Record<IncidentPrimaryCategory, string> = {
  model_hacking: 'Model Hacking',
  model_deception: 'Model Deception',
  model_misbehavior: 'Model Misbehavior',
  suicide_and_delusion: 'Suicide and Delusion',
  sexual_content_with_minors: 'Sexual Content With Minors',
  nonconsensual_images: 'Nonconsensual Images',
  false_or_hateful_claims: 'False or Hateful Claims',
  used_by_attackers: 'Used by Attackers',
  safeguards_failed: 'Safeguards Failed',
  systems_breached: 'Systems Breached',
  data_exposed: 'Data Exposed',
  prompt_injection: 'Prompt Injection',
  privacy_violation: 'Privacy Violation',
  safety_related_cut: 'Safety-Related Cut',
};

export const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  security: 'Security',
  privacy: 'Privacy',
  misuse: 'Misuse',
  model_behavior: 'Model behavior',
  deception: 'Deception',
  safety_process: 'Safety process',
  governance: 'Governance',
  legal: 'Legal',
  child_safety: 'Child safety',
  mental_health: 'Mental health',
  misinformation: 'Misinformation',
  bias: 'Bias',
  copyright: 'Copyright',
  labor: 'Labor',
  other: 'Other',
};

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  ongoing: 'Ongoing',
  resolved: 'Resolved',
  disputed: 'Disputed',
  under_investigation: 'Under investigation',
  in_litigation: 'In litigation',
};

export const DEPARTURE_LABELS: Record<DepartureKind, string> = {
  resigned: 'Resigned',
  fired: 'Fired',
  laid_off: 'Laid off',
  unclear: 'Reason unclear',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Jul 4, 2024", "Apr 2023" or "2023", as exact as the source. */
export function formatDate(date?: string | null, precision?: DatePrecision | null) {
  if (!date) return null;
  const [y, m, d] = date.split('-');
  const p = precision ?? (d ? 'day' : m ? 'month' : 'year');
  if (p === 'year' || !m) return y;
  const month = MONTHS[Number(m) - 1] ?? m;
  if (p === 'month' || !d) return `${month} ${y}`;
  return `${month} ${Number(d)}, ${y}`;
}

/** The earliest full date (YYYY-MM-DD) of a source list (JSON from the database). */
export function firstSourceDate(sources: unknown): string | null {
  const dates = (Array.isArray(sources) ? sources : [])
    .map((s) => (s as OrgSource | null)?.date)
    .filter((d): d is string => typeof d === 'string' && d.length === 10);
  return dates.length ? dates.reduce((a, b) => (b < a ? b : a)) : null;
}

/** The disclosure date when it came after the incident's date, else null. */
export const laterDisclosure = (i: { date: string; disclosed: string | null }) =>
  i.disclosed && i.disclosed.slice(0, i.date.length) > i.date ? i.disclosed : null;

/** An incident's date, then its disclosure date when that came later: "Aug 20 · Disclosed Nov 4,
 * 2026". When both are days of the same year, the first date drops its year; `short` drops both. */
export function incidentDate(
  i: { date: string; datePrecision: DatePrecision; disclosed: string | null },
  short = false,
) {
  const date = formatDate(i.date, i.datePrecision)!;
  const later = laterDisclosure(i);
  if (!later) return date;
  const sameYear = i.datePrecision === 'day' && later.slice(0, 4) === i.date.slice(0, 4);
  const disclosed = formatDate(later)!;
  if (!sameYear) return `${date} · Disclosed ${disclosed}`;
  return `${date.slice(0, -6)} · Disclosed ${short ? disclosed.slice(0, -6) : disclosed}`;
}

const LONG_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "October 2, 2026" from "2026-10-02", "October 2026" from "2026-10", "2026" from "2026". No year
 * for a day or month in `thisYear`. */
export function formatLongDate(date: string, thisYear = new Date().getFullYear()) {
  const [y, m, d] = date.split('-').map(Number);
  if (!m) return String(y);
  const year = y === thisYear ? '' : ` ${y}`;
  if (!d) return `${LONG_MONTHS[m - 1]}${year}`;
  return `${LONG_MONTHS[m - 1]} ${d}${year && `,${year}`}`;
}

/** "Oct 2" from "2026-10-02", "Oct" from "2026-10", "2026" from "2026", with the year (as in
 * "Oct 2, 2025") when it is not `thisYear`. */
export function formatShortDate(date: string, thisYear = new Date().getFullYear()) {
  const [y, m, d] = date.split('-').map(Number);
  if (!m) return String(y);
  const year = y === thisYear ? '' : ` ${y}`;
  if (!d) return `${MONTHS[m - 1]}${year}`;
  return `${MONTHS[m - 1]} ${d}${year && `,${year}`}`;
}

/** Markdown as plain text, for one-line summaries and share descriptions. */
export function plainText(markdown: string) {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<(https?:[^>\s]+)>/g, '$1')
    .replace(/[*_`#>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A small thumbnail of a Wikimedia Commons image, when the file type has one. */
export function commonsThumb(url: string, width = 330) {
  const m =
    /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+\.(?:jpe?g|png|webp|gif))$/i.exec(
      url,
    );
  return m ? `https://upload.wikimedia.org/wikipedia/commons/thumb/${m[1]}/${m[2]}/${m[3]}/${width}px-${m[3]}` : url;
}

/** Our copy of `commonsThumb(url, width)` in `public` (`scripts/commons-photos.ts` gets it), or
 * null when the file type has no thumbnail. */
export function localPhoto(url: string, width: number) {
  const thumb = commonsThumb(url, width);
  if (thumb === url) return null;
  return `/photos/${decodeURIComponent(thumb.split('/').pop()!).replace(/[^\w.-]+/g, '_')}`;
}

/** "JL" from "Jan Leike". */
export function initials(name: string) {
  const parts = name.split(/\s+/).filter((p) => /^\p{L}/u.test(p));
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts;
  return letters.map((p) => p[0].toUpperCase()).join('') || '?';
}

/** The host of a URL, with no `www.`, for a link label. */
export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
