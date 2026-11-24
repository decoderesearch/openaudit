import { INSET_TITLE } from '@/components/box-title';
import { EvalSamplesPanel } from '@/components/catalog/eval-samples-panel';
import { EvalLink } from '@/components/eval-link';
import { HashLink } from '@/components/hash-link';
import Link from '@/components/link';
import { Ranked } from '@/components/methods/condense';
import { DetectorSamples } from '@/components/methods/detector-samples';
import { LinkButtons } from '@/components/methods/link-buttons';
import { OrderChart } from '@/components/methods/order-chart';
import { MetricCells } from '@/components/methods/score-rows';
import { jobLabel } from '@/components/methods/scorecard';
import { seedPlace } from '@/components/methods/seed-table';
import { MetricLabel, SubjectColumns } from '@/components/methods/subject-columns';
import { SuiteResults } from '@/components/methods/suite-results';
import { FLUSH } from '@/components/methods/table';
import { VariantPrompts } from '@/components/methods/variant-prompts';
import { VariantArtifacts, type ArtifactRow } from '@/components/methods/variant-results';
import { Eyebrow, Page, PageTitle, TitleTags } from '@/components/page';
import { Panel, TitlePlace } from '@/components/panel';
import {
  artifactPath,
  baseOf,
  baseParts,
  baseSlug,
  BETTER,
  download,
  formatValue,
  jobsFor,
  jobsIn,
  matchedBases,
  matchedSuite,
  matchKey,
  methodPath,
  metricMedians,
  oneEach,
  paramKeys,
  paramText,
  placeText,
  scorecardView,
  SEED,
  seededViews,
  siteLabel,
  sourceOf,
  subjectBoard,
  suitePath,
  suitePlace,
  valueKey,
  variantMedians,
  variantPath,
} from '@/lib/methods';
import { shareMetadata } from '@/lib/og/meta';
import { formatDate, plainText } from '@/lib/org-research';
import { getEval } from '@/lib/server/catalog';
import { runLinks } from '@/lib/server/eval-ranks';
import { getEvalBoard, getMethod, getVariant, subjectLinks, variantMethods } from '@/lib/server/methods';
import { anyFailedSample, detectorKeys, sampleMetrics, usedSampleCount } from '@/lib/server/runs';
import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Fragment } from 'react';

type Props = {
  params: Promise<{ method: string; variant: string }>;
  searchParams: Promise<{ at?: string }>;
};

async function load(methodSlug: string, variantSlug: string) {
  const data = await getMethod(methodSlug);
  const variant = data?.variants.find((v) => v.slug === variantSlug);
  if (!data || !variant) return null;
  return { data, variant: await getVariant(variant.id) };
}

/** The samples of an eval version, for its board on the page of the variant `slug`. `detector`: the
 * variant's detector, when the samples have one. `metrics`: for the sample list's metric menu.
 * Null: no samples, or only other detectors'. */
async function boardSamples(evalSlug: string, versionId: string, slug: string) {
  const e = await getEval(evalSlug);
  const version = e?.versions.find((v) => v.id === versionId);
  if (!e || !version || !(await usedSampleCount(versionId))) return null;
  const kinds = await variantMethods(versionId);
  const { keys, kind } = kinds.size
    ? await detectorKeys(versionId, version.scores, new Set(kinds.keys()))
    : { keys: [], kind: 'label' as const };
  const key = slug.replaceAll('-', '_');
  if (keys.length && !keys.includes(key)) return null;
  const label = version.scores.find((s) => (s.attemptName ?? s.key) === key)?.displayName ?? key;
  return {
    canary: e.eval.canary,
    kind,
    detector: keys.length ? { key, label } : null,
    metrics: keys.length ? await sampleMetrics(version, [key]) : [],
    ranked: !keys.length && (await anyFailedSample(versionId)),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { method, variant } = await params;
  const found = await load(method, variant);
  if (!found) return { title: 'Method' };
  const title = `${found.variant.displayName} · ${found.data.method.displayName}`;
  const description = plainText(found.variant.summary ?? '');
  return {
    title,
    description,
    ...shareMetadata(
      title,
      description,
      variantPath(found.data.method.slug, found.variant.slug),
      `${methodPath(found.data.method.slug)}/opengraph-image`,
    ),
    ...(found.variant.visibility === 'unlisted' && { robots: { index: false, follow: false } }),
  };
}

export default async function VariantPage({ params, searchParams }: Props) {
  const [{ method: methodSlug, variant: variantSlug }, sp] = await Promise.all([params, searchParams]);
  const found = await load(methodSlug, variantSlug);
  if (!found) notFound();
  const { data, variant } = found;
  const { method, variants, params: defs, evals, artifacts, subjects } = data;
  const { compare } = method;
  const suite = matchedSuite(evals);
  const match = suite?.matched ?? null;
  const xKey = matchKey(match);
  const jobs = jobsFor(evals);
  const ranked = jobs.filter((j) => (!suite || j.eval.suite?.slug === suite.slug) && j.eval.slug !== match?.eval);
  const byId = new Map(variants.map((v) => [v.id, v]));
  const keys = paramKeys(compare);
  const mine = artifacts
    .filter((a) => a.variantId === variant.id)
    .sort(
      (a, b) =>
        baseOf(a, compare).localeCompare(baseOf(b, compare)) ||
        keys.reduce((n, k) => n || Number(a.params[k] ?? 0) - Number(b.params[k] ?? 0), 0) ||
        (xKey ? (a.values[xKey] ?? 0) - (b.values[xKey] ?? 0) : 0),
    );
  const links = subjectLinks(subjects, [...new Set(mine.map((a) => a.subject))]);
  const subjectName = (s: string) => links[s]?.label ?? s;
  // Seeded artifacts show as means in their own section, not one by one.
  const seeded = (a: (typeof artifacts)[number]) => a.params[SEED] !== undefined;
  const listed = mine.filter((a) => !seeded(a));
  const scored = matchedBases(artifacts, compare, match);
  // Matched: the suite's results table, at this variant's model with the most artifacts in all.
  const baseCount = (b: string) => artifacts.filter((a) => baseOf(a, compare) === b).length;
  const firstBase = variant.baseline
    ? undefined
    : [...new Set(listed.map((a) => baseOf(a, compare)))]
        .filter((b) => scored.has(b))
        .sort((a, b) => baseCount(b) - baseCount(a) || a.localeCompare(b))[0];
  const shownJobs = jobsIn(ranked, listed);
  // Direct: each eval's board, as on the eval page, when each model has one artifact for each variant.
  const evalBoards = match
    ? []
    : (
        await Promise.all(
          shownJobs.map(async (job) => {
            const id = data.versionIds[job.eval.slug];
            const board = id ? await getEvalBoard(id) : null;
            if (!board || !oneEach(board.artifacts) || board.variants.length < 2) return [];
            const order = job.eval.methodSetup?.subjectOrder;
            const rows = subjectBoard({
              variants: board.variants,
              artifacts: board.artifacts,
              key: valueKey(job.eval.slug, job.metric.key),
              direction: job.metric.direction,
              order,
            });
            const runs = await runLinks(id!);
            const subjects = Object.fromEntries(
              Object.entries(
                subjectLinks(
                  board.subjects,
                  rows.map((r) => r.subject),
                ),
              ).map(([n, l]) => [n, { label: l.label, href: runs.get(n) }]),
            );
            const others = metricMedians(job, board.artifacts, board.variants).filter(
              (r) => r.job.metric.key !== job.metric.key,
            );
            const samples = await boardSamples(job.eval.slug, id!, variant.slug);
            return rows.length ? [{ job, board, rows, subjects, order, others, samples }] : [];
          }),
        )
      ).flat();
  const usedKeys = defs.filter((d) => listed.some((a) => a.params[d.key] !== undefined));
  // A value that all artifacts share shows once, above the table.
  const sameIn = (k: string) => listed.every((a) => a.params[k] === listed[0].params[k]);
  const shared = listed.length > 1 ? usedKeys.filter((d) => sameIn(d.key)) : [];
  const suiteShown = !!(suite && firstBase);
  // Seeded: the evals' tables as on the eval page, when the suite's table does not show them.
  const seedEvals = new Set(
    jobsIn(jobs, mine.filter(seeded))
      .filter((j) => !suiteShown || j.eval.suite?.slug !== suite?.slug)
      .map((j) => j.eval.slug),
  );
  const resultEvals = evals.filter((e) => (suiteShown && e.suite?.slug === suite?.slug) || seedEvals.has(e.slug));
  const choices = suite && firstBase ? { on: baseSlug(firstBase), at: sp.at } : {};
  const input = { method: { compare }, variants, params: defs, evals: resultEvals, artifacts };
  // This variant's place in `ids`, best first.
  const placeIn = (ids: string[]) => placeText(ids.indexOf(variant.id) + 1, ids.length);
  // Each results panel, in page order, with this variant's place, for the jump links.
  const jumps = [
    ...evalBoards.map((b) => {
      const present = b.board.variants.filter(
        (v) => !v.baseline && b.rows.some((r) => r.cells.has(v.id) || r.baselineValues.has(v.id)),
      );
      return {
        hash: `board-${b.job.eval.slug}`,
        name: b.job.eval.displayName,
        place: placeIn(
          variantMedians(b.rows, present, b.job.metric.direction, b.job.eval.methodSetup?.coreSubjects).map(
            (m) => m.variant.id,
          ),
        ),
      };
    }),
    ...(suite && firstBase && match
      ? [
          {
            hash: `suite-${suite.slug}`,
            name: suite.displayName,
            place: suitePlace(scorecardView(input, choices).rows, variants, variant.id),
          },
        ]
      : []),
    ...seededViews(input, choices).map((s) => ({
      hash: `seeds-${s.job.eval.slug}`,
      name: s.job.eval.displayName,
      place: seedPlace(s.rows, s.metrics, variant.id),
    })),
  ];
  const shownKeys = usedKeys.filter((d) => !shared.includes(d));
  // Sites are a choice of their own when they are not part of the model choice.
  const siteKey =
    !compare.groupBy.includes('sites') && new Set(listed.map((a) => siteLabel(a.sites))).size > 1 ? ['sites'] : [];
  const choiceKeys = [
    ...siteKey.map((key) => ({ key, label: 'Sites' })),
    ...shownKeys.map((d) => ({ key: d.key, label: d.label })),
  ];
  const artifactRows: ArtifactRow[] = listed.map((a) => ({
    id: a.id,
    href: artifactPath(method.slug, a.id),
    name: a.displayName,
    base: baseOf(a, compare),
    params: Object.fromEntries([
      ...siteKey.map((k) => [k, siteLabel(a.sites) || '—']),
      ...shownKeys.map((d) => [d.key, a.params[d.key] !== undefined ? paramText(d, a.params[d.key]) : '—']),
    ]),
    x: xKey && a.values[xKey] != null ? formatValue(a.values[xKey]) : null,
    values: shownJobs.map((j) => {
      const v = a.values[valueKey(j.eval.slug, j.metric.key)];
      return v != null ? formatValue(v) : null;
    }),
    downloads: (a.files ?? []).flatMap((f) => download(a.id, f) ?? []),
  }));
  const baseLines = Object.fromEntries(
    [...new Set(listed.map((a) => baseOf(a, compare)))].map((b) => [b, baseParts(b, listed, compare, subjectName)]),
  );
  const { author, date } = sourceOf(variant.links);
  // The link that the author is from.
  const source = variant.links[0];
  const supersedes = variant.supersedesId ? byId.get(variant.supersedesId) : undefined;
  const components = variant.componentIds.flatMap((id) => byId.get(id) ?? []);

  const about = (
    <p>
      {variant.summary}
      {supersedes && (
        <span>
          {' '}
          Replaces{' '}
          <Link href={variantPath(method.slug, supersedes.slug)} className="text-sky-800 hover:underline">
            {supersedes.displayName}
          </Link>
          .
        </span>
      )}
      {components.length > 0 && (
        <span>
          {' '}
          Uses{' '}
          {components.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ', '}
              <Link href={variantPath(method.slug, c.slug)} className="text-sky-800 hover:underline">
                {c.displayName}
              </Link>
            </span>
          ))}
          .
        </span>
      )}
    </p>
  );
  return (
    <Page className="gap-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Eyebrow>Method Variant</Eyebrow>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <PageTitle>{variant.displayName}</PageTitle>
            <TitleTags items={[{ label: method.displayName, href: methodPath(method.slug) }]} />
          </div>
          <div className="mt-1 max-w-3xl text-sm/normal text-slate-600">{about}</div>
        </div>
        {(variant.links.length > 0 || listed.length > 0 || variant.prompts || author || date) && (
          <LinkButtons
            links={variant.links}
            cited={author ? source : undefined}
            byline={[
              author && source ? (
                <a
                  href={source.url}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  title={source.title ?? undefined}
                  className="inline-flex items-center gap-x-1 hover:text-slate-700 hover:underline"
                >
                  {author}
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              ) : (
                author
              ),
              formatDate(date),
            ]}
            end={
              <>
                {variant.prompts && <VariantPrompts prompts={variant.prompts} />}
                {listed.length > 0 && (
                  <VariantArtifacts
                    info={
                      <>
                        {match
                          ? 'Each row is one trained artifact, with the headline value of each eval.'
                          : 'Each row is one artifact, with the headline value of each eval.'}
                        {shared.length > 0 && (
                          <span className="mt-2 block">
                            All artifacts:{' '}
                            {shared.map((d) => `${d.label} ${paramText(d, listed[0].params[d.key])}`).join(', ')}
                          </span>
                        )}
                      </>
                    }
                    rows={artifactRows}
                    bases={baseLines}
                    keys={choiceKeys}
                    metric={match && xKey ? match.metric.toUpperCase() : null}
                    jobs={shownJobs.map((j) => ({ slug: j.eval.slug, label: jobLabel(j.eval) }))}
                  />
                )}
              </>
            }
          />
        )}
      </div>

      {jumps.length > 1 && (
        <nav aria-label="Evaluations" className="flex flex-col gap-y-1">
          <span className={cn(INSET_TITLE, 'text-slate-400')}>Evaluations</span>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {jumps.map((j, i) => (
              <Fragment key={j.hash}>
                {i > 0 && (
                  <span aria-hidden className="text-slate-400">
                    ·
                  </span>
                )}
                <HashLink hash={j.hash} className="text-sm font-medium text-sky-800 hover:underline">
                  {j.name}
                  {j.place && <span className="font-normal text-slate-500"> {j.place}</span>}
                </HashLink>
              </Fragment>
            ))}
          </div>
        </nav>
      )}

      {evalBoards.map((b) => {
        return (
          <Panel
            key={b.job.eval.slug}
            id={`board-${b.job.eval.slug}`}
            eyebrow="Evaluation"
            title={
              <>
                <EvalLink slug={b.job.eval.slug} className="text-sky-800 hover:underline">
                  {b.job.eval.displayName}
                </EvalLink>
                <TitlePlace place={jumps.find((j) => j.hash === `board-${b.job.eval.slug}`)?.place} />
              </>
            }
            sub={b.job.eval.summary}
          >
            {/* From `xl` up: the results at the left, and this variant's samples at the right, as tall as the results. */}
            <div className={cn('grid', b.samples && 'xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]')}>
              <div className="min-w-0">
                <Ranked
                  label={
                    <>
                      Ranked Results<span aria-hidden>·</span>Headline Metric<span aria-hidden>·</span>
                      <span className="font-semibold tracking-normal text-slate-600 normal-case">
                        <MetricLabel name={b.job.metric.displayName} order={b.order?.label} />
                      </span>
                    </>
                  }
                >
                  <SubjectColumns
                    label=""
                    rows={b.rows}
                    variants={b.board.variants}
                    subjects={b.subjects}
                    tone="slate"
                    direction={b.job.metric.direction}
                    only={variant.id}
                    core={b.job.eval.methodSetup?.coreSubjects}
                    className={FLUSH}
                  />
                </Ranked>
                {b.others.length > 0 && (
                  <Ranked
                    label={
                      <>
                        Ranked Results<span aria-hidden>·</span>Other Metrics
                      </>
                    }
                  >
                    <MetricCells rows={b.others} only={variant.id} scope={b.job.eval.slug} />
                  </Ranked>
                )}
                {b.order && b.rows.some((r) => r.order != null) && (
                  <div className="border-t border-slate-200">
                    <OrderChart
                      rows={b.rows}
                      variants={b.board.variants}
                      current={variant.id}
                      xLabel={b.order.label}
                      yLabel={b.job.metric.displayName}
                      better={BETTER[b.job.metric.direction]}
                      subjects={b.subjects}
                      heading={`Results by ${b.order.label}`}
                    />
                  </div>
                )}
              </div>
              {b.samples && (
                <div className="relative flex min-w-0 flex-col border-t border-slate-200 xl:min-h-[40rem] xl:border-l">
                  <div className="flex min-h-0 flex-1 flex-col xl:absolute xl:inset-0">
                    {b.samples.detector ? (
                      <DetectorSamples
                        slug={b.job.eval.slug}
                        detectors={[b.samples.detector]}
                        only={b.samples.detector.key}
                        kind={b.samples.kind}
                        models={b.rows.map((r) => ({
                          name: r.subject,
                          label: b.subjects[r.subject]?.label ?? r.subject,
                          href: b.subjects[r.subject]?.href,
                        }))}
                        canary={b.samples.canary}
                        fill
                        metrics={b.samples.metrics}
                        scope={b.job.eval.slug}
                      />
                    ) : (
                      <EvalSamplesPanel
                        slug={b.job.eval.slug}
                        ranked={b.samples.ranked}
                        canary={b.samples.canary}
                        bare
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </Panel>
        );
      })}

      {/* The tables first, then the charts by L0. */}
      {resultEvals.length > 0 && (
        <SuiteResults
          data={{ ...data, evals: resultEvals }}
          sp={choices}
          current={{ id: variant.id, name: variant.displayName }}
          variantRows
          noBaselines
          eyebrow="Evaluation"
          title={
            suite && (
              <Link href={suitePath(suite.slug)} className="text-sky-800 hover:underline">
                {suite.displayName}
              </Link>
            )
          }
          sub={suite?.summary}
        />
      )}
    </Page>
  );
}
