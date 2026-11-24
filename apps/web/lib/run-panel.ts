// The side panel's run, attempt or sample, kept in the page's query string so that a shared link
// opens it: `?run=<run id>&attempt=3&snippet=<id>`, for the run's attempt list `runShow`,
// `runMetric` and `runPage`, and `?sample=<id>&sampleRun=<run id>` for a sample.

/** `run` is the run's id as its URL has it. `snippet`: the flagged case that opened the attempt. */
export type RunPanel = {
  run: string;
  attempt?: number;
  snippet?: string;
  show?: string;
  metric?: string;
  page?: number;
};
/** A sample and its attempts. `sampleRun`: only that run's attempts. */
export type SamplePanel = { sample: string; sampleRun?: string };
export type Panel = RunPanel | SamplePanel;

export const isSamplePanel = (p: Panel): p is SamplePanel => 'sample' in p;

const KEYS = {
  run: 'run',
  attempt: 'attempt',
  snippet: 'snippet',
  show: 'runShow',
  metric: 'runMetric',
  page: 'runPage',
  sample: 'sample',
  sampleRun: 'sampleRun',
} as const;
const RUN_ID = /^[\w-]{1,64}$/;
const count = (s: string | null | undefined) => (s && /^\d{1,6}$/.test(s) && Number(s) > 0 ? Number(s) : undefined);

/** The panel in a query string. Null: no panel, or a bad id. */
export function panelFromParams(q: URLSearchParams): Panel | null {
  const sample = q.get(KEYS.sample);
  if (sample) {
    if (!RUN_ID.test(sample)) return null;
    const sampleRun = q.get(KEYS.sampleRun);
    return { sample, ...(sampleRun && RUN_ID.test(sampleRun) && { sampleRun }) };
  }
  const run = q.get(KEYS.run);
  if (!run || !RUN_ID.test(run)) return null;
  const attempt = count(q.get(KEYS.attempt));
  if (attempt) {
    const snippet = q.get(KEYS.snippet);
    return { run, attempt, ...(snippet && RUN_ID.test(snippet) && { snippet }) };
  }
  const show = q.get(KEYS.show) ?? undefined;
  const metric = q.get(KEYS.metric) ?? undefined;
  const page = count(q.get(KEYS.page));
  return { run, ...(show && { show }), ...(metric && { metric }), ...(page && { page }) };
}

/** The run panel in a query string. Null: none, or a sample panel. */
export function runPanelFromParams(q: URLSearchParams): RunPanel | null {
  const p = panelFromParams(q);
  return p && !isSamplePanel(p) ? p : null;
}

/** `q` without its panel keys, then with `panel`. */
export function withPanel(q: URLSearchParams, panel: Panel | null): URLSearchParams {
  const out = new URLSearchParams(q);
  for (const k of Object.values(KEYS)) out.delete(k);
  if (!panel) return out;
  if (isSamplePanel(panel)) {
    out.set(KEYS.sample, panel.sample);
    if (panel.sampleRun) out.set(KEYS.sampleRun, panel.sampleRun);
    return out;
  }
  out.set(KEYS.run, panel.run);
  if (panel.attempt) out.set(KEYS.attempt, String(panel.attempt));
  if (panel.attempt && panel.snippet) out.set(KEYS.snippet, panel.snippet);
  if (panel.show && panel.show !== 'all') out.set(KEYS.show, panel.show);
  if (panel.metric) out.set(KEYS.metric, panel.metric);
  if (panel.page && panel.page > 1) out.set(KEYS.page, String(panel.page));
  return out;
}

/** The panel of a run, attempt or sample page path (`/runs/x`, `/runs/x/attempts/3`,
 * `/samples/y`, `/runs/x/samples/y`). Else null. */
export function panelFromPath(href: string): Panel | null {
  const s = /^(?:\/runs\/([\w-]{1,64}))?\/samples\/([\w-]{1,64})\/?(?:[?#].*)?$/.exec(href);
  if (s) return { sample: s[2]!, ...(s[1] && { sampleRun: s[1] }) };
  const m = /^\/runs\/([\w-]{1,64})(?:\/attempts\/(\d{1,6}))?\/?(?:[?#].*)?$/.exec(href);
  if (!m || m[1] === 'mine') return null;
  const attempt = count(m[2]);
  return attempt ? { run: m[1]!, attempt } : { run: m[1]! };
}

/** The full page of a panel. */
export function panelPath(p: Panel): string {
  if (isSamplePanel(p)) return `${p.sampleRun ? `/runs/${p.sampleRun}` : ''}/samples/${p.sample}`;
  const q = new URLSearchParams();
  if (p.attempt) {
    if (p.snippet) q.set('snippet', p.snippet);
    return `/runs/${p.run}/attempts/${p.attempt}${q.size ? `?${q}` : ''}`;
  }
  if (p.show && p.show !== 'all') q.set('show', p.show);
  if (p.metric) q.set('metric', p.metric);
  if (p.page && p.page > 1) q.set('page', String(p.page));
  return `/runs/${p.run}${q.size ? `?${q}` : ''}`;
}

/** A stable key for a panel. */
export const panelKey = (p: Panel) =>
  isSamplePanel(p)
    ? `sample/${p.sample}/${p.sampleRun ?? ''}`
    : `${p.run}/${p.attempt ?? ''}/${p.snippet ?? ''}/${p.show ?? ''}/${p.metric ?? ''}/${p.page ?? ''}`;
