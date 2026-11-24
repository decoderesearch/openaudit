import type {
  CommitmentCategory,
  CommitmentEventKind,
  CommitmentLevel,
  CommitmentState,
  CriterionStatus,
  OrgCommitmentEvent,
} from '@openaudit/spec';

// Labels, styles and links for safety commitments. No server code here.

/** The path segment after `/<org>` of commitment pages. No model repo may have this name. */
export const COMMITMENTS_SEGMENT = 'commitments';

/** The table of organizations against commitments. */
export const COMMITMENTS_PATH = `/organizations/${COMMITMENTS_SEGMENT}`;

/** A commitment's page, with each organization's state. */
export const commitmentPath = (slug: string) => `${COMMITMENTS_PATH}/${encodeURIComponent(slug)}`;

/** An organization's commitments: `/<org>/commitments`. */
export const orgCommitmentsPath = (org: { slug: string }) => `/${org.slug}/${COMMITMENTS_SEGMENT}`;

/** One organization's timeline for one commitment: `/<org>/commitments/<slug>`. */
export const orgCommitmentPath = (org: { slug: string }, slug: string) =>
  `${orgCommitmentsPath(org)}/${encodeURIComponent(slug)}`;

export const CATEGORY_LABELS: Record<CommitmentCategory, string> = {
  oversight: 'Oversight and Access',
  limits: 'Development',
  transparency: 'Transparency',
  security: 'Security and Resources',
};
export const CATEGORY_ORDER: CommitmentCategory[] = ['oversight', 'limits', 'transparency', 'security'];

/** Short names, by commitment slug, for the `small` table, where a name has one line. */
export const SHORT_NAMES: Record<string, string> = {
  'independent-oversight': 'Independent Oversight',
  'rsi-development': 'Recursive Self-Improv.',
  'rd-pause': 'R&D Pacing & Coordination',
  'internal-deployment-disclosure': 'Internal Deploy Disclosure',
  'cot-monitorability': 'CoT Monitorability',
};

/** The parts of a state that its pill shows. */
export type PillState = Pick<CommitmentState, 'level'>;

/** Points out of the most a commitment, or a set of them, can get. */
export type Points = { points: number; total: number };
/** An organization's points for all commitments. `count`: its Full, Partial and Intent commitments.
 * `categories`: the points of each category. */
export type CommitmentSummary = Points & { count: number; categories: Record<CommitmentCategory, Points> };

/** A cell of a `CommitmentGrid`. `score`: null with no criterion marked. The navbar menu's grid
 * has no `summary` or `latest`, to keep it small. */
export type GridCell = { level: CommitmentLevel; score: Points | null; summary?: string; latest?: string | null };

/** The commitments table: the organizations, the most points first, and the commitments by
 * category, each with a cell for each organization (null: not checked). */
export type CommitmentGrid = {
  orgs: { id: string; slug: string; name: string; total: Points }[];
  groups: {
    category: CommitmentCategory;
    list: { slug: string; name: string; about: string; cells: (GridCell | null)[] }[];
  }[];
};

/** A commitment in the list at the side of an organization's pages. `state`: null when we did not
 * check it. `score`: null with no criterion marked. `criteria`: the number of criteria. */
export type SideCommitment = {
  slug: string;
  name: string;
  category: CommitmentCategory;
  criteria: number;
  state: PillState | null;
  score: Points | null;
};

/** The cell of each level: its word, its pill, and what it means. Emerald is good and rose is bad;
 * the darker, the stronger. The text colors keep a contrast of at least 4.5. */
export const LEVELS: Record<CommitmentLevel, { label: string; pill: string; about: string }> = {
  full: {
    label: 'Full',
    pill: 'bg-emerald-700 text-white',
    about: 'Meets each criterion, and each is independently verified.',
  },
  partial: {
    label: 'Partial',
    pill: 'bg-amber-100 text-amber-900',
    about: 'Meets some criteria, has large exceptions, or is not all verified.',
  },
  intent: {
    label: 'Intent',
    pill: 'bg-slate-200 text-slate-600 ring-2 ring-rose-200 ring-inset',
    about: 'Says it will, with no terms or date.',
  },
  none_found: {
    label: 'None Found',
    pill: 'bg-rose-100 text-rose-900',
    about: 'We checked and found no public commitment.',
  },
  declined: {
    label: 'Declined',
    pill: 'bg-rose-50 text-rose-800',
    about: 'Publicly refused.',
  },
  dropped: {
    label: 'Dropped',
    pill: 'bg-rose-100 text-rose-900',
    about: 'Had the commitment, then withdrew it or let it end.',
  },
  broken: {
    label: 'Broken',
    pill: 'bg-rose-700 text-white',
    about: 'Credible sources report that it was not kept.',
  },
};
/** Strongest first: the order of a sorted column. */
export const LEVEL_ORDER: CommitmentLevel[] = [
  'full',
  'partial',
  'intent',
  'none_found',
  'declined',
  'dropped',
  'broken',
];

/** Three groups of levels. Partial has Intent; None has each level with no commitment. */
export type LevelGroup = 'full' | 'partial' | 'none';
export const LEVEL_GROUP: Record<CommitmentLevel, LevelGroup> = {
  full: 'full',
  partial: 'partial',
  intent: 'partial',
  none_found: 'none',
  declined: 'none',
  dropped: 'none',
  broken: 'none',
};
/** The number of events in one load of a commitment's feed. */
export const COMMITMENT_FEED_PAGE = 10;
/** An event in a commitment's feed, with its organization. `href`: the organization's page for the
 * commitment. */
export type CommitmentFeedEntry = {
  key: string;
  event: OrgCommitmentEvent;
  org: { displayName: string; href: string };
};

/** The number of commitments at each level, strongest first, as "2 Full". No 0s, no "None Found". */
export function levelCounts(states: (PillState | null)[]): string[] {
  return LEVEL_ORDER.flatMap((l) => {
    const n = states.filter((s) => s?.level === l).length;
    return l !== 'none_found' && n ? [`${n} ${LEVELS[l].label}`] : [];
  });
}

export const CRITERION_LABELS: Record<CriterionStatus, string> = {
  met: 'Met',
  partly: 'Partial',
  not_met: 'Not Met',
};

export const EVENT_LABELS: Record<CommitmentEventKind, string> = {
  announced: 'Announced',
  expanded: 'Expanded',
  narrowed: 'Narrowed',
  renewed: 'Renewed',
  expired: 'Expired',
  withdrawn: 'Withdrawn',
  broken: 'Broken',
  kept: 'Kept',
  declined: 'Declined',
};

/** Up to 1 point for each criterion: half for the commitment and half when it is independently
 * verified. A partly met criterion gets half of each. Null when the state marks none. */
export function criteriaScore(state: CommitmentState, keys: string[]) {
  const marked = keys.filter((k) => state.criteria[k]);
  if (!marked.length) return null;
  const verified = new Set(state.verified ?? []);
  let met = 0;
  let partly = 0;
  let checked = 0;
  let points = 0;
  for (const k of keys) {
    const weight = state.criteria[k] === 'met' ? 1 : state.criteria[k] === 'partly' ? 0.5 : 0;
    if (!weight) continue;
    if (weight === 1) met++;
    else partly++;
    if (verified.has(k)) checked++;
    points += weight * (verified.has(k) ? 1 : 0.5);
  }
  return { met, partly, verified: checked, points, total: keys.length };
}

/** The sum of the points of the commitments, out of all their criteria. A commitment that we did not
 * check, or with no criterion marked, gives 0 points. */
export function totalScore(items: { state: CommitmentState | null | undefined; keys: string[] }[]): Points {
  let points = 0;
  let total = 0;
  for (const { state, keys } of items) {
    total += keys.length;
    if (state) points += criteriaScore(state, keys)?.points ?? 0;
  }
  return { points, total };
}

/** Points with at most 2 decimals: 2.25, 2.5, 3. */
export function formatPoints(points: number) {
  return String(Number(points.toFixed(2)));
}
