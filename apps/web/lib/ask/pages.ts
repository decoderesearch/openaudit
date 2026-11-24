import { TOP_LEVEL_ROUTES } from '@/lib/organizations';
import { WHY_REASONS } from '@/lib/why';
import { WHY_TOURS } from '@/lib/why-tour';

// The page kinds that the site assistant knows, the pages whose text it must not read, and the
// tours that show each kind of page. The client and the server use these.

/** Pages whose main content is eval content (samples, transcripts, judge reviews of flagged chats).
 * The panel sends no page text for them, and the server drops any that comes. */
const NO_TEXT = [
  /^\/runs\/[^/]+\/(attempts|samples)\//,
  /^\/samples\//,
  /^\/attempts\//,
  /^\/evaluations\/[^/]+\/samples/,
  /\/known-errors(\/|$)/,
  /^\/judges\/[^/]+\/[^/]+\/[^/]+/,
];

/** True when the assistant may read the text of the page at `path`. */
export const readablePage = (path: string) => !NO_TEXT.some((r) => r.test(path.split('?')[0]));

/** The kind of page at `path`, for the prompt and for the tours. */
export function pageKind(path: string): string {
  const [a, b, c, d] = path.split(/[?#]/)[0].split('/').filter(Boolean);
  if (!a) return 'home';
  if (a === 'evaluations') {
    if (!b) return 'evaluations list';
    if (b === 'known-errors' || c === 'known-errors') return 'known errors';
    if (b === 'suites') return 'evaluation suite';
    if (c === 'samples') return 'evaluation samples';
    if (c === 'methods') return 'method variant results on a method evaluation';
    return 'evaluation';
  }
  if (a === 'runs') {
    if (b === 'mine') return 'my evals';
    if (c === 'attempts') return 'attempt';
    if (c === 'samples') return 'sample';
    return b ? 'run' : 'site page';
  }
  if (a === 'samples' || a === 'attempts') return a === 'samples' ? 'sample' : 'attempt';
  if (a === 'methods') {
    if (!b) return 'methods list';
    if (b === 'leaderboards') return 'method leaderboard';
    if (c === 'artifacts') return 'method artifact';
    if (c === 'submit') return 'method submit guide';
    return c ? 'method variant' : 'method';
  }
  if (a === 'organizations')
    return b === 'commitments' ? (c ? 'commitment' : 'commitments dashboard') : 'organizations list';
  if (a === 'models') return b === 'compare' ? 'model comparison' : 'models list';
  if (a === 'judges') return c ? (d ? 'judge review' : 'judge') : 'judges';
  if (a === 'topics') return b ? 'topic' : 'topics list';
  if (TOP_LEVEL_ROUTES.has(a)) return a;
  if (!b) return 'organization';
  if (b === 'commitments') return c ? 'organization commitment' : 'organization commitments';
  if (b === 'incidents') return c ? 'incident' : 'organization incidents';
  if (b === 'departures') return 'organization departures';
  if (b === 'models') return 'organization models';
  if (c === 'cards' || c === 'reports') return d ? 'system card or report' : 'system cards';
  return path.includes('tab=system-card') ? 'model system card' : 'model';
}

/** A guided tour that the assistant can offer. `label`: its name on the Start button. `kinds`: the
 * kinds of page that it shows. `slate`: a slate Start button, not emerald. */
export type AskTour = { id: string; label: string; title: string; kinds: string[]; slate?: boolean };

/** Kinds of page, by tour, that the tour does not show but that it explains: the Organizations
 * page holds the commitments table. */
const MORE_KINDS: Record<string, string[]> = { 'safety-coordination': ['organizations list'] };

/** The Full and Short Tutorials, the full Features tour, and the tour of each feature. */
export const ASK_TOURS: AskTour[] = [
  {
    id: 'home',
    label: 'OpenAudit Tour',
    title: 'OpenAudit Tour: the Full Tutorial, a guided tour of all of OpenAudit (5 min)',
    kinds: ['home'],
  },
  {
    id: 'short',
    label: 'Short Tour',
    title: 'Short Tour: the Short Tutorial, a quick guided tour of OpenAudit',
    kinds: ['home'],
    slate: true,
  },
  {
    id: 'why',
    label: 'All Features',
    title: 'OpenAudit Features: the full guided tour of all features',
    kinds: ['features'],
  },
  ...Object.entries(WHY_TOURS).map(([id, steps]) => {
    const head = WHY_REASONS.find((r) => r.id === id)?.head ?? id;
    return {
      id,
      label: head,
      title: `OpenAudit Features, "${head}": a guided tour`,
      kinds: [...new Set([...steps.map((s) => pageKind(s.path)), ...(MORE_KINDS[id] ?? [])])],
    };
  }),
];

/** The tours that show the kind of page at `path`. */
export const toursFor = (path: string) => ASK_TOURS.filter((t) => t.kinds.includes(pageKind(path)));

/** The tours that an answer offers with `[tour:<id>]` tags, and its text without them. A tag that is
 * still streaming in, at the end, is cut too. */
export function splitTours(text: string): { text: string; tours: AskTour[] } {
  const ids = [...text.matchAll(/\[tour:\s*([\w-]+)\s*\]/g)].map((m) => m[1]);
  const tours = ASK_TOURS.filter((t) => ids.includes(t.id));
  return {
    text: text
      .replace(/\[tour:[^\]]*\]/g, '')
      .replace(/\[(t(o(u(r(:[^\]]*)?)?)?)?)?$/, '')
      .trim(),
    tours,
  };
}
