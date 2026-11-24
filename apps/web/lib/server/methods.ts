import type { Prisma } from '#prisma';
import type { SubjectLink } from '@/components/methods/subject-board';
import { prisma } from '@/lib/db';
import { newestVersionFirst } from '@/lib/latest-runs';
import {
  sourceOf,
  subjectBoard,
  valueKey,
  type ArtifactPoint,
  type BoardVariant,
  type EvalView,
  type SuiteView,
  type VariantView,
} from '@/lib/methods';
import { detectorsOf, shareDetectorsOf, type DetectorDef } from '@/lib/runs/detectors';
import { modelPath } from '@/lib/server/catalog';
import {
  evalFromRow,
  evalSuiteFromRow,
  evalVersionFromRow,
  methodArtifactFromRow,
  methodExpertViewFromRow,
  methodFromRow,
  methodVariantFromRow,
} from '@/lib/spec/rows';
import type {
  EvalLink,
  EvalSuite,
  Method,
  MethodAccess,
  MethodArtifactFile,
  MethodExpertView,
  MethodSite,
  MetricDef,
  ScoreDef,
} from '@openaudit/spec';
import { cache } from 'react';

// Reads for the Methods pages. A method page loads all of its results (a few thousand numbers),
// so the pages compute views with `lib/methods.ts` and need no more queries.

/** The catalog model of each subject, for names and links. */
export type Subjects = Record<string, { name: string; displayName: string }>;

/** Names and model-page links for subjects. A subject that is not in the catalog has no link. */
export function subjectLinks(subjects: Subjects, names: string[]): Record<string, SubjectLink> {
  return Object.fromEntries(
    names.map((n) => {
      const m = subjects[n];
      return [n, m ? { label: m.displayName, href: modelPath(m) } : { label: n }];
    }),
  );
}

const ARTIFACT_POINT = {
  id: true,
  key: true,
  displayName: true,
  variantId: true,
  subject: true,
  sites: true,
  params: true,
  sourceUrl: true,
  files: true,
  model: { select: { name: true, displayName: true } },
  results: {
    select: {
      metric: true,
      value: true,
      evalVersionId: true,
      evalVersion: { select: { eval: { select: { slug: true } } } },
    },
  },
} satisfies Prisma.MethodArtifactSelect;

type PointRow = Prisma.MethodArtifactGetPayload<{ select: typeof ARTIFACT_POINT }>;

/** `hidden`: eval versions whose results are left out. Values are by eval slug, so two versions of
 * one eval must not mix. */
function points(rows: PointRow[], hidden?: Set<string>): { artifacts: ArtifactPoint[]; subjects: Subjects } {
  const subjects: Subjects = {};
  const artifacts = rows.map(({ results, model, sites, params, files, ...a }) => {
    if (model) subjects[a.subject] = model;
    const shown = hidden ? results.filter((r) => !hidden.has(r.evalVersionId)) : results;
    return {
      ...a,
      sites: sites as unknown as MethodSite[],
      params: params as unknown as ArtifactPoint['params'],
      files: files as unknown as MethodArtifactFile[],
      values: Object.fromEntries(shown.map((r) => [valueKey(r.evalVersion.eval.slug, r.metric), r.value])),
    };
  });
  return { artifacts, subjects };
}

const variantView = (v: {
  id: string;
  slug: string;
  displayName: string;
  summary: string | null;
  baseline: boolean;
  access: string;
  links: Prisma.JsonValue;
}): VariantView => {
  const { author } = sourceOf(Array.isArray(v.links) ? (v.links as unknown as EvalLink[]) : []);
  return {
    id: v.id,
    slug: v.slug,
    displayName: v.displayName,
    baseline: v.baseline,
    access: v.access as MethodAccess,
    ...(v.summary && { summary: v.summary }),
    ...(author && { author }),
  };
};

const suiteView = (s: EvalSuite): SuiteView => ({
  slug: s.slug,
  displayName: s.displayName,
  ...(s.summary && { summary: s.summary }),
  ...(s.evalOrder && { evalOrder: s.evalOrder }),
  ...(s.matched && { matched: s.matched }),
});

/** One version of each public eval, and of the eval `open` (its own page) when it is unlisted, as
 * an `EvalView`, with its id: `pin.version` for the eval `pin.eval`, else the newest. `hidden`: the
 * other versions of those evals. */
async function evalViews(
  versionIds: string[],
  pin?: Pin,
  open?: string,
): Promise<{ shown: { id: string; view: EvalView }[]; hidden: Set<string> }> {
  const shownEval = open
    ? { OR: [{ visibility: 'public' }, { slug: open, visibility: 'unlisted' }] }
    : { visibility: 'public' };
  const all = await prisma.evalVersion.findMany({
    where: { id: { in: versionIds }, eval: shownEval },
    include: { eval: { include: { suite: true } } },
  });
  const rows = [...Map.groupBy(all, (v) => v.evalId).values()].map(
    (vs) => vs.find((v) => v.eval.slug === pin?.eval && v.version === pin.version) ?? vs.sort(newestVersionFirst)[0]!,
  );
  const ids = new Set(rows.map((v) => v.id));
  const hidden = new Set(all.filter((v) => !ids.has(v.id)).map((v) => v.id));
  const shown = rows.map((v) => {
    const e = evalFromRow(v.eval);
    const version = evalVersionFromRow(v);
    const view: EvalView = {
      slug: e.slug,
      displayName: e.displayName,
      topics: e.facets.topics,
      version: version.version,
      metrics: version.metrics,
      links: e.links,
      ...(e.summary && { summary: e.summary }),
      ...(e.family && { family: e.family }),
      ...(v.eval.suite && { suite: suiteView(evalSuiteFromRow(v.eval.suite)) }),
      ...(version.methodSetup && { methodSetup: version.methodSetup }),
    };
    return { id: v.id, view };
  });
  return { shown, hidden };
}

export type MethodData = {
  method: Method;
  variants: VariantView[];
  /** The param definitions of the method and its variants, by key. */
  params: Method['params'];
  evals: EvalView[];
  /** The eval version id of each eval in `evals`, by eval slug. */
  versionIds: Record<string, string>;
  artifacts: ArtifactPoint[];
  subjects: Subjects;
  /** Newest first. */
  views: MethodExpertView[];
};

/** One eval version to show in place of the newest. */
type Pin = { eval: string; version: string };

/** A method with its variants, expert views, evals and every artifact's results. Each eval shows its
 * newest version with results, or `version` for the eval `evalSlug`. The eval `evalSlug` shows
 * also when it is unlisted. */
export const getMethod = cache(
  async (slug: string, evalSlug?: string, version?: string): Promise<MethodData | null> => {
    const row = await prisma.method.findUnique({
      where: { slug },
      include: {
        variants: { orderBy: [{ baseline: 'asc' }, { displayName: 'asc' }] },
        expertViews: { orderBy: [{ publishedDate: 'desc' }, { slug: 'asc' }] },
      },
    });
    if (!row) return null;
    const method = methodFromRow(row);
    const variants = row.variants.map(methodVariantFromRow);
    const artifactRows = await prisma.methodArtifact.findMany({
      where: { variant: { methodId: row.id } },
      orderBy: { key: 'asc' },
      select: ARTIFACT_POINT,
    });
    const versionIds = await prisma.methodResult.findMany({
      where: { artifact: { variant: { methodId: row.id } } },
      distinct: ['evalVersionId'],
      select: { evalVersionId: true },
    });
    const seen = new Set(method.params.map((p) => p.key));
    const extra = variants.flatMap((v) => v.params).filter((p) => !seen.has(p.key) && seen.add(p.key));
    const pin = evalSlug && version ? { eval: evalSlug, version } : undefined;
    const { shown: evals, hidden } = await evalViews(
      versionIds.map((v) => v.evalVersionId),
      pin,
      evalSlug,
    );
    return {
      method,
      variants: row.variants.map(variantView),
      params: [...method.params, ...extra],
      evals: evals.map((e) => e.view),
      versionIds: Object.fromEntries(evals.map((e) => [e.view.slug, e.id])),
      ...points(artifactRows, hidden),
      views: row.expertViews.map(methodExpertViewFromRow),
    };
  },
);

/** A suite with its public evals and the methods that have results on them. */
export const getSuite = cache(async (slug: string) => {
  const row = await prisma.evalSuite.findUnique({
    where: { slug },
    include: { evals: { where: { visibility: 'public' }, orderBy: { displayName: 'asc' } } },
  });
  if (!row) return null;
  const evalIds = row.evals.map((e) => e.id);
  const methods = await prisma.method.findMany({
    where: {
      variants: { some: { artifacts: { some: { results: { some: { evalVersion: { evalId: { in: evalIds } } } } } } } },
    },
    orderBy: { displayName: 'asc' },
    select: { slug: true },
  });
  return { suite: evalSuiteFromRow(row), evals: row.evals.map(evalFromRow), methods: methods.map((m) => m.slug) };
});

/** The slug and name of a suite, for links from its evals. */
export const suiteOf = cache(async (id: string) =>
  prisma.evalSuite.findUnique({
    where: { id },
    select: { slug: true, displayName: true, _count: { select: { evals: true } } },
  }),
);

/** One variant with its links and executive summary. */
export const getVariant = cache(async (id: string) =>
  methodVariantFromRow(await prisma.methodVariant.findUniqueOrThrow({ where: { id } })),
);

/** One artifact with its settings and each result's source. */
export const getMethodArtifact = cache(async (methodSlug: string, id: string) => {
  const row = await prisma.methodArtifact
    .findFirst({
      where: { id, variant: { method: { slug: methodSlug } } },
      include: {
        variant: { include: { method: true } },
        model: { select: { name: true, displayName: true } },
        results: {
          include: {
            evalVersion: {
              select: {
                version: true,
                metrics: true,
                eval: {
                  select: {
                    slug: true,
                    displayName: true,
                    suite: { select: { slug: true, displayName: true, evalOrder: true } },
                  },
                },
              },
            },
          },
        },
      },
    })
    .catch(() => null);
  if (!row) return null;
  // By suite, in its eval order, then by eval name, then in the order of the version's metrics (the
  // headline first).
  const evalAt = ({ slug, suite }: { slug: string; suite: { evalOrder: string[] } | null }) => {
    const at = suite?.evalOrder.indexOf(slug) ?? -1;
    return at < 0 ? Infinity : at;
  };
  const results = row.results
    .map(({ evalVersion: { metrics, ...v }, ...r }) => {
      const defs = metrics as unknown as MetricDef[];
      const at = defs.findIndex((m) => m.key === r.metric);
      return { ...r, evalVersion: v, metricName: defs[at]?.displayName ?? r.metric, order: at };
    })
    .sort((a, b) => {
      const [x, y] = [a.evalVersion.eval, b.evalVersion.eval];
      return (
        (x.suite?.displayName ?? '').localeCompare(y.suite?.displayName ?? '') ||
        evalAt(x) - evalAt(y) ||
        x.displayName.localeCompare(y.displayName) ||
        a.order - b.order
      );
    });
  const method = methodFromRow(row.variant.method);
  const variant = methodVariantFromRow(row.variant);
  return {
    artifact: methodArtifactFromRow(row),
    method,
    variant,
    params: [...method.params, ...variant.params],
    model: row.model,
    results,
  };
});

/** The methods with results on an eval, for links from the eval page. */
export async function methodsForEval(evalId: string) {
  return prisma.method.findMany({
    where: { variants: { some: { artifacts: { some: { results: { some: { evalVersion: { evalId } } } } } } } },
    orderBy: { displayName: 'asc' },
    select: { slug: true, displayName: true },
  });
}

/** The method name of each variant with results on an eval version, by the variant's slug. */
export const variantMethods = cache(async (evalVersionId: string) => {
  const rows = await prisma.methodVariant.findMany({
    where: { artifacts: { some: { results: { some: { evalVersionId } } } } },
    select: { slug: true, method: { select: { displayName: true } } },
  });
  return new Map(rows.map((r) => [r.slug, r.method.displayName]));
});

/** The share detectors of a methods eval version (`shareDetectorsOf`) that are its variants. Each
 * has its method, when not all have the same one. */
export async function evalShareDetectors(
  version: { id: string; scores: ScoreDef[] },
  attempts: Parameters<typeof shareDetectorsOf>[1],
): Promise<DetectorDef[]> {
  const scored = shareDetectorsOf(version.scores, attempts);
  if (!scored.length) return [];
  const methods = await variantMethods(version.id);
  const ours = scored.filter((d) => methods.has(d.key.replaceAll('_', '-')));
  const one = new Set(ours.map((d) => methods.get(d.key.replaceAll('_', '-')))).size === 1;
  return ours.map((d) => ({ ...d, kind: one ? undefined : methods.get(d.key.replaceAll('_', '-')) }));
}

/** The detectors of a methods eval version that some attempt answers, each with its method. */
export async function evalDetectors(
  version: { id: string; scores: ScoreDef[] },
  attempts: Parameters<typeof detectorsOf>[1],
): Promise<DetectorDef[]> {
  const scored = detectorsOf(version.scores, attempts);
  if (!scored.length) return [];
  const methods = await variantMethods(version.id);
  // A score key is its variant's slug, with `_` for `-`.
  return scored.map((d) => ({ ...d, kind: methods.get(d.key.replaceAll('_', '-')) }));
}

/** Each variant's value of the version's headline metric on one subject model, ranked first, then
 * the baselines. Null when the version has no headline or the model has no results. */
export async function modelVariantResults(
  version: { id: string; metrics: MetricDef[] },
  evalSlug: string,
  subject: string,
) {
  const headline = version.metrics.find((m) => m.headline);
  if (!headline) return null;
  const board = await getEvalBoard(version.id);
  const [row] = subjectBoard({
    variants: board.variants,
    artifacts: board.artifacts.filter((a) => a.subject === subject),
    key: valueKey(evalSlug, headline.key),
    direction: headline.direction,
  });
  if (!row) return null;
  const rows = board.variants
    .flatMap((variant) => {
      const cell = row.cells.get(variant.id);
      const value = cell?.value ?? row.baselineValues.get(variant.id);
      return value == null ? [] : [{ variant, value, rank: cell?.rank }];
    })
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
  return { metric: headline, rows };
}

export type EvalBoard = {
  variants: BoardVariant[];
  artifacts: ArtifactPoint[];
  subjects: Subjects;
};

/** Every variant's artifacts and results on one eval version, across methods. */
export const getEvalBoard = cache(async (evalVersionId: string): Promise<EvalBoard> => {
  const rows = await prisma.methodArtifact.findMany({
    where: { results: { some: { evalVersionId } } },
    orderBy: { key: 'asc' },
    select: {
      ...ARTIFACT_POINT,
      results: { ...ARTIFACT_POINT.results, where: { evalVersionId } },
    },
  });
  const variantRows = await prisma.methodVariant.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.variantId))] } },
    include: { method: { select: { slug: true, displayName: true } } },
    orderBy: [{ method: { displayName: 'asc' } }, { baseline: 'asc' }, { displayName: 'asc' }],
  });
  return {
    variants: variantRows.map((v) => ({ ...variantView(v), method: v.method })),
    ...points(rows),
  };
});
