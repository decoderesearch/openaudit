// Reads one research file (data/seed/orgs/<slug>.json, the format in
// data/seed/org-research-prompt.md) into spec records without ids. A file can use null for "not known"; the spec
// leaves such fields out. Problems are returned, not thrown, so one bad file does not stop the
// import of the others.
import type { DatePrecision, Organization, OrgDeparture, OrgIncident, OrgIncidentEvent } from '@openaudit/spec';

type NoIds<T> = Omit<T, 'id' | 'organizationId'>;
export type EventDraft = Omit<OrgIncidentEvent, 'id' | 'incidentId'>;
/** `models` are model names (`openai/gpt-4o`); the import finds their ids. */
export type IncidentDraft = Omit<NoIds<OrgIncident>, 'modelIds'> & { models: string[]; timeline: EventDraft[] };
export type ResearchProfile = Pick<Organization, 'website' | 'summary' | 'researchedAt' | 'researchDepth'>;
export type Research = {
  /** The file's slug: the organization's slug or one of its slug aliases. */
  slug: string;
  name?: string;
  profile: ResearchProfile;
  incidents: IncidentDraft[];
  departures: NoIds<OrgDeparture>[];
};
/** Checks a record against a spec type. Returns the errors as text, or null when it is valid. */
export type Validate = (type: string, record: unknown) => string | null;

const TOP_KEYS = new Set([
  'slug',
  'name',
  'website',
  'aliases',
  'summary',
  'researchDepth',
  'researchedAt',
  'incidents',
  'departures',
]);
const LISTS = ['incidents', 'departures'] as const;
const PRECISION: Record<number, DatePrecision> = { 4: 'year', 7: 'month', 10: 'day' };
const MARKDOWN_KEYS = new Set(['summary', 'description', 'reason', 'nextRole']);
const URL_KEYS = new Set(['url', 'pageUrl', 'website']);
const PLACEHOLDER_ID = '00000000-0000-7000-8000-000000000000';
const MODEL_NAME = /^[^/\s]+\/[^/\s]+$/;
/** An incident needs one of these. Copyright, privacy, bias or governance alone is not a safety incident. */
const SAFETY_CATEGORIES = new Set([
  'security',
  'misuse',
  'model_behavior',
  'deception',
  'safety_process',
  'child_safety',
  'mental_health',
]);

const isEmpty = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && !v.trim());

/** Null, undefined and blank strings ("not known") are left out, in all nested objects and arrays. */
export function dropNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.filter((v) => !isEmpty(v)).map(dropNulls);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => !isEmpty(v))
        .map(([k, v]) => [k, dropNulls(v)]),
    );
  return value;
}

/** True for an absolute http or https URL with no spaces. */
export function isWebUrl(url: string) {
  if (/\s/.test(url)) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** The link targets in Markdown text: `[text](target)` and `<https://...>`. */
export function markdownLinks(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) out.push(m[1]);
  for (const m of text.matchAll(/<([a-z][a-z0-9+.-]*:[^>\s]+)>/gi)) out.push(m[1]);
  return out;
}

/** Each bad URL in a record, with its path: URL fields, sources and Markdown links. */
export function badUrls(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => badUrls(v, `${path}[${i}]`));
  if (!value || typeof value !== 'object') return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(value)) {
    const at = path ? `${path}.${k}` : k;
    if (typeof v === 'string') {
      if (URL_KEYS.has(k) && !isWebUrl(v)) out.push(`${at}: ${v}`);
      if (MARKDOWN_KEYS.has(k))
        for (const link of markdownLinks(v))
          if (!isWebUrl(link) && !link.startsWith('/') && !link.startsWith('#')) out.push(`${at} link: ${link}`);
    } else out.push(...badUrls(v, at));
  }
  return out;
}

/** A source is a URL or an object with one; the spec wants the object. */
function sources(list: unknown): unknown[] {
  if (!Array.isArray(list)) return [];
  return list.map((s) => (typeof s === 'string' ? { url: s } : s));
}

function precisionProblem(date: unknown, precision: unknown, label: string): string | null {
  if (typeof date !== 'string') return null;
  const want = PRECISION[date.length];
  if (precision === undefined) return `${label}: date ${date} has no datePrecision`;
  return want === precision ? null : `${label}: date ${date} does not agree with datePrecision ${String(precision)}`;
}

function duplicates(keys: string[]) {
  return [...new Set(keys.filter((k, i) => keys.indexOf(k) !== i))];
}

type Obj = Record<string, unknown>;

/** Parses and checks one research file. `research` is set only when there are no problems. */
export function parseResearch(
  text: string,
  file: string,
  validate: Validate,
): { research?: Research; problems: string[]; notes: string[] } {
  const problems: string[] = [];
  const notes: string[] = [];
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { problems: [`${file}: not valid JSON: ${(e as Error).message}`], notes };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    return { problems: [`${file}: the top level must be an object`], notes };
  const top = dropNulls(raw) as Obj;
  const unknown = Object.keys(top).filter((k) => !TOP_KEYS.has(k));
  if (unknown.length) problems.push(`${file}: unknown keys ${unknown.join(', ')}`);
  if (typeof top.slug !== 'string') problems.push(`${file}: no slug`);
  for (const k of LISTS) if (!Array.isArray(top[k])) problems.push(`${file}: ${k} must be an array`);
  if (problems.length) return { problems, notes };

  const check = (type: string, record: Obj, label: string) => {
    const errors = validate(type, record);
    if (errors) problems.push(`${file}: ${label}: ${errors}`);
    for (const u of badUrls(record)) problems.push(`${file}: ${label}: not an http(s) URL: ${u}`);
  };
  const dated = (x: Obj, dateKey: string, label: string) => {
    if (x[dateKey] !== undefined && x.datePrecision === undefined) {
      const derived = PRECISION[String(x[dateKey]).length];
      if (derived) {
        x.datePrecision = derived;
        notes.push(`${file}: ${label}: datePrecision set to ${derived} from the date`);
      }
    }
    if (x[dateKey] === undefined && x.datePrecision !== undefined) delete x.datePrecision;
    const p = precisionProblem(x[dateKey], x.datePrecision, label);
    if (p) problems.push(`${file}: ${p}`);
  };

  const profile = {
    ...(top.website !== undefined && { website: top.website }),
    ...(top.summary !== undefined && { summary: top.summary }),
    ...(top.researchedAt !== undefined && { researchedAt: top.researchedAt }),
    ...(top.researchDepth !== undefined && { researchDepth: top.researchDepth }),
  } as ResearchProfile;
  check(
    'Organization',
    { id: PLACEHOLDER_ID, slug: 'x', displayName: 'x', aliases: [], slugAliases: [], ...profile },
    'organization',
  );

  const incidents: IncidentDraft[] = [];
  for (const [n, x] of (top.incidents as Obj[]).entries()) {
    const label = `incident ${String(x.slug ?? n)}`;
    const { timeline = [], models = [], ...rest } = x;
    const incident: Obj = { ...rest, sources: sources(rest.sources) };
    if (!Array.isArray(models) || models.some((m) => typeof m !== 'string' || !MODEL_NAME.test(m)))
      problems.push(`${file}: ${label}: models must be model names (<namespace>/<name>)`);
    else if (duplicates(models as string[]).length) problems.push(`${file}: ${label}: models has duplicates`);
    dated(incident, 'date', label);
    if (typeof incident.endDate === 'string' && typeof incident.date === 'string' && incident.endDate < incident.date)
      problems.push(`${file}: ${label}: endDate is before date`);
    check('OrgIncident', { id: PLACEHOLDER_ID, organizationId: PLACEHOLDER_ID, ...incident }, label);
    if (Array.isArray(incident.categories) && !incident.categories.some((c) => SAFETY_CATEGORIES.has(c as string)))
      problems.push(`${file}: ${label}: needs a safety category (${[...SAFETY_CATEGORIES].join(', ')})`);
    const events: EventDraft[] = [];
    for (const [order, e] of (Array.isArray(timeline) ? (timeline as Obj[]) : []).entries()) {
      const event: Obj = { order, ...e, sources: sources(e.sources) };
      dated(event, 'date', `${label} event ${order}`);
      check(
        'OrgIncidentEvent',
        { id: PLACEHOLDER_ID, incidentId: PLACEHOLDER_ID, ...event },
        `${label} event ${order}`,
      );
      events.push(event as EventDraft);
    }
    incidents.push({
      ...(incident as Omit<NoIds<OrgIncident>, 'modelIds'>),
      models: Array.isArray(models) ? (models as string[]) : [],
      timeline: events,
    });
  }

  const departures: NoIds<OrgDeparture>[] = [];
  for (const [n, x] of (top.departures as Obj[]).entries()) {
    const label = `departure ${String(x.name ?? n)}`;
    const d: Obj = { ...x, sources: sources(x.sources) };
    const image = d.image as Obj | undefined;
    if (image && image.pageUrl === undefined && image.filePage !== undefined) {
      const { filePage, ...restImage } = image;
      d.image = { ...restImage, pageUrl: filePage };
      notes.push(`${file}: ${label}: image.filePage read as image.pageUrl`);
    }
    dated(d, 'departedDate', label);
    check('OrgDeparture', { id: PLACEHOLDER_ID, organizationId: PLACEHOLDER_ID, ...d }, label);
    departures.push(d as NoIds<OrgDeparture>);
  }

  for (const [what, keys] of [
    ['incident slug', incidents.map((i) => i.slug)],
    ['departure name', departures.map((d) => d.name)],
  ] as const)
    for (const k of duplicates([...keys])) problems.push(`${file}: ${what} used twice: ${k}`);

  if (problems.length) return { problems, notes };
  return {
    research: {
      slug: top.slug as string,
      ...(typeof top.name === 'string' && { name: top.name }),
      profile,
      incidents,
      departures,
    },
    problems,
    notes,
  };
}

/** The organization a research file is for: its slug, or one of its slug aliases. */
export function researchOrganization<T extends { slug: string; slugAliases: string[] }>(
  slugs: string[],
  orgs: T[],
): T | undefined {
  for (const s of slugs) {
    const key = s.toLowerCase();
    const org = orgs.find((o) => o.slug === key) ?? orgs.find((o) => o.slugAliases.includes(key));
    if (org) return org;
  }
  return undefined;
}
