import type { Prisma } from '#prisma';
import { metricRange } from '@/components/catalog/score';
import { prisma } from '@/lib/db';
import { isLimited, versionKey } from '@/lib/latest-runs';
import { evalReleased } from '@/lib/release-dates';
import { evalResultFromRow, evalRunFromRow } from '@/lib/spec/rows';
import type { Topic } from '@openaudit/spec';

const RUN_INCLUDE = {
  eval: {
    select: {
      slug: true,
      displayName: true,
      summary: true,
      topics: true,
      status: true,
      versions: { where: { status: 'published' }, select: { version: true, releasedDate: true } },
    },
  },
  evalVersion: { select: { version: true, releasedDate: true, metrics: true, runner: true } },
  model: { select: { name: true, displayName: true, releaseDate: true } },
  results: true,
} satisfies Prisma.EvalRunInclude;

type RunRow = Prisma.EvalRunGetPayload<{ include: typeof RUN_INCLUDE }>;

export type LatestRun = ReturnType<typeof runItem>;

/**
 * A run in the shape of `listRuns` items, plus all its results. `limited`: the run used a
 * sample limit. `newerVersion`: a newer published version of the eval.
 */
function runItem(r: RunRow) {
  const run = evalRunFromRow(r);
  const headline = (r.evalVersion.metrics as { key: string; headline?: boolean }[]).find((m) => m.headline)?.key;
  const results = r.results.map((row) => {
    const x = evalResultFromRow(row);
    return { ...x, range: metricRange(r.evalVersion.metrics, x.metric) };
  });
  const mine = versionKey(r.evalVersion);
  const newer = r.eval.versions
    .filter((v) => {
      const k = versionKey(v);
      return k[0] > mine[0] || (k[0] === mine[0] && k[1] > mine[1]);
    })
    .map((v) => v.version);
  return {
    run,
    eval: {
      slug: r.eval.slug,
      displayName: r.eval.displayName,
      summary: r.eval.summary,
      topics: r.eval.topics as Topic[],
      status: r.eval.status,
    },
    version: r.evalVersion.version,
    model: { name: r.model.name, displayName: r.model.displayName },
    /** The release dates of the model and the eval version (`releasedAfter`). */
    released: { model: r.model.releaseDate, eval: evalReleased(r.evalVersion) },
    result: results.find((x) => x.metric === headline) ?? results[0],
    results,
    limited: isLimited({ settings: r.settings as Record<string, unknown> | null }),
    newerVersion: newer.sort().at(-1) ?? null,
  };
}

function byEvalName(a: LatestRun, b: LatestRun) {
  return a.eval.displayName.localeCompare(b.eval.displayName);
}

/** The runs that a card version used, in the same shape. */
export async function cardVersionRuns(versionId: string): Promise<LatestRun[]> {
  const rows = await prisma.evalRun.findMany({ where: { cardRuns: { some: { versionId } } }, include: RUN_INCLUDE });
  return rows.map(runItem).sort(byEvalName);
}
