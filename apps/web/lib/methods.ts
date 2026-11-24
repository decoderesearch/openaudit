// Compares variants on their artifacts' results. Artifacts compete only in one group: the same
// subject and the same value for each `compare.groupBy` key. On a suite with `matched` (SAEs at the
// same L0), each variant's value is read off the line through its own artifacts, never past their
// range. Pure, so pages and tests share it.
import type {
  Direction,
  EvalLink,
  MethodAccess,
  MethodArtifact,
  MethodArtifactFile,
  MethodCompare,
  MethodEvalSetup,
  MethodGroup,
  MethodMatch,
  MethodParam,
  MethodSite,
  MetricDef,
  SubjectOrder,
  Topic,
} from '@openaudit/spec';

/** Group titles, in display order. */
/** Groups by what the method reads. Topic pages compare methods for one job. */
export const METHOD_GROUPS: Record<MethodGroup, { title: string; about: string }> = {
  white_box: { title: 'White box', about: "Reads the model's activations, weights or token log probs." },
  black_box: { title: 'Black box', about: "Reads only the model's text, such as its replies and chain of thought." },
};

export const ACCESS_LABELS: Record<MethodAccess, string> = {
  white_box: 'White box',
  logprobs: 'Log probs',
  black_box: 'Black box',
};

/** Topics that make an eval a safety task, not a proxy. */
const NOT_SAFETY = new Set<Topic>(['auditing']);

export type VariantView = {
  id: string;
  slug: string;
  displayName: string;
  summary?: string;
  baseline: boolean;
  access: MethodAccess;
  /** The authors of its source ("Rajamanoharan et al."). */
  author?: string;
};
export type SuiteView = {
  slug: string;
  displayName: string;
  summary?: string;
  evalOrder?: string[];
  matched?: MethodMatch;
};
export type EvalView = {
  slug: string;
  displayName: string;
  /** The eval family (`SAEBench`). */
  family?: string;
  suite?: SuiteView;
  summary?: string;
  topics: Topic[];
  version: string;
  metrics: MetricDef[];
  links: EvalLink[];
  methodSetup?: MethodEvalSetup;
};
export type ParamValue = string | number | boolean;
/** One artifact with its results, keyed by `valueKey`. */
export type ArtifactPoint = {
  id: string;
  key: string;
  displayName: string;
  variantId: string;
  subject: string;
  sites: MethodSite[];
  params: MethodArtifact['params'];
  sourceUrl: string | null;
  files?: MethodArtifactFile[];
  values: Record<string, number>;
};

/** A file to download: our R2 copy when we have one, else the file at its source. */
export function download(artifactId: string, f: MethodArtifactFile) {
  const href = f.mirror ? `/files/artifacts/${artifactId}/${f.name}` : f.url;
  const from = f.mirror ? 'OpenAudit copy' : f.url?.includes('huggingface.co') ? 'Hugging Face' : 'source';
  return href ? { name: f.name, href, from, size: bytesText(f.bytes) } : null;
}

/** A file size: `89 KB`, `13.4 MB`. */
export function bytesText(n: number) {
  const [v, unit] = n >= 1e9 ? [n / 1e9, 'GB'] : n >= 1e6 ? [n / 1e6, 'MB'] : n >= 1e3 ? [n / 1e3, 'KB'] : [n, 'B'];
  return `${v >= 100 || unit === 'B' ? Math.round(v) : v.toFixed(1)} ${unit}`;
}

/** One of a method, from its plural name: "Workspace Lenses" gives "a" and "Workspace Lens". */
export function oneOf(plural: string): { article: 'a' | 'an'; name: string } {
  const name = plural.endsWith('ses') ? plural.slice(0, -2) : plural.replace(/s$/, '');
  return { article: /^([aeiou]|llm\b)/i.test(name) ? 'an' : 'a', name };
}

const MONTH_NAMES = 'january february march april may june july august september october november december'.split(' ');

/** The authors and month of a variant's first source, from the link's title and URL. A title is
 * "Gao et al., Title", "Cooney, Africa and Irving (2026)" or "Anthropic, Title (April 2024)". A
 * list with "and" has names of at most 3 words, with a capital first and last. Text after the year ("(2026), Appendix D") is not
 * read. The month is from an arXiv ID ("2406.04093": 2024-06), else from the year in the title. */
export function sourceOf(links: EvalLink[]): { author: string | null; date: string | null } {
  const link = links[0];
  if (!link?.title) return { author: null, date: null };
  const full = link.title.trim();
  const title = full.match(/^.*?\((?:[A-Za-z]+ )?\d{4}\)/)?.[0] ?? full;
  const note = title.match(/\(([A-Za-z]+ )?(\d{4})\)$/);
  const bare = title.replace(/\s*\([^)]*\)$/, '');
  const name = (n: string) => {
    const w = n.trim().split(/\s+/);
    return w.length <= 3 && /^\p{Lu}/u.test(w[0]!) && /^\p{Lu}/u.test(w.at(-1)!);
  };
  const names = / and /.test(bare) && bare.split(/, | and /).every(name);
  const author = title.match(/^(.+?\bet al\.)/)?.[1] ?? (names ? bare : bare.split(', ')[0]);
  const arxiv = link.url.match(/arxiv\.org\/(?:abs|pdf)\/(\d{2})(\d{2})\./);
  const month = note?.[1] ? MONTH_NAMES.indexOf(note[1].trim().toLowerCase()) + 1 : 0;
  const date = arxiv
    ? `20${arxiv[1]}-${arxiv[2]}`
    : note
      ? `${note[2]}${month ? `-${String(month).padStart(2, '0')}` : ''}`
      : null;
  return { author: author || null, date };
}

/** The newest first, by `date` (`2024` or `2024-06`; a year goes after its months). No date goes
 * last. Ties keep their order. */
export function newestFirst<T extends { date: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

export const suitePath = (slug: string) => `/evaluations/suites/${slug}`;
export const methodPath = (slug: string) => `/methods/${slug}`;
export const variantPath = (method: string, variant: string) => `/methods/${method}/${variant}`;
export const artifactPath = (method: string, id: string) => `/methods/${method}/artifacts/${id}`;
/** The results of one variant on one eval. */
export const evalVariantPath = (evalSlug: string, method: string, variant: string) =>
  `/evaluations/${evalSlug}/methods/${method}/${variant}`;

/** The path of a link to a method or variant page (with a query or anchor), else null. */
export function methodPathOf(href: string): string | null {
  const m = href.match(/^\/methods\/([^/#?]+)(?:\/([^/#?]+))?\/?(?:[#?].*)?$/);
  if (!m || m[1] === 'leaderboards' || m[2] === 'artifacts') return null;
  return m[2] ? variantPath(m[1], m[2]) : methodPath(m[1]);
}

export const valueKey = (evalSlug: string, metric: string) => `${evalSlug}:${metric}`;

/** The suite of the evals with a `matched` rule, if any. */
export const matchedSuite = (evals: EvalView[]): SuiteView | null => evals.find((e) => e.suite?.matched)?.suite ?? null;

/** The key of the metric that variants are matched on, if any. */
export const matchKey = (match: MethodMatch | null | undefined) => (match ? valueKey(match.eval, match.metric) : null);

export const siteLabel = (sites: MethodSite[]) => sites.map((s) => s.address ?? s.source).join(', ');

/** The value of one `groupBy` key: `sites`, or a param key. */
export function groupValue(a: Pick<ArtifactPoint, 'sites' | 'params'>, key: string): string {
  if (key === 'sites') return siteLabel(a.sites);
  const v = a.params[key];
  return v === undefined ? '' : String(v);
}

/** Subjects and sites: the first choice on a method page. Param keys are the second. */
export function baseOf(a: Pick<ArtifactPoint, 'subject' | 'sites'>, compare: MethodCompare): string {
  return compare.groupBy.includes('sites') ? `${a.subject} @ ${siteLabel(a.sites)}` : a.subject;
}
export const paramKeys = (compare: MethodCompare) => compare.groupBy.filter((k) => k !== 'sites');

export type Selection = { base: string; params: Record<string, string> };

/** The artifacts in one group. Baselines need only the same base: some have no width. */
export function inGroup(
  artifacts: ArtifactPoint[],
  compare: MethodCompare,
  sel: Selection,
  baselineIds: Set<string> = new Set(),
): ArtifactPoint[] {
  return artifacts.filter(
    (a) =>
      baseOf(a, compare) === sel.base &&
      (baselineIds.has(a.variantId) || Object.entries(sel.params).every(([k, v]) => groupValue(a, k) === v)),
  );
}

/** The values of one param key in a base, for the variants that are not baselines. */
export function paramValuesIn(
  artifacts: ArtifactPoint[],
  variants: VariantView[],
  compare: MethodCompare,
  base: string,
  key: string,
): string[] {
  const compared = new Set(variants.filter((v) => !v.baseline).map((v) => v.id));
  const vs = artifacts
    .filter((a) => compared.has(a.variantId) && baseOf(a, compare) === base)
    .map((a) => groupValue(a, key))
    .filter(Boolean);
  return [...new Set(vs)].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
}

export type Job = {
  eval: EvalView;
  metric: MetricDef;
  /** A direct safety task, not a proxy. */
  safety: boolean;
};

/** The eval name without its suite or family (`SAEBench SCR` is `SCR`). */
export const jobLabel = ({ displayName, family, suite }: EvalView) => {
  const group = suite?.displayName ?? family;
  return group && displayName.startsWith(`${group} `) ? displayName.slice(group.length + 1) : displayName;
};

/** One row for each eval with a headline metric: by suite, then by the name that the row shows. */
export function jobsFor(evals: EvalView[]): Job[] {
  return evals
    .flatMap((e) => {
      const metric = e.metrics.find((m) => m.headline);
      return metric ? [{ eval: e, metric, safety: e.topics.some((t) => !NOT_SAFETY.has(t)) }] : [];
    })
    .sort(
      (a, b) =>
        (a.eval.suite?.displayName ?? '').localeCompare(b.eval.suite?.displayName ?? '') ||
        jobLabel(a.eval).localeCompare(jobLabel(b.eval)),
    );
}

export const better = (direction: Direction, a: number, b: number) =>
  direction === 'lower_is_better' ? a < b : direction === 'nearer_zero_is_better' ? Math.abs(a) < Math.abs(b) : a > b;

export type Point = { x: number; y: number; artifact: ArtifactPoint };

/** A variant's points (matched metric, value), by the matched metric. */
export function series(artifacts: ArtifactPoint[], variantId: string, xKey: string, key: string): Point[] {
  return artifacts
    .filter((a) => a.variantId === variantId)
    .flatMap((a) => {
      const x = a.values[xKey];
      const y = a.values[key];
      return x != null && x > 0 && y != null ? [{ x, y, artifact: a }] : [];
    })
    .sort((a, b) => a.x - b.x);
}

/** The value at `x`, on straight lines between points on a log-x axis. Null outside the points. */
export function interpolateAt(points: { x: number; y: number }[], x: number): number | null {
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.x === x) return p.y;
    const q = points[i + 1];
    if (q && p.x < x && x < q.x) {
      const t = (Math.log(x) - Math.log(p.x)) / (Math.log(q.x) - Math.log(p.x));
      return p.y + t * (q.y - p.y);
    }
  }
  return null;
}

/** Ranks (1 is best) for the values that are present. */
export function rankAll<K>(values: { id: K; value: number | null }[], direction: Direction): Map<K, Cell> {
  const present = values.filter((v): v is { id: K; value: number } => v.value != null);
  return new Map(
    values.map((v) => [
      v.id,
      v.value == null
        ? null
        : { value: v.value, rank: 1 + present.filter((o) => better(direction, o.value, v.value!)).length },
    ]),
  );
}

export type Ranked = { value: number; rank: number };
export type Cell = Ranked | null;
export type ScoreRow = {
  job: Job;
  /** By variant id. Null when the variant has no value in the group. */
  cells: Map<string, Cell>;
  /** How many variants have a value. */
  count: number;
  /** Baseline artifacts in the group, at their own sparsity. */
  baselines: { variant: VariantView; value: number }[];
};

/** The variants that are not baselines, by mean rank over the rows, best first. `ranked`: those
 * with a rank. */
export function byMeanRank(rows: ScoreRow[], variants: VariantView[]) {
  const mean = new Map(
    variants.map((v) => {
      const ranks = rows.flatMap((r) => r.cells.get(v.id)?.rank ?? []);
      return [v.id, ranks.length ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null];
    }),
  );
  const at = (v: VariantView) => mean.get(v.id) ?? Infinity;
  const compared = variants.filter((v) => !v.baseline).sort((a, b) => at(a) - at(b));
  return { compared, ranked: compared.filter((v) => mean.get(v.id) != null) };
}

/** A row for each ranked metric of one eval: each variant's median over the subject models, with
 * ranks. Only metrics that two variants or more have. */
export function metricMedians(job: Job, artifacts: ArtifactPoint[], variants: VariantView[]): ScoreRow[] {
  const { eval: e } = job;
  return e.metrics
    .filter((m) => m.direction !== 'neither')
    .flatMap((metric) => {
      const key = valueKey(e.slug, metric.key);
      const values = variants
        .filter((v) => !v.baseline)
        .map((v) => ({
          id: v.id,
          value: median(artifacts.flatMap((a) => (a.variantId === v.id ? (a.values[key] ?? []) : []))),
        }));
      const count = values.filter((v) => v.value != null).length;
      return count > 1
        ? [{ job: { ...job, metric }, cells: rankAll(values, metric.direction), count, baselines: [] }]
        : [];
    });
}

/** "4th of 7": the place of variant `id` by mean rank over the rows. */
export function suitePlace(rows: ScoreRow[], variants: VariantView[], id: string) {
  const { ranked } = byMeanRank(rows, variants);
  return placeText(ranked.findIndex((v) => v.id === id) + 1, ranked.length);
}

/**
 * Each job's value for each variant in one group, with ranks. `at`: the value of the matched
 * metric. Without a match, a variant's value is that of its one artifact.
 */
export function scorecard({
  variants,
  artifacts,
  jobs,
  xKey,
  at,
}: {
  variants: VariantView[];
  /** The artifacts of one group. */
  artifacts: ArtifactPoint[];
  jobs: Job[];
  xKey: string | null;
  at: number | null;
}): ScoreRow[] {
  const compared = variants.filter((v) => !v.baseline);
  const baselines = variants.filter((v) => v.baseline);
  return jobs.map((job) => {
    const key = valueKey(job.eval.slug, job.metric.key);
    const values = compared.map((v) => ({
      id: v.id,
      value:
        xKey && at != null
          ? interpolateAt(series(artifacts, v.id, xKey, key), at)
          : (artifacts.find((a) => a.variantId === v.id && a.values[key] != null)?.values[key] ?? null),
    }));
    const cells = rankAll(values, job.metric.direction);
    return {
      job,
      cells,
      count: values.filter((v) => v.value != null).length,
      baselines: baselines.flatMap((v) =>
        artifacts
          .filter((a) => a.variantId === v.id && a.values[key] != null)
          .map((a) => ({ variant: v, value: a.values[key] })),
      ),
    };
  });
}

/** For each variant, the jobs where it ranks first. The matched eval does not count. */
export function wins(rows: ScoreRow[], matchedEval?: string): Map<string, Job[]> {
  const out = new Map<string, Job[]>();
  for (const row of rows) {
    if (row.job.eval.slug === matchedEval || row.count < 2) continue;
    for (const [id, cell] of row.cells) if (cell?.rank === 1) out.set(id, [...(out.get(id) ?? []), row.job]);
  }
  return out;
}

export type Standing = { firsts: number; of: number; medianRank: number };

/** For each variant: its first places, the rows where it has a rank, and its median rank. As `wins`. */
export function standings(rows: ScoreRow[], matchedEval?: string): Map<string, Standing> {
  const ranks = new Map<string, number[]>();
  for (const row of rows) {
    if (row.job.eval.slug === matchedEval || row.count < 2) continue;
    for (const [id, cell] of row.cells) if (cell) ranks.set(id, [...(ranks.get(id) ?? []), cell.rank]);
  }
  return new Map(
    [...ranks].map(([id, rs]) => [
      id,
      { firsts: rs.filter((r) => r === 1).length, of: rs.length, medianRank: median(rs)! },
    ]),
  );
}

/** The bases with a value of the matched metric: the only bases that a scorecard can use. */
export function matchedBases(
  artifacts: ArtifactPoint[],
  compare: MethodCompare,
  match: MethodMatch | null | undefined,
): Set<string> {
  const xKey = matchKey(match);
  return new Set(artifacts.filter((a) => !xKey || a.values[xKey] != null).map((a) => baseOf(a, compare)));
}

/** The jobs with a value in the artifacts. */
export const jobsIn = (jobs: Job[], artifacts: ArtifactPoint[]) =>
  jobs.filter((j) => artifacts.some((a) => a.values[valueKey(j.eval.slug, j.metric.key)] != null));

/** The param of copies of one recipe, trained with different seeds. Tables show their mean. */
export const SEED = 'seed';

/** The param keys, other than the seed, whose values differ between the artifacts. */
export const varyingKeys = (artifacts: ArtifactPoint[], defs: MethodParam[]) =>
  defs.filter((d) => d.key !== SEED && new Set(artifacts.map((a) => groupValue(a, d.key))).size > 1).map((d) => d.key);

export type SeedCell = { mean: number; stderr: number | null; n: number; rank: number | null };
export type SeedRow = { variant: VariantView; cells: Map<string, SeedCell> };

/**
 * For each variant with artifacts in one group, the mean of each metric over its seeds, with the
 * standard error. Ranks (1 is best) leave out baselines and metrics with no better direction.
 */
export function seedMeans({
  variants,
  artifacts,
  evalSlug,
  metrics,
}: {
  variants: VariantView[];
  /** The artifacts of one group. */
  artifacts: ArtifactPoint[];
  evalSlug: string;
  metrics: MetricDef[];
}): SeedRow[] {
  const rows = variants.flatMap((variant) => {
    const cells = new Map<string, SeedCell>();
    for (const m of metrics) {
      const xs = artifacts.flatMap((a) => {
        const v = a.variantId === variant.id ? a.values[valueKey(evalSlug, m.key)] : undefined;
        return v == null ? [] : [v];
      });
      if (!xs.length) continue;
      const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
      const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (xs.length - 1));
      cells.set(m.key, { mean, stderr: xs.length > 1 ? sd / Math.sqrt(xs.length) : null, n: xs.length, rank: null });
    }
    return cells.size ? [{ variant, cells }] : [];
  });
  for (const m of metrics) {
    if (m.direction === 'neither') continue;
    const ranks = rankAll(
      rows
        .filter((r) => !r.variant.baseline)
        .map((r) => ({ id: r.variant.id, value: r.cells.get(m.key)?.mean ?? null })),
      m.direction,
    );
    for (const r of rows) {
      const cell = r.cells.get(m.key);
      const rank = ranks.get(r.variant.id);
      if (cell && rank) cell.rank = rank.rank;
    }
  }
  return rows;
}

/** A base in a URL: `google/gemma-2-2b @ resid_post.12` is `gemma-2-2b_resid_post.12`. */
export const baseSlug = (base: string) =>
  base
    .toLowerCase()
    .replace(/^[^/]+\//, '')
    .replace(' @ ', '_')
    .replace(/[^a-z0-9._-]+/g, '-');

/** A base's subject name, and its site when the method groups by sites. */
export function baseParts(
  base: string,
  artifacts: ArtifactPoint[],
  compare: MethodCompare,
  name: (s: string) => string,
): [string] | [string, string] {
  const a = artifacts.find((x) => baseOf(x, compare) === base)!;
  return compare.groupBy.includes('sites') && a.sites.length
    ? [name(a.subject), siteLabel(a.sites)]
    : [name(a.subject)];
}

/** The choices of a method page: `on` (a base slug), param keys, `at` and the seeded param. */
export type Choices = Partial<Record<string, string>>;

/** What the method page and the navbar read from a method. */
export type MethodInput = {
  method: { compare: MethodCompare };
  variants: VariantView[];
  params: MethodParam[];
  evals: EvalView[];
  artifacts: ArtifactPoint[];
};

const middle = <T>(xs: T[]): T | undefined => xs[Math.floor((xs.length - 1) / 2)];

/**
 * The scorecard on the matched suite's evals, for the choices. A missing choice takes its default:
 * the base with the most artifacts, the middle value of each param (16k of 4k, 16k and 65k), and
 * the default target. Only bases with the matched metric count.
 */
export function scorecardView({ method: { compare }, variants, evals, artifacts }: MethodInput, choices: Choices) {
  const suite = matchedSuite(evals);
  const match = suite?.matched ?? null;
  const scored = matchedBases(artifacts, compare, match);
  const counts = new Map<string, number>();
  for (const a of artifacts) {
    const b = baseOf(a, compare);
    if (scored.has(b)) counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  const bases = [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || a.localeCompare(b));
  const jobs = jobsIn(
    jobsFor(suite ? evals.filter((e) => e.suite?.slug === suite.slug) : evals),
    artifacts.filter((a) => scored.has(baseOf(a, compare))),
  );
  const base = bases.find((b) => baseSlug(b) === choices.on) ?? bases[0];
  const keys = paramKeys(compare);
  const options = Object.fromEntries(
    keys.map((k) => [k, base ? paramValuesIn(artifacts, variants, compare, base, k) : []]),
  );
  const picked = Object.fromEntries(
    keys.map((k) => [k, options[k].find((v) => v === choices[k]) ?? middle(options[k]) ?? '']),
  );
  const at = match ? (match.targets.find((t) => String(t) === choices.at) ?? match.default) : null;
  const baselineIds = new Set(variants.filter((v) => v.baseline).map((v) => v.id));
  const group = base ? inGroup(artifacts, compare, { base, params: picked }, baselineIds) : [];
  const shown = variants.filter((v) => group.some((a) => a.variantId === v.id));
  const rows = match && base ? scorecard({ variants: shown, artifacts: group, jobs, xKey: matchKey(match), at }) : [];
  return { suite, match, bases, base, keys, options, picked, at, group, shown, rows, jobs };
}

/** The scorecard's params for people: `width 16k`. */
export const pickedText = (keys: string[], picked: Record<string, string>, defs: MethodParam[]) =>
  keys.map((k) => {
    const def = defs.find((d) => d.key === k);
    return `${def?.label.toLowerCase() ?? k} ${formatParam(def, picked[k])}`;
  });

/**
 * The param that differs between the seeded artifacts (as the target L0), its sorted values, and a
 * test for the artifacts of one value. Baselines do not set the param. A baseline without a value
 * (as an ICA Lens, with no target L0) is in each group.
 */
function seedGroups(artifacts: ArtifactPoint[], variants: VariantView[], params: MethodParam[]) {
  const baselines = new Set(variants.filter((v) => v.baseline).map((v) => v.id));
  const key: string | undefined = varyingKeys(
    artifacts.filter((a) => !baselines.has(a.variantId)),
    params,
  )[0];
  const fixed = (a: ArtifactPoint) => !!key && baselines.has(a.variantId) && groupValue(a, key) === '';
  const values = key
    ? [...new Set(artifacts.filter((a) => !fixed(a)).map((a) => groupValue(a, key)))].sort(
        (a, b) => Number(a) - Number(b) || a.localeCompare(b),
      )
    : [];
  const of = (value: string) => (a: ArtifactPoint) => !key || fixed(a) || groupValue(a, key) === value;
  return { key, values, fixed, of };
}

/**
 * For each eval with seeded artifacts: the mean of each variant over its seeds. One param may
 * differ (the target L0); the choice picks its value, and the middle value is the default.
 */
export function seededViews({ variants, params, evals, artifacts }: MethodInput, choices: Choices) {
  const seeded = artifacts.filter((a) => a.params[SEED] !== undefined);
  return jobsIn(jobsFor(evals), seeded).map((job) => {
    const has = (a: ArtifactPoint, m: MetricDef) => a.values[valueKey(job.eval.slug, m.key)] != null;
    const mine = seeded.filter((a) => job.eval.metrics.some((m) => has(a, m)));
    const { key, values, of } = seedGroups(mine, variants, params);
    const value = key ? (values.find((v) => v === choices[key]) ?? middle(values) ?? '') : '';
    const metrics = job.eval.metrics.filter((m) => mine.some((a) => has(a, m)));
    const rows = seedMeans({
      variants,
      artifacts: mine.filter(of(value)),
      evalSlug: job.eval.slug,
      metrics,
    });
    return { job, key, values, value, metrics, seeds: new Set(mine.map((a) => a.params[SEED])).size, rows };
  });
}

/** One seeded artifact of a variant on an eval: its group value (as a target L0) and its values.
 * `value` is '' for a baseline that is in each group. */
export type SeedPoint = { id: string; seed: number; value: string; values: Record<string, number> };

/**
 * One variant on one eval with seeded artifacts. For each value of the first param that varies (as
 * the target L0): the mean of each variant over its seeds, with ranks. Also each seed of this
 * variant. Null when the variant has no seeded results on the eval.
 */
export function variantSeedView(
  { variants, params, evals, artifacts }: Omit<MethodInput, 'method'>,
  variantId: string,
  evalSlug: string,
) {
  const job = jobsFor(evals).find((j) => j.eval.slug === evalSlug);
  if (!job) return null;
  const has = (a: ArtifactPoint, m: MetricDef) => a.values[valueKey(evalSlug, m.key)] != null;
  const all = artifacts.filter((a) => a.params[SEED] !== undefined && job.eval.metrics.some((m) => has(a, m)));
  const mine = all.filter((a) => a.variantId === variantId);
  if (!mine.length) return null;
  const metrics = job.eval.metrics.filter((m) => all.some((a) => has(a, m)));
  const byValue = (a: string, b: string) => Number(a) - Number(b) || a.localeCompare(b);
  const g = seedGroups(all, variants, params);
  const key = g.key ?? null;
  const values = key ? g.values : [''];
  const groups = values.map((value) => {
    const means = seedMeans({ variants, artifacts: all.filter(g.of(value)), evalSlug, metrics });
    return { value, means, of: means.filter((r) => !r.variant.baseline).length };
  });
  const seeds: SeedPoint[] = mine
    .map((a) => ({
      id: a.id,
      seed: Number(a.params[SEED]),
      value: key && !g.fixed(a) ? groupValue(a, key) : '',
      values: Object.fromEntries(
        metrics.flatMap((m) => {
          const v = a.values[valueKey(evalSlug, m.key)];
          return v == null ? [] : [[m.key, v]];
        }),
      ),
    }))
    .sort((a, b) => byValue(a.value, b.value) || a.seed - b.seed);
  return { job, key, values, metrics, groups, seeds };
}

export type SeedSeries = { id: string; name: string; points: { x: number; y: number }[] };
export type SeedChart = {
  key: string;
  title: string;
  description?: string;
  /** "Higher is better" or "Lower is better", if any. */
  better?: string;
  current: SeedSeries;
  others: SeedSeries[];
  seeds: { id: string; x: number; y: number; seed: number }[];
};

export const BETTER: Record<string, string> = {
  higher_is_better: 'Higher is better',
  lower_is_better: 'Lower is better',
  nearer_zero_is_better: 'Nearer 0 is better',
};

/** For each metric of a `variantSeedView`: the variant's mean by the param that differs (as the
 * target L0), the other variants' means, and each seed. None when no param differs. No chart for a
 * metric that is the param again (as L0 by target L0). */
export function seedCharts(
  { key, metrics, groups, seeds }: NonNullable<ReturnType<typeof variantSeedView>>,
  variants: VariantView[],
  variantId: string,
): SeedChart[] {
  const variant = variants.find((v) => v.id === variantId);
  if (!key || !variant) return [];
  const xOf = new Map(groups.map((g, i) => [g.value, Number.isNaN(Number(g.value)) ? i : Number(g.value)]));
  const series = (v: VariantView, metric: string): SeedSeries => ({
    id: v.id,
    name: v.displayName,
    points: groups.flatMap((g) => {
      const cell = g.means.find((r) => r.variant.id === v.id)?.cells.get(metric);
      return cell ? [{ x: xOf.get(g.value)!, y: cell.mean }] : [];
    }),
  });
  const sameAsX = ({ points }: SeedSeries) =>
    points.length > 1 && points.every((p) => Math.abs(p.y - p.x) <= 0.05 * Math.abs(p.x));
  return metrics
    .map((m) => ({
      key: m.key,
      title: m.displayName,
      description: m.description,
      better: BETTER[m.direction],
      current: series(variant, m.key),
      others: variants
        .filter((v) => v.id !== variantId)
        .map((v) => series(v, m.key))
        .filter((s) => s.points.length > 0),
      seeds: seeds.flatMap((s) =>
        s.values[m.key] == null || !xOf.has(s.value)
          ? []
          : [{ id: s.id, x: xOf.get(s.value)!, y: s.values[m.key], seed: s.seed }],
      ),
    }))
    .filter((c) => !sameAsX(c.current));
}

/** `16384` as `16k`. */
const compact = (v: number) => (v >= 1024 && v % 1024 === 0 ? `${v / 1024}k` : v.toLocaleString('en-US'));

/** A param value for a label or table cell. */
export function formatParam(def: MethodParam | undefined, value: ParamValue | undefined): string {
  if (value === undefined) return '';
  if (def?.type === 'integer' && typeof value !== 'boolean' && value !== '' && !Number.isNaN(Number(value)))
    return compact(Number(value));
  if (def?.type === 'number' && typeof value === 'number')
    return Math.abs(value) < 0.01 && value !== 0 ? String(value) : value.toLocaleString('en-US');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

/** A param value with its unit: "16k latents", "70%". */
export function paramText(def: MethodParam | undefined, value: ParamValue | undefined): string {
  const text = formatParam(def, value);
  if (!text || !def?.unit) return text;
  return def.unit === '%' ? `${text}%` : `${text} ${def.unit}`;
}

/** `1st`, `2nd`, `3rd`, `4th`, `11th`, `21st`. */
export const ordinal = (n: number) =>
  `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;

/** The medals of the 1st, 2nd and 3rd places. */
export const MEDALS = ['🥇', '🥈', '🥉'];

/** A medal for the top 3, else "4th". Null with no rank, or with one ranked. */
export const placeText = (rank: number | null | undefined, of: number) =>
  rank && of > 1 ? (MEDALS[rank - 1] ?? ordinal(rank)) : null;

/** A metric value for a table: 3 decimals, 1 decimal from 10, or a whole number from 100. */
export const formatValue = (v: number) =>
  Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(Math.abs(v) >= 10 ? 1 : 3);

/** The median, or null for no values. */
export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** True when each variant has at most one artifact for each subject model. */
export const oneEach = (artifacts: ArtifactPoint[]) =>
  new Set(artifacts.map((a) => `${a.variantId}/${a.subject}`)).size === artifacts.length;

/** `author`: from the variant's first source link. */
export type BoardVariant = VariantView & { method: { slug: string; displayName: string } };
export type BoardRow = {
  subject: string;
  /** The sort value from the eval version (a capability index). */
  order: number | null;
  /** By variant id. Ranks leave out baselines. */
  cells: Map<string, Ranked & { artifactId: string }>;
  baselineValues: Map<string, number>;
};

/**
 * One row for each subject model: each variant's value on one metric, ranked in the row. Rows by
 * `order` (highest first), then by name.
 */
export function subjectBoard({
  variants,
  artifacts,
  key,
  direction,
  order,
}: {
  variants: BoardVariant[];
  artifacts: ArtifactPoint[];
  key: string;
  direction: Direction;
  order?: SubjectOrder;
}): BoardRow[] {
  const orderOf = new Map(order?.values.map((v) => [v.subject, v.value]) ?? []);
  const subjects = [...new Set(artifacts.filter((a) => a.values[key] != null).map((a) => a.subject))];
  const baseline = new Set(variants.filter((v) => v.baseline).map((v) => v.id));
  return subjects
    .map((subject) => {
      const mine = artifacts.filter((a) => a.subject === subject && a.values[key] != null);
      const found = variants.flatMap((v) => {
        const a = mine.find((x) => x.variantId === v.id);
        return a ? [{ v, a }] : [];
      });
      const ranked = rankAll(
        found.filter(({ v }) => !baseline.has(v.id)).map(({ v, a }) => ({ id: v.id, value: a.values[key] })),
        direction,
      );
      const cells = new Map<string, Ranked & { artifactId: string }>();
      for (const { v, a } of found) {
        const c = ranked.get(v.id);
        if (c) cells.set(v.id, { ...c, artifactId: a.id });
      }
      return {
        subject,
        order: orderOf.get(subject) ?? null,
        cells,
        baselineValues: new Map(found.filter(({ v }) => baseline.has(v.id)).map(({ v, a }) => [v.id, a.values[key]])),
      };
    })
    .sort((a, b) => (b.order ?? -Infinity) - (a.order ?? -Infinity) || a.subject.localeCompare(b.subject));
}

export type VariantMedian = { variant: BoardVariant; median: number; count: number };

/** The rows of the core models, or all rows with no `core`. */
export const coreRows = (rows: BoardRow[], core?: string[]) =>
  core?.length ? rows.filter((r) => core.includes(r.subject)) : rows;

/** The rows of the `core` models first, then the others; each part keeps its order. */
export const coreFirst = (rows: BoardRow[], core?: string[]) =>
  core?.length ? [...coreRows(rows, core), ...rows.filter((r) => !core.includes(r.subject))] : rows;

/** How many of the `core` models have a value of variant `id`. */
export const coreCount = (rows: BoardRow[], id: string, core: string[]) =>
  coreRows(rows, core).filter((r) => r.cells.has(id) || r.baselineValues.has(id)).length;

/** Each variant's median over the rows of a subject board, best first. With `core`: over the core
 * models only, and only for a variant with a value on each of them. */
export function variantMedians(
  rows: BoardRow[],
  variants: BoardVariant[],
  direction: Direction,
  core?: string[],
): VariantMedian[] {
  const used = coreRows(rows, core);
  return variants
    .flatMap((variant) => {
      const xs = used.flatMap((r) => {
        const x = r.cells.get(variant.id)?.value ?? r.baselineValues.get(variant.id);
        return x == null ? [] : [x];
      });
      if (core?.length && xs.length < core.length) return [];
      const m = median(xs);
      return m == null ? [] : [{ variant, median: m, count: xs.length }];
    })
    .sort((a, b) => (better(direction, a.median, b.median) ? -1 : better(direction, b.median, a.median) ? 1 : 0));
}
