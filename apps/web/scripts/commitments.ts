// Reads one commitment file (data/seed/commitments/<slug>.json, the format in
// data/seed/commitment-research-prompt.md) into spec records without ids. Problems are returned,
// not thrown, so one bad file does not stop the check of the others.
import type { Commitment, CommitmentState, DatePrecision, OrgCommitmentEvent } from '@openaudit/spec';
import { badUrls, dropNulls, isWebUrl, type Validate } from './org-research';

export type CommitmentEventDraft = Omit<OrgCommitmentEvent, 'id' | 'orgCommitmentId'>;
/** One organization's entry: `org` is a slug or slug alias; `state` is that of the newest event. */
export type OrgCommitmentDraft = {
  org: string;
  checkedAt: string;
  checkedBy: string;
  summary?: string;
  state: CommitmentState;
  events: CommitmentEventDraft[];
};
export type CommitmentFile = { commitment: Omit<Commitment, 'id'>; orgs: OrgCommitmentDraft[] };

const TOP_KEYS = new Set(['slug', 'name', 'category', 'order', 'summary', 'description', 'criteria', 'orgs']);
const ORG_KEYS = new Set(['org', 'checkedAt', 'checkedBy', 'summary', 'events']);
const PRECISION: Record<number, DatePrecision> = { 4: 'year', 7: 'month', 10: 'day' };
const PLACEHOLDER_ID = '00000000-0000-7000-8000-000000000000';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** The levels that tell how far the organization committed: they need a strength. */
const COMMITTED = new Set(['full', 'partial', 'intent']);

/** The state with no events. */
export const NONE_FOUND: CommitmentState = { level: 'none_found', criteria: {}, limits: [] };

type Obj = Record<string, unknown>;

/** Problems of one state against the commitment's criteria. */
export function stateProblems(state: CommitmentState, keys: string[]): string[] {
  const out: string[] = [];
  const marks = state.criteria;
  for (const k of Object.keys(marks)) if (!keys.includes(k)) out.push(`criterion ${k} is not in the commitment`);
  for (const k of state.verified ?? [])
    if (marks[k] !== 'met' && marks[k] !== 'partly') out.push(`verified ${k} needs the criterion met or partly met`);
  for (const k of Object.keys(state.notes ?? {}))
    if (!keys.includes(k)) out.push(`note ${k} is not a criterion of the commitment`);
  const verified = new Set(state.verified);
  const complete = keys.every((k) => marks[k] === 'met' && verified.has(k));
  if (state.level === 'none_found') out.push('none_found is only for an organization with no events');
  if (state.level === 'full' && !complete) out.push('level full needs each criterion met and verified');
  if (state.level === 'partial' && complete) out.push('level partial, but each criterion is met and verified');
  if (state.level === 'intent' && keys.some((k) => marks[k] === 'met' || marks[k] === 'partly'))
    out.push('level intent, but a criterion is met or partly met: use partial');
  if (COMMITTED.has(state.level) && !state.strength) out.push(`level ${state.level} needs a strength`);
  if (state.endDate && state.duration !== 'time_limited') out.push('endDate needs duration time_limited');
  return out;
}

/** Problems of the newest state's notes: each criterion has one. A met or partly met criterion
 * tells the commitment. Each criterion that is not met and verified tells what is missing. */
export function noteProblems(state: CommitmentState, keys: string[]): string[] {
  const verified = new Set(state.verified);
  const out: string[] = [];
  for (const k of keys) {
    const note = state.notes?.[k];
    const mark = state.criteria[k];
    const complete = mark === 'met' && verified.has(k);
    if (!note) out.push(`the newest state needs a note for ${k}`);
    else if ((mark === 'met' || mark === 'partly') && !note.commitment) out.push(`note ${k} needs commitment`);
    else if (!complete && !note.missing) out.push(`note ${k} needs missing`);
    else if (complete && note.missing) out.push(`note ${k} is met and verified, so nothing is missing`);
  }
  return out;
}

/** Parses and checks one commitment file. `orgs`: the known organization slugs and slug aliases. */
export function parseCommitment(
  text: string,
  file: string,
  validate: Validate,
  orgs?: Set<string>,
): { parsed?: CommitmentFile; problems: string[] } {
  const problems: string[] = [];
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { problems: [`${file}: not valid JSON: ${(e as Error).message}`] };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    return { problems: [`${file}: the top level must be an object`] };
  const top = dropNulls(raw) as Obj;
  const unknown = Object.keys(top).filter((k) => !TOP_KEYS.has(k));
  if (unknown.length) problems.push(`${file}: unknown keys ${unknown.join(', ')}`);
  if (!Array.isArray(top.orgs)) problems.push(`${file}: orgs must be an array`);
  const { orgs: list = [], ...commitment } = top;
  const name = file
    .split('/')
    .pop()!
    .replace(/\.json$/, '');
  if (commitment.slug !== name) problems.push(`${file}: slug must be ${name}, the file name`);
  const errors = validate('Commitment', { id: PLACEHOLDER_ID, ...commitment });
  if (errors) problems.push(`${file}: ${errors}`);
  if (problems.length) return { problems };

  const c = commitment as Omit<Commitment, 'id'>;
  const keys = c.criteria.map((x) => x.key);
  if (new Set(keys).size !== keys.length) problems.push(`${file}: a criterion key is used twice`);
  const check = (type: string, record: Obj, label: string) => {
    const e = validate(type, record);
    if (e) problems.push(`${file}: ${label}: ${e}`);
    for (const u of badUrls(record)) problems.push(`${file}: ${label}: not an http(s) URL: ${u}`);
  };

  const out: OrgCommitmentDraft[] = [];
  const seen = new Set<string>();
  for (const [n, x] of (list as Obj[]).entries()) {
    const label = `org ${String(x.org ?? n)}`;
    const extra = Object.keys(x).filter((k) => !ORG_KEYS.has(k));
    if (extra.length) problems.push(`${file}: ${label}: unknown keys ${extra.join(', ')}`);
    if (typeof x.org !== 'string') {
      problems.push(`${file}: ${label}: no org`);
      continue;
    }
    if (seen.has(x.org)) problems.push(`${file}: ${label}: listed twice`);
    seen.add(x.org);
    if (orgs && !orgs.has(x.org)) problems.push(`${file}: ${label}: no organization has this slug`);
    if (typeof x.checkedAt !== 'string' || !DAY.test(x.checkedAt))
      problems.push(`${file}: ${label}: checkedAt must be a day (YYYY-MM-DD)`);
    if (typeof x.checkedBy !== 'string' || !x.checkedBy.trim())
      problems.push(`${file}: ${label}: checkedBy must name the model, as "Claude Opus 5.5 (High)"`);
    const raw = Array.isArray(x.events) ? (x.events as Obj[]) : [];
    if (!Array.isArray(x.events)) problems.push(`${file}: ${label}: events must be an array`);
    const events: CommitmentEventDraft[] = [];
    for (const [order, e] of raw.entries()) {
      const at = `${label} event ${order}`;
      const event: Obj = { order, ...e };
      if (typeof event.date === 'string' && event.datePrecision === undefined) {
        const p = PRECISION[event.date.length];
        if (p) event.datePrecision = p;
      }
      if (typeof event.date === 'string' && PRECISION[event.date.length] !== event.datePrecision)
        problems.push(`${file}: ${at}: date ${event.date} does not agree with datePrecision`);
      check('OrgCommitmentEvent', { id: PLACEHOLDER_ID, orgCommitmentId: PLACEHOLDER_ID, ...event }, at);
      const quote = event.quote as Obj | undefined;
      if (quote && typeof quote.url === 'string' && !isWebUrl(quote.url))
        problems.push(`${file}: ${at}: quote.url is not an http(s) URL`);
      if (event.state && typeof event.state === 'object')
        for (const p of stateProblems(event.state as CommitmentState, keys)) problems.push(`${file}: ${at}: ${p}`);
      const prev = events.at(-1);
      if (prev && typeof event.date === 'string' && event.date < prev.date)
        problems.push(`${file}: ${at}: events must be oldest first`);
      if (typeof event.date === 'string' && typeof x.checkedAt === 'string' && event.date > x.checkedAt)
        problems.push(`${file}: ${at}: the date is after checkedAt`);
      events.push(event as CommitmentEventDraft);
    }
    if (events.length && x.summary === undefined) problems.push(`${file}: ${label}: needs a summary`);
    const state = events.at(-1)?.state ?? NONE_FOUND;
    if (events.length) for (const p of noteProblems(state, keys)) problems.push(`${file}: ${label}: ${p}`);
    check(
      'OrgCommitment',
      {
        id: PLACEHOLDER_ID,
        organizationId: PLACEHOLDER_ID,
        commitmentId: PLACEHOLDER_ID,
        checkedAt: x.checkedAt,
        ...(x.checkedBy !== undefined && { checkedBy: x.checkedBy }),
        ...(x.summary !== undefined && { summary: x.summary }),
        state,
      },
      label,
    );
    out.push({
      org: x.org,
      checkedAt: x.checkedAt as string,
      checkedBy: x.checkedBy as string,
      ...(typeof x.summary === 'string' && { summary: x.summary }),
      state,
      events,
    });
  }
  if (problems.length) return { problems };
  return { parsed: { commitment: c, orgs: out }, problems };
}

/** Problems across the files: each `order` once. */
export function crossProblems(files: CommitmentFile[]): string[] {
  const out: string[] = [];
  const byOrder = new Map<number, string>();
  for (const { commitment: c } of files) {
    const other = byOrder.get(c.order);
    if (other) out.push(`${c.slug} and ${other} have the same order ${c.order}`);
    byOrder.set(c.order, c.slug);
  }
  return out;
}
