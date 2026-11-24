import { OlderVersionNotice } from '@/components/cards/older-version-notice';
import { EvalSpecsMenu } from '@/components/catalog/eval-menus';
import { EvalSamplesPanel } from '@/components/catalog/eval-samples-panel';
import { EvalStatusNote, EvalStatusTag } from '@/components/catalog/eval-status';
import { HashButton } from '@/components/catalog/hash-button';
import { HashMenu } from '@/components/catalog/hash-menu';
import { MEDALS } from '@/components/catalog/leaders';
import { ACTION } from '@/components/catalog/model-actions';
import { VersionHistory } from '@/components/catalog/openaudit-card-client';
import { OutdatedNote } from '@/components/catalog/outdated-note';
import { Cite, ReviewBadge, SHOW_REVIEW_STATUS, TOPIC_LABELS, settingsText } from '@/components/catalog/parts';
import { ReleaseWarning } from '@/components/catalog/release-warning';
import { RunHighlight } from '@/components/catalog/run-highlight';
import { ResultValue, SafetyBar, safeShare, type Score } from '@/components/catalog/score';
import { FillHeight } from '@/components/fill-height';
import { InfoPopover } from '@/components/info-popover';
import Link from '@/components/link';
import { Markdown } from '@/components/markdown';
import { DetectorSamples, type DetectorColumn } from '@/components/methods/detector-samples';
import { Byline, LinksMenu, NeuronpediaButton, PaperButton, splitLinks } from '@/components/methods/link-buttons';
import { MetricColumns, type MetricBoard } from '@/components/methods/metric-columns';
import { SuiteResults } from '@/components/methods/suite-results';
import { FLUSH } from '@/components/methods/table';
import { NavSection } from '@/components/nav/nav-section';
import { Page, PageHeader, TitleTags } from '@/components/page';
import { Panel } from '@/components/panel';
import { AutoRefresh } from '@/components/runs/auto-refresh';
import { ACTIVE, RunStatusBadge, progressText } from '@/components/runs/parts';
import type { SortColumn } from '@/components/runs/sortable-table';
import { StatusFilterTable, type StatusRow } from '@/components/runs/status-filter-table';
import { SubmitVariantRow } from '@/components/submit-buttons';
import { monthYear } from '@/lib/card-heading';
import { CHAT_GROUPS, CHAT_GROUP_STYLES } from '@/lib/feed';
import {
  methodPath,
  oneEach,
  scorecardView,
  seededViews,
  subjectBoard,
  suitePath,
  valueKey,
  variantMedians,
} from '@/lib/methods';
import { shareMetadata } from '@/lib/og/meta';
import { releasedAfter } from '@/lib/release-dates';
import { runAnchor } from '@/lib/run-anchor';
import { getEval, modelPath, resultsForEval, savedPdf, type EvalResultView } from '@/lib/server/catalog';
import { versionDate } from '@/lib/server/eval-hovers';
import { isAdjusted, onePerModel, passRate, ranks, safestFirst } from '@/lib/server/eval-ranks';
import { getEvalBoard, getMethod, methodsForEval, subjectLinks, suiteOf, variantMethods } from '@/lib/server/methods';
import {
  anyFailedSample,
  detectorKeys,
  listRuns,
  runPath,
  runTallies,
  sampleMetrics,
  usedSampleCount,
  usedSplitCounts,
  type RunListItem,
  type RunTally,
} from '@/lib/server/runs';
import { issueCounts } from '@/lib/server/sample-issues';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import { topicPath } from '@/lib/topics';
import { cn } from '@/lib/utils';
import type { MetricDef } from '@openaudit/spec';
import { Ban, Check, ExternalLink, MessageSquareWarning, TriangleAlert, X, type LucideIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Fragment } from 'react';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ v?: string; version?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).slug;
  const found = await getEval(slug);
  const title = found?.eval.displayName ?? 'Eval';
  const description = found?.eval.description ?? '';
  return {
    title,
    description,
    ...shareMetadata(title, description, `/evaluations/${slug}`, `/evaluations/${slug}/opengraph-image`),
    ...(found?.eval.visibility === 'unlisted' && { robots: { index: false, follow: false } }),
  };
}

/** "Version 1.2", with its release date when it is not the version. */
const versionLabel = (v: { version: string; releasedDate?: string | null }) =>
  `Version ${v.version}${v.releasedDate && v.releasedDate !== v.version ? ` (${v.releasedDate})` : ''}`;

/** The eyebrow over the title: what the eval tests. */
const EYEBROWS: Record<string, string> = {
  model: 'Model Evaluation',
  method: 'Method Evaluation',
  auditor: 'Auditor Evaluation',
};

export default async function EvalPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const found = await getEval(slug);
  if (!found) notFound();
  const { eval: e, versions } = found;
  const path = `/evaluations/${e.slug}`;
  const methodEval = e.facets.subjects.includes('method');
  // A methods eval shows an older version with `?version=`.
  const [newest] = versions;
  const shown = (methodEval && versions.find((v) => v.version === sp.version)) || newest;
  const old = !!shown && shown !== newest;
  const links = splitLinks(e.links);
  const versionLinks = methodEval
    ? versions.map((v, i) => ({
        label: versionLabel(v).replace(/^Version /, ''),
        href: i === 0 ? path : `${path}?version=${encodeURIComponent(v.version)}`,
        current: v === shown,
        latest: i === 0,
      }))
    : undefined;
  const [results, allRuns, newer, methods, suite, samples, ranked, issues, viewer] = await Promise.all([
    resultsForEval(e.id),
    listRuns({ evalId: e.id }, 500, e.facets.subjects.includes('method')),
    e.supersededBy ? getEval(e.supersededBy) : null,
    methodsForEval(e.id),
    e.suiteId ? suiteOf(e.suiteId) : null,
    shown ? usedSampleCount(shown.id) : 0,
    shown ? anyFailedSample(shown.id) : false,
    shown ? issueCounts(shown.id) : null,
    getViewer(),
  ]);
  const runs = onePerModel(allRuns);
  const headline = shown?.metrics.find((m) => m.headline);
  // These need only the eval, its runs and its methods, so they load together.
  const [tallies, board, { kinds, keys, kind: sampleKind, keyMetrics, splitCounts }, methodData] = await Promise.all([
    runTallies(runs.map((r) => r.run.id)),
    methods.length && shown && headline ? getEvalBoard(shown.id) : null,
    sampleDetectorData(methods.length > 0 && samples > 0 ? shown : undefined),
    Promise.all(methods.map((m) => getMethod(m.slug, e.slug, shown?.version))).then((ds) =>
      ds.filter((d) => d != null),
    ),
  ]);
  const passFail = [...tallies.values()].some((t) => t.passed + t.failed > 0);
  const flagged = [...tallies.values()].some((t) => CHAT_GROUPS.some((g) => t.flags[g] > 0));
  const adjusted = isAdjusted(tallies.values());
  const sortedRuns = safestFirst(runs, tallies, adjusted);
  const rankOf = ranks(sortedRuns, tallies, adjusted);
  // The top 10 shown runs, and how many of their models came out after the eval.
  const topRuns = sortedRuns.filter((r) => r.run.status !== 'cancelled' && r.run.status !== 'failed').slice(0, 10);
  const outdated = topRuns.filter((r) => releasedAfter(r.released.model, r.released.eval)).length;
  const knownLink = !!issues && (issues.confirmed > 0 || (isAdmin(viewer) && issues.proposed > 0));
  const f = e.facets;
  // A leaderboard of variants across methods, when each model has one artifact for each variant.
  const once = board && oneEach(board.artifacts) && board.variants.length > 1;
  const boardRows =
    board && once && headline
      ? subjectBoard({
          variants: board.variants,
          artifacts: board.artifacts,
          key: valueKey(e.slug, headline.key),
          direction: headline.direction,
          order: shown?.methodSetup?.subjectOrder,
        })
      : [];
  const order = shown?.methodSetup?.subjectOrder;
  const core = shown?.methodSetup?.coreSubjects;
  // The leaderboard's columns open each model's run, so the runs table is not shown with it.
  const runOf = new Map(runs.map((r) => [r.model.name, runPath(r.run)]));
  const showRuns = runs.length > 0 && !(board && boardRows.length > 0 && headline);
  // A methods eval: a column for each other detector that some run has a result for.
  const scoreName = (key?: string) => shown?.scores.find((s) => s.key === key)?.displayName;
  const detectors: Detector[] = f.subjects.includes('method')
    ? (shown?.metrics ?? [])
        .filter((m) => !m.headline && m.score && runs.some((r) => r.results.some((x) => x.metric === m.key)))
        .map((m) => ({ metric: m, label: scoreName(m.score) ?? m.displayName }))
    : [];
  // In the leaderboard's order, when it has one. One method for all: no method under each label.
  const boardOrder =
    board && headline
      ? variantMedians(
          boardRows,
          board.variants.filter((v) => !v.baseline),
          headline.direction,
          core,
        ).map((m) => m.variant.slug.replaceAll('-', '_'))
      : [];
  const place = (key: string) => (boardOrder.includes(key) ? boardOrder.indexOf(key) : boardOrder.length);
  const oneKind = new Set(keys.map((key) => kinds.get(key.replaceAll('_', '-')))).size === 1;
  const sampleDetectors: DetectorColumn[] = [...keys]
    .sort((a, b) => place(a) - place(b))
    .map((key) => ({
      key,
      label: shown?.scores.find((s) => (s.attemptName ?? s.key) === key)?.displayName ?? key,
      kind: oneKind ? undefined : kinds.get(key.replaceAll('_', '-')),
    }));
  const listSamples = samples > 0 && !sampleDetectors.length;
  // A methods eval with a leaderboard and no detector samples: laid out as a model eval, with the
  // leaderboard as its runs table and no card.
  const runsBoard = methodEval && !!board && boardRows.length > 0 && !!headline && !sampleDetectors.length;
  // The headline's detector: its score, else the one score that no metric names.
  const unnamed = shown?.scores.filter((s) => !shown.metrics.some((m) => m.score === s.key)) ?? [];
  const headLabel = detectors.length
    ? (scoreName(headline?.score) ?? (unnamed.length === 1 ? unnamed[0]!.displayName : undefined))
    : undefined;
  // Below the title. The long description is in "Specifications".
  const about = e.summary || e.description;
  // Each method's results on this eval, when it has a results table or seeded tables.
  const methodResults = methodData
    .map((d) => ({ ...d, evals: d.evals.filter((x) => x.slug === e.slug) }))
    .filter((d) => {
      const v = scorecardView(d, sp);
      return (v.match && v.at != null) || seededViews(d, sp).length > 0;
    });
  const authors = e.maintainers.map((m) => m.name).join(', ');
  const date = monthYear(versionDate(versions));
  // With authors, the paper is a link on their names and in Links, not a button.
  const paperByAuthor = !!links.paper && !!authors;
  // A methods eval shows its version in place of the date: a menu of its versions, when it has more
  // than one.
  const versionText =
    methodEval &&
    shown &&
    (versionLinks && versions.length > 1 ? (
      <VersionHistory
        path={path}
        current={null}
        latest={null}
        versions={[]}
        links={{ title: 'Evaluation version', items: versionLinks }}
        label={versionLabel(shown)}
      />
    ) : (
      versionLabel(shown)
    ));
  const byline = [
    suite && suite._count.evals > 1 && (
      <Link href={suitePath(suite.slug)} className="font-medium text-sky-800 hover:underline">
        {suite.displayName}
      </Link>
    ),
    authors &&
      (paperByAuthor ? (
        <a
          href={links.paper!.url}
          target="_blank"
          rel="nofollow noopener noreferrer"
          title={links.paper!.title ?? undefined}
          className="inline-flex items-center gap-x-1 hover:text-slate-700 hover:underline"
        >
          {authors}
          <ExternalLink className="size-3" aria-hidden />
        </a>
      ) : (
        authors
      )),
    methodEval ? versionText : date,
  ].filter(Boolean);
  // A methods eval is "for" its method; with more than one, for its topics (no links), when it has some.
  const topicLinks = f.topics.map((t) => ({ label: TOPIC_LABELS[t] ?? t }));
  const methodLinks = methods.map((m) => ({ href: methodPath(m.slug), label: m.displayName }));
  const byTopic = methods.length > 1 && topicLinks.length > 0;
  const forLinks = methodEval ? (byTopic ? topicLinks : methodLinks) : [];
  const topics =
    !byTopic &&
    f.topics.length > 0 &&
    f.topics.map((t, i) => (
      <Fragment key={t}>
        {i > 0 && <span className="text-slate-300">·</span>}
        <Link href={topicPath(t)} className="hover:text-sky-800 hover:underline">
          {TOPIC_LABELS[t] ?? t}
        </Link>
      </Fragment>
    ));
  // Each model of the leaderboard, with its run.
  const boardSubjects = board
    ? Object.fromEntries(
        Object.entries(
          subjectLinks(
            board.subjects,
            boardRows.map((r) => r.subject),
          ),
        ).map(([n, l]) => [n, { label: l.label, href: runOf.get(n) }]),
      )
    : {};
  // The leaderboard of each metric with values, the headline first.
  const metricBoards: MetricBoard[] =
    board && once && headline && boardRows.length > 0
      ? [
          {
            key: headline.key,
            name: headline.displayName,
            about: headline.description,
            direction: headline.direction,
            rows: boardRows,
          },
          ...(shown?.metrics ?? [])
            .filter((m) => m !== headline && m.direction !== 'neither')
            .map((m) => ({
              key: m.key,
              name: m.displayName,
              about: m.description,
              direction: m.direction,
              rows: subjectBoard({
                variants: board.variants,
                artifacts: board.artifacts,
                key: valueKey(e.slug, m.key),
                direction: m.direction,
                order,
              }),
            }))
            .filter((b) => b.rows.length > 0),
        ]
      : [];
  // The metrics after the headline are sample sets when each is a split of the samples. Each board
  // then has its number of samples.
  const sets =
    metricBoards.length > 2 && metricBoards.slice(1).every((b) => keyMetrics.some((m) => m.key === b.key && m.split));
  const setCounts = sets ? splitCounts : null;
  const sampleMenu = keyMetrics.map((m, i) => ({
    ...m,
    count: i === 0 ? samples : m.split ? splitCounts?.get(m.key) : undefined,
  }));
  const boards = setCounts
    ? metricBoards.map((b, i) => ({ ...b, count: i === 0 ? samples : setCounts.get(b.key) }))
    : metricBoards;
  // The leaderboard: a row for each variant, a column for each model.
  const boardTable = board && metricBoards.length > 0 && (
    <>
      <MetricColumns
        boards={boards}
        part={sets ? 'Sample Set' : undefined}
        variants={board.variants}
        subjects={boardSubjects}
        filter={sampleDetectors.length > 0}
        core={core}
        info={
          <>
            Each column ranks its own variants; green is first.{' '}
            {core?.length
              ? `Rows go by the median over the ${core.length} core models, best first. A variant needs a result on each core model to have a rank.`
              : 'Rows go by median, best first.'}{' '}
            Compare variants inside a column: models differ in how hard their cases are. Baselines are references, not
            ranked. Click a column to open that model’s run and read its chats.
            {order && (
              <>
                {' '}
                Columns are by {order.label}, from{' '}
                <a href={order.sourceUrl} className="text-sky-800 hover:underline" rel="nofollow">
                  {order.sourceTable ?? 'the source'}
                </a>
                .
              </>
            )}
            {shown?.methodSetup?.definition && (
              <span className="mt-2 block">
                <span className="font-semibold text-slate-800">What counts: </span>
                <Markdown text={shown.methodSetup.definition} inline />
              </span>
            )}
            {shown?.methodSetup?.calibration && (
              <span className="mt-2 block">
                <span className="font-semibold text-slate-800">Thresholds: </span>
                <Markdown text={shown.methodSetup.calibration} inline />
              </span>
            )}
          </>
        }
        className={FLUSH}
      />
      <SubmitVariantRow />
    </>
  );

  // A methods eval's samples, with the misses of each detector. Beside the leaderboard from `xl` up.
  const samplesPanel = sampleDetectors.length > 0 && (
    <Panel id="samples" className="xl:min-h-0">
      <DetectorSamples
        slug={e.slug}
        detectors={sampleDetectors}
        kind={sampleKind}
        models={boardRows.map((r) => ({
          name: r.subject,
          label: boardSubjects[r.subject]?.label ?? r.subject,
          href: boardSubjects[r.subject]?.href,
        }))}
        canary={e.canary}
        fill={!!boardTable}
        metrics={sampleMenu}
      />
    </Panel>
  );

  return (
    <Page className="gap-y-4 xl:pb-5">
      <NavSection method={methodEval} />
      <PageHeader
        eyebrow={EYEBROWS[f.subjects[0]!] ?? 'Evaluation'}
        eyebrowAfter={methodEval && topics}
        title={e.displayName}
        description={about}
        descriptionClassName="mt-1 text-sm/normal text-slate-600"
        aside={
          (forLinks.length > 0 || e.status !== 'active') && (
            <span className="inline-flex flex-wrap items-baseline gap-x-3">
              <TitleTags items={forLinks} />
              {e.status !== 'active' && <EvalStatusTag status={e.status} />}
            </span>
          )
        }
        actions={
          <div className="flex flex-col gap-y-2 sm:items-end">
            <Byline items={byline} />
            <div className="flex flex-wrap gap-2 sm:justify-end">
              {links.demo && <NeuronpediaButton link={links.demo} />}
              {links.paper && !paperByAuthor && <PaperButton link={links.paper} />}
              <EvalSpecsMenu eval={e} version={shown} />
              {(paperByAuthor || links.rest.length > 0) && (
                <LinksMenu links={paperByAuthor ? [links.paper!, ...links.rest] : links.rest} />
              )}
              {knownLink && (
                <Link href={`/evaluations/${e.slug}/known-errors`} className={cn(ACTION, 'bg-white')}>
                  <TriangleAlert className="text-amber-600" aria-hidden />
                  Known Errors
                  <span className="text-slate-400 tabular-nums">{issues.confirmed || issues.proposed}</span>
                </Link>
              )}
              {results.length > 0 && !runs.length && (
                <HashMenu
                  name="In System Cards"
                  anchors={[IN_SYSTEM_CARDS, ...reportedAnchors(results)]}
                  className="w-[min(56rem,calc(100vw-1rem))]"
                >
                  <ReportedTable results={results} />
                  <RunHighlight />
                </HashMenu>
              )}
            </div>
          </div>
        }
      />
      {e.status !== 'active' && (
        <EvalStatusNote
          eval={e}
          newerName={newer?.eval.displayName}
          className={cn(
            'rounded-md border px-3 py-2 text-sm',
            e.status === 'legacy' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50',
          )}
        />
      )}
      {old && newest && (
        <OlderVersionNotice path={path} latest={newest.version}>
          You&apos;re viewing version {shown.version} of this evaluation. It is not the latest version.
        </OlderVersionNotice>
      )}
      {methodResults.map((d) => (
        <section key={d.method.slug} aria-label={d.method.displayName} className="flex flex-col gap-4">
          {methodResults.length > 1 && (
            <h2 className="text-sm font-semibold text-slate-800">
              <Link href={methodPath(d.method.slug)} className="hover:text-sky-800 hover:underline">
                {d.method.displayName}
              </Link>
            </h2>
          )}
          <SuiteResults data={d} sp={sp} evalPage variantRows footer={<SubmitVariantRow />} />
        </section>
      ))}
      {!methods.length && suite && (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Part of{' '}
          <Link href={suitePath(suite.slug)} className="font-medium underline">
            {suite.displayName}
          </Link>
          .
        </p>
      )}
      {boardTable &&
        !runsBoard &&
        (samplesPanel ? (
          <FillHeight className="grid grid-cols-1 gap-4 xl:h-[var(--fill-h,40rem)] xl:grid-cols-2">
            <Panel id="runs" className="xl:min-h-0">
              <div className="min-h-0 flex-1 overflow-auto bg-white">{boardTable}</div>
            </Panel>
            {samplesPanel}
          </FillHeight>
        ) : (
          <Panel id="runs">{boardTable}</Panel>
        ))}
      {!(boardTable && !runsBoard) && samplesPanel}

      {(showRuns || listSamples || runsBoard || !methods.length) && (
        <FillHeight
          className={cn(
            'grid grid-cols-1 gap-4 xl:h-[var(--fill-h,40rem)]',
            runsBoard
              ? 'xl:grid-cols-2'
              : listSamples && (showRuns || !methods.length) && 'xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]',
            !showRuns && !listSamples && !runsBoard && 'h-[var(--fill-h,24rem)]',
          )}
        >
          {runsBoard && (
            <Panel id="runs" className="xl:min-h-0">
              <div className="min-h-0 flex-1 overflow-auto bg-white">{boardTable}</div>
            </Panel>
          )}
          {!runs.length && !methods.length && <NoRuns systemCards={documentCount(results)} />}
          {showRuns && (
            <StatusFilterTable
              id="runs"
              label="Evaluation Runs"
              notice={
                outdated > 0 && (
                  <OutdatedNote label="Outdated Evaluation">
                    {outdated} of the top {topRuns.length} models were released after this evaluation, so positive
                    results are not reliable.
                  </OutdatedNote>
                )
              }
              columns={runColumns(
                passFail,
                flagged,
                headline,
                adjusted ? e.slug : undefined,
                detectors,
                headLabel,
                rankOf.size > 0,
              )}
              rows={sortedRuns.map((r) =>
                runRow(r, tallies.get(r.run.id), {
                  passFail,
                  flagged,
                  adjusted,
                  headline,
                  detectors,
                  rank: rankOf.size > 0 ? (rankOf.get(r.run.id) ?? null) : undefined,
                }),
              )}
              className="xl:h-full xl:max-h-none"
            />
          )}
          {listSamples ? (
            <EvalSamplesPanel key={e.slug} slug={e.slug} ranked={ranked} canary={e.canary} />
          ) : (
            runsBoard && <NoSamples />
          )}
        </FillHeight>
      )}
      <AutoRefresh active={runs.some((r) => ACTIVE.includes(r.run.status))} />
    </Page>
  );
}

/** A metric of another detector of a methods eval, and its column label. */
type Detector = { metric: MetricDef; label: string };

type Version = NonNullable<Awaited<ReturnType<typeof getEval>>>['versions'][number];

/** The detectors of a methods eval's samples (`version`, else none), their metrics, and the sample
 * count of each split. A score key is its variant's slug, with `_` for `-`. */
async function sampleDetectorData(version: Version | undefined) {
  const kinds = version ? await variantMethods(version.id) : new Map<string, string>();
  const { keys, kind } =
    version && kinds.size
      ? await detectorKeys(version.id, version.scores, new Set(kinds.keys()))
      : { keys: [], kind: 'label' as const };
  const keyMetrics = version && keys.length ? await sampleMetrics(version, keys) : [];
  const splitCounts = version && keyMetrics.some((m) => m.split) ? await usedSplitCounts(version.id) : null;
  return { kinds, keys, kind, keyMetrics, splitCounts };
}

/** A column's label: truncated, with the metric's name as its title. */
const ColumnLabel = ({ label, title }: { label: string; title?: string }) => (
  <span title={title} className="inline-block max-w-36 truncate align-bottom">
    {label}
  </span>
);

/** A metric's info: its description. */
const MetricInfo = ({ metric }: { metric: MetricDef }) => (
  <InfoPopover label={metric.displayName} iconClassName="size-3.5" contentClassName="text-xs font-normal">
    <p>
      {metric.displayName}
      {metric.description ? `: ${metric.description}` : '.'}
    </p>
  </InfoPopover>
);

/** The Runs table's columns. `passFail`: some run has attempts that passed or failed. `flagged`:
 * some run has a flagged chat. `headline`: the headline metric. `known`: the eval's slug when
 * samples with a known error leave the counts; then the result is the adjusted pass rate.
 * `detectors`: more result columns. `headLabel`: the headline column's label. `ranked`: a rank
 * column first. */
const runColumns = (
  passFail: boolean,
  flagged: boolean,
  headline: MetricDef | undefined,
  known?: string,
  detectors: Detector[] = [],
  headLabel?: string,
  ranked = false,
): SortColumn[] => [
  ...(ranked ? [{ key: 'rank', label: 'Rank', className: 'w-14 text-center' }] : []),
  { key: 'model', label: 'Model' },
  ...(flagged ? [{ key: 'flags', label: 'Flagged Chats' }] : []),
  known
    ? {
        key: 'result',
        label: 'Adjusted Pass Rate',
        className: 'text-center',
        info: (
          <InfoPopover label="Adjusted Pass Rate" iconClassName="size-3.5" contentClassName="text-xs font-normal">
            <p>
              The share of graded replies that passed, without the samples that have a{' '}
              <Link href={`/evaluations/${known}/known-errors`} className="text-sky-800 underline">
                known error
              </Link>
              . Pass / Fail does not count them either. The table ranks the models by it, safest first.
              {headline && ` The ${headline.displayName} of each run includes them; its title shows it.`}
            </p>
          </InfoPopover>
        ),
      }
    : {
        key: 'result',
        label: <ColumnLabel label={headLabel ?? headline?.displayName ?? 'Result'} title={headline?.displayName} />,
        className: 'text-center',
        info: headline && (
          <InfoPopover label={headline.displayName} iconClassName="size-3.5" contentClassName="text-xs font-normal">
            <p>
              The headline metric{headLabel && `, of the ${headLabel}`}
              {headline.description ? `: ${headline.description}` : '.'} The bar shows the share that is good for
              safety. The table ranks the models by it, safest first.
            </p>
          </InfoPopover>
        ),
      },
  ...detectors.map(({ metric, label }) => ({
    key: metric.key,
    label: <ColumnLabel label={label} title={metric.displayName} />,
    className: 'text-center',
    info: <MetricInfo metric={metric} />,
  })),
  ...(passFail ? [{ key: 'pass', label: 'Pass / Fail', className: 'text-center' }] : []),
];

/** The adjusted pass rate as a score. A pass is good for safety, unless the headline has no
 * safety direction. */
function passScore(rate: number, headline: MetricDef | undefined): Score {
  return {
    metric: 'adjusted_pass_rate',
    value: Math.round(rate * 1000) / 10,
    unit: 'percent',
    safetyDirection: headline?.safetyDirection === 'neither' ? 'neither' : 'higher_is_better',
  };
}

/** A count with its icon. A zero shows in light gray. */
function Count({ n, icon: Icon, color, label }: { n: number; icon: LucideIcon; color: string; label: string }) {
  return (
    <span
      title={`${label}: ${n}`}
      className={cn('inline-flex items-center gap-x-0.5', n ? 'text-slate-700' : 'text-slate-300')}
    >
      <Icon className={cn('size-3.5 shrink-0', n ? color : 'text-slate-300')} aria-label={label} />
      {n}
    </span>
  );
}

/** `adjusted`: the result is the adjusted pass rate (`passScore`); the headline result is its title.
 * `rank`: with a rank column, the run's rank (a medal for the first 3), or null for none. */
function runRow(
  { run, model, result: official, results, released }: RunListItem,
  tally: RunTally | undefined,
  {
    passFail,
    flagged,
    adjusted,
    headline,
    detectors,
    rank,
  }: {
    passFail: boolean;
    flagged: boolean;
    adjusted: boolean;
    headline: MetricDef | undefined;
    detectors: Detector[];
    rank?: number | null;
  },
): StatusRow {
  const detected = detectors.map(({ metric }) => results.find((x) => x.metric === metric.key));
  const flags = tally?.flags ?? { high: 0, medium: 0, low: 0 };
  const graded = tally ? tally.passed + tally.failed : 0;
  const rate = passRate(tally);
  const result = adjusted ? (rate === undefined ? undefined : passScore(rate, headline)) : official;
  const unscored = tally ? tally.blocked + tally.errors : 0;
  const title =
    [
      adjusted && official && headline
        ? `${headline.displayName} with the known errors: ${official.value}${official.unit === 'percent' ? '%' : ''}`
        : undefined,
      unscored && tally
        ? `Not scored: ${tally.blocked} blocked by the provider, ${tally.errors} with errors. The score leaves them out.`
        : undefined,
    ]
      .filter(Boolean)
      .join('\n') || undefined;
  return {
    key: run.id,
    status: run.status,
    values: {
      rank: rank ?? null,
      model: model.displayName,
      flags: flags.high * 1e6 + flags.medium * 1e3 + flags.low,
      pass: graded && tally ? tally.passed / graded : null,
      result: typeof result?.value === 'number' ? result.value : null,
      ...Object.fromEntries(
        detectors.map(({ metric }, i) => [
          metric.key,
          typeof detected[i]?.value === 'number' ? detected[i].value : null,
        ]),
      ),
    },
    node: (
      <tr key={run.id} className="group relative cursor-pointer hover:bg-sky-50">
        {rank !== undefined && (
          <td className="px-3 py-2 text-center whitespace-nowrap text-slate-500 tabular-nums">
            {rank !== null &&
              (MEDALS[rank - 1] ? (
                <span aria-label={`Rank ${rank}`} className="text-base leading-none">
                  {MEDALS[rank - 1]}
                </span>
              ) : (
                rank
              ))}
          </td>
        )}
        <td className="px-3 py-2 whitespace-nowrap">
          <Link
            href={runPath(run)}
            className="text-[13px] font-semibold text-sky-800 group-hover:underline after:absolute after:inset-0"
          >
            {model.displayName}
          </Link>
          <ReleaseWarning model={released.model} evalDate={released.eval} className="ml-1.5" />
          {run.status !== 'succeeded' && (
            <div className="mt-1">
              <RunStatusBadge status={run.status} />
              {ACTIVE.includes(run.status) && (
                <span className="ml-1.5 text-slate-500 tabular-nums">{progressText(run)}</span>
              )}
            </div>
          )}
        </td>
        {flagged && (
          <td className="px-3 py-2 whitespace-nowrap tabular-nums">
            <span className="inline-flex gap-x-2.5">
              {CHAT_GROUPS.map((g) => (
                <Count
                  key={g}
                  n={flags[g]}
                  icon={MessageSquareWarning}
                  color={CHAT_GROUP_STYLES[g].icon}
                  label={CHAT_GROUP_STYLES[g].label}
                />
              ))}
            </span>
          </td>
        )}
        <td title={title} className="px-3 py-2 text-center whitespace-nowrap text-slate-800 tabular-nums">
          {result ? (
            <>
              {adjusted ? `${result.value.toFixed(1)}%` : <ResultValue result={result} round />}
              {safeShare(result) !== undefined && <SafetyBar result={result} className="mx-auto mt-0.5 h-1.5 w-10" />}
            </>
          ) : (
            '—'
          )}
        </td>
        {detected.map((r, i) => (
          <td
            key={detectors[i]!.metric.key}
            className="px-3 py-2 text-center whitespace-nowrap text-slate-800 tabular-nums"
          >
            {r ? (
              <>
                <ResultValue result={r} round />
                {safeShare(r) !== undefined && <SafetyBar result={r} className="mx-auto mt-0.5 h-1.5 w-10" />}
              </>
            ) : (
              '—'
            )}
          </td>
        ))}
        {passFail && (
          <td className="px-3 py-2 text-center whitespace-nowrap tabular-nums">
            {graded && tally ? (
              <span className="inline-flex gap-x-2.5">
                <Count n={tally.passed} icon={Check} color="text-emerald-600" label="Passed" />
                <Count n={tally.failed} icon={X} color="text-rose-600" label="Failed" />
                {tally.blocked > 0 && <Count n={tally.blocked} icon={Ban} color="text-slate-500" label="Blocked" />}
                {tally.errors > 0 && (
                  <Count n={tally.errors} icon={TriangleAlert} color="text-amber-600" label="Errors" />
                )}
              </span>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </td>
        )}
      </tr>
    ),
  };
}

/** The URL fragment that opens the "In System Cards" menu. */
const IN_SYSTEM_CARDS = 'in-system-cards';

/** The number of documents that the results come from. */
function documentCount(results: EvalResultView[]) {
  return new Set(results.flatMap((r) => (r.document ? [r.document.key] : []))).size;
}

/** In place of the runs table: the eval has no runs, and the system cards that report it. */
function NoRuns({ systemCards }: { systemCards: number }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-y-3 text-center text-sm text-slate-500">
      <p>This evaluation has no runs hosted on OpenAudit.</p>
      {systemCards > 0 && (
        <>
          <p>
            It exists in {systemCards} system card{systemCards === 1 ? '' : 's'}.
          </p>
          <HashButton hash={IN_SYSTEM_CARDS} className="bg-sky-700 text-white hover:bg-sky-800">
            View in System Cards
          </HashButton>
        </>
      )}
    </div>
  );
}

/** The samples table of an eval that has no samples on OpenAudit yet. */
function NoSamples() {
  return (
    <Panel title="Evaluation Samples">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-4 py-1.5 font-medium">Sample</th>
            <th className="px-4 py-1.5 text-right font-medium">Result</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={2} className="px-4 py-8 text-center text-slate-400">
              No samples yet.
            </td>
          </tr>
        </tbody>
      </table>
    </Panel>
  );
}

/** The `runAnchor` of each result's model and document: a URL fragment that opens the table. */
function reportedAnchors(results: EvalResultView[]) {
  return [...new Set(results.flatMap((r) => (r.model && r.document ? [runAnchor(r.model.name, r.document.key)] : [])))];
}

function ReportedTable({ results }: { results: EvalResultView[] }) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
        {SHOW_REVIEW_STATUS && (
          <tr>
            <th colSpan={5} className="px-3 pt-2 pb-0.5 text-left font-normal">
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-900">
                An LLM extracted these values from the documents. Values marked &quot;Not reviewed&quot; can be wrong.
              </p>
            </th>
          </tr>
        )}
        <tr>
          <th className="px-3 py-1.5 font-medium">Model</th>
          <th className="px-3 py-1.5 font-medium">As reported</th>
          <th className="px-3 py-1.5 text-right font-medium">Value</th>
          <th className="hidden px-3 py-1.5 font-medium md:table-cell">Settings</th>
          <th className="px-3 py-1.5 font-medium">Source</th>
        </tr>
      </thead>
      <tbody className="isolate divide-y divide-slate-100">
        {results.map((r, i) => {
          const run = r.model && r.document ? runAnchor(r.model.name, r.document.key) : undefined;
          const prev = results[i - 1];
          const first = run && !(prev?.model && prev.document && runAnchor(prev.model.name, prev.document.key) === run);
          return (
            <tr key={r.id} id={first ? run : undefined} data-run={run} className="scroll-mt-10 data-active:bg-sky-100">
              <td className="px-3 py-2 text-slate-800">
                {r.model ? (
                  <Link href={modelPath(r.model)} className="text-sky-800 hover:underline">
                    {r.model.displayName}
                  </Link>
                ) : (
                  r.rawModelName
                )}
              </td>
              <td className="px-3 py-2 text-slate-600">
                {r.rawEvalName}
                <span className="text-slate-400"> · {r.metric}</span>
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap text-slate-800 tabular-nums">
                <ResultValue result={r} />
              </td>
              <td className="hidden px-3 py-2 text-slate-500 md:table-cell">{settingsText(r)}</td>
              <td className="px-3 py-2">
                <span className="flex flex-wrap items-center gap-x-1.5">
                  {r.document && (
                    <a href={r.document.url} className="text-sky-800 hover:underline" rel="nofollow">
                      {r.document.title}
                    </a>
                  )}
                  <Cite
                    page={r.source?.page ?? r.source?.table}
                    pdfPage={r.source?.pdfPage}
                    quote={r.source?.quote}
                    pdf={savedPdf(r.document)}
                  />
                  <ReviewBadge reviewed={r.reviewed} />
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
