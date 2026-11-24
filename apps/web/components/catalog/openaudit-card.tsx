import { INSET_TITLE } from '@/components/box-title';
import { ReviewCardButtons } from '@/components/cards/review-card-buttons';
import { CardText, type Run } from '@/components/catalog/card-text';
import {
  TopicRuns,
  TopicSnippets,
  VersionHistory,
  type SnippetView,
  type SystemResult,
} from '@/components/catalog/openaudit-card-client';
import { OutdatedNote } from '@/components/catalog/outdated-note';
import { Cite, TOPIC_LABELS, TopicLabel, settingsText } from '@/components/catalog/parts';
import { SummaryTabs } from '@/components/catalog/summary-tabs';
import { RunHover, type RunRef, type SnippetRef } from '@/components/evidence-hover';
import { EvidenceMarkdown } from '@/components/evidence-markdown';
import { Fold } from '@/components/fold';
import { InfoPopover } from '@/components/info-popover';
import Link from '@/components/link';
import type { PdfDocument, PdfTarget } from '@/components/pdf-viewer';
import { EVAL_COLUMN_HEIGHT, EvalColumn } from '@/components/runs/model-runs';
import { Section } from '@/components/section';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { monthYear } from '@/lib/card-heading';
import { mergeCards } from '@/lib/merge-cards';
import {
  COVERAGE_LABELS,
  EU_COP_URL,
  LEVELS,
  RISKS,
  isCounted,
  summaryCoversSystemCard,
  type CardSummary,
  type SnippetSeverity,
  type Tone,
} from '@/lib/openaudit-card';
import { runAnchor } from '@/lib/run-anchor';
import { cardsWithResults, evalsByIds, savedPdf, type CardView } from '@/lib/server/catalog';
import { evalAges, evalsTooOld } from '@/lib/server/eval-age';
import type { EvalPlace } from '@/lib/server/eval-ranks';
import type { LatestRun } from '@/lib/server/latest-runs';
import { openAuditPath, type OpenAuditCardView } from '@/lib/server/openaudit-cards';
import { attemptPath, runPath, runnableEvals } from '@/lib/server/runs';
import { snippetTopics } from '@/lib/snippet-topics';
import { HIDDEN_TOPICS } from '@/lib/topics';
import { cn } from '@/lib/utils';
import type { Model, Topic, TopicCoverage } from '@openaudit/spec';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { type ReactNode } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
const TONE: Record<Tone, [string, string]> = {
  good: ['bg-emerald-600', 'Good for safety'],
  mixed: ['bg-orange-500', 'Mixed or a mild concern'],
  bad: ['bg-red-600', 'A clear concern'],
  neutral: ['bg-slate-300', 'Neutral'],
};

/** The "Version History" menu of a model's OpenAudit, below the mode switch. */
export function CardVersionHistory({ model, card }: { model: Pick<Model, 'name'>; card: OpenAuditCardView }) {
  return (
    <VersionHistory
      path={openAuditPath(model)}
      current={card.version.number}
      latest={card.latest}
      versions={card.versions.map((v) => ({
        number: v.number,
        status: v.status,
        date: day(v.createdAt),
        aggregator: v.aggregator,
      }))}
    />
  );
}

/** A model's OpenAudit on its model page, with a notice on a version that is not the newest
 * published (and on a draft, for admins). Nothing when there is no `card`. */
/** A topic as the model's system cards state it. */
export type SystemTopic = Pick<TopicCoverage, 'covered' | 'headline' | 'source'> & {
  pdf?: PdfDocument;
  run: Run;
  /** The card's month, when the model has more than one system card. */
  tag?: string;
  /** The results of the cards' evals that test the topic (evals in our registry only). */
  results: SystemResult[];
};

type EvalTopics = Map<string, { displayName: string; topics: Topic[] }>;

/** Each topic of the model's system cards (newest first). The newest card that covers a topic wins.
 * `evals`: the topics of the results' evals. */
export function systemTopics(
  model: Pick<Model, 'name'>,
  sources: CardView[],
  evals: EvalTopics = new Map(),
): Partial<Record<Topic, SystemTopic>> {
  const merged = mergeCards(sources);
  const out: Partial<Record<Topic, SystemTopic>> = Object.fromEntries(
    merged.topics.map(({ from, topic, ...t }) => {
      const doc = sources[from].document;
      return [
        topic,
        {
          ...t,
          pdf: savedPdf(doc),
          run: { anchor: runAnchor(model.name, doc.key), slugs: [] },
          ...(sources.length > 1 && { tag: monthYear(doc.publishedDate) }),
          results: [],
        },
      ];
    }),
  );
  for (const r of merged.results) {
    const e = r.evalId ? evals.get(r.evalId as string) : undefined;
    for (const topic of e?.topics ?? []) {
      const doc = sources[r.from].document;
      out[topic] ??= { covered: false, run: { anchor: runAnchor(model.name, doc.key), slugs: [] }, results: [] };
      out[topic].results.push({
        name: r.rawEvalName ?? e!.displayName,
        details: settingsText(r) || undefined,
        result: {
          metric: r.metric,
          value: r.value,
          unit: r.unit,
          stderr: r.stderr,
          safetyDirection: r.safetyDirection,
        },
        pdf: savedPdf(doc),
        source: { page: r.source?.page ?? r.source?.table, pdfPage: r.source?.pdfPage, quote: r.source?.quote },
      });
    }
  }
  return out;
}

/** `systemCards`: the model's system cards, newest first. Each topic shows what they state, and
 * their results of evals on the topic. `notice`: first, with no `card`.
 * `incidents`: a row below the executive summary. `deploymeter`: the first column of the executive
 * summary, when it has columns. `evaluations`: the Evaluations section, given the topics column
 * and the executive summary. `places`: by eval id, the model's place among the models. */
export async function ModelOpenAudit({
  model,
  card,
  developer,
  systemCards = [],
  incidents,
  deploymeter,
  evaluations,
  places,
  notice,
}: {
  model: Pick<Model, 'id' | 'name' | 'displayName' | 'parentRelation' | 'parentId' | 'source' | 'facts'>;
  card: OpenAuditCardView | null;
  developer?: string;
  systemCards?: CardView[];
  incidents?: ReactNode;
  deploymeter?: ReactNode;
  evaluations?: (topics?: ReactNode, summary?: ReactNode) => ReactNode;
  places?: Record<string, EvalPlace>;
  notice?: ReactNode;
}) {
  if (!card && !systemCards.length)
    return (
      <>
        {notice}
        {evaluations?.()}
      </>
    );
  if (!card)
    return (
      <>
        {notice}
        {incidents}
        {evaluations?.()}
      </>
    );
  const sources = systemCards.length ? await cardsWithResults(model, systemCards) : [];
  const evalIds = [
    ...new Set(sources.flatMap((c) => c.results.flatMap((r) => (r.evalId ? [r.evalId as string] : [])))),
  ];
  const [evals, runnable, [age]] = await Promise.all([
    evalIds.length ? evalsByIds(evalIds) : new Map(),
    runnableEvals(),
    evalAges([model]),
  ]);
  const evalTopics = [...new Set(runnable.filter((e) => e.status === 'active').flatMap((e) => e.topics))];
  return (
    <OpenAuditCardBody
      card={card}
      developer={developer}
      system={sources.length ? systemTopics(model, sources, evals) : undefined}
      evalTopics={evalTopics}
      incidents={incidents}
      deploymeter={deploymeter}
      evaluations={evaluations}
      places={places}
      outdated={age && evalsTooOld(age) ? age : undefined}
    />
  );
}

/** At the top of the model page: a notice when the shown version is not the latest published one. */
export function CardVersionNotice({
  model,
  card,
}: {
  model: Pick<Model, 'name' | 'displayName'>;
  card: OpenAuditCardView;
}) {
  const status = card.version.status;
  return (
    <>
      {status === 'published' && card.latest && card.version.number !== card.latest && (
        <div className="flex flex-col items-start gap-y-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>
            You&apos;re viewing version {card.version.number} of this OpenAudit, from {day(card.version.createdAt)}. It
            is not the latest version.
          </p>
          <Button size="sm" asChild className="bg-sky-700 text-white hover:bg-sky-800">
            <Link href={openAuditPath(model)}>View Latest Version (V{card.latest})</Link>
          </Button>
        </div>
      )}
      {status !== 'published' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>
            {status === 'draft'
              ? `Draft: only admins see version ${card.version.number}. `
              : `Discarded: only admins see version ${card.version.number}. `}
            {card.latest ? `The public sees version ${card.latest}.` : 'The public sees no OpenAudit.'}
          </p>
          {status === 'draft' && (
            <ReviewCardButtons versionId={card.version.id} label={`${model.displayName} v${card.version.number}`} />
          )}
        </div>
      )}
    </>
  );
}

/** What the system cards state on a topic, if they cover it. The text opens the cited page of the PDF. */
function SystemTopicPart({ topic: t }: { topic?: SystemTopic }) {
  if (!t?.covered) return null;
  return (
    <div className="relative -mx-1 rounded px-1 text-xs hover:bg-sky-50">
      <Cite
        pdf={t.pdf}
        page={t.source?.page}
        pdfPage={t.source?.pdfPage}
        quote={t.source?.quote}
        className="text-slate-700"
        stretch
      >
        {t.headline ? (
          <CardText text={t.headline} run={t.run} />
        ) : (
          <span className="text-slate-500 italic">{t.source?.quote ?? 'Covered'}</span>
        )}
      </Cite>
      {t.tag && <span className="ml-1.5 text-[11px] whitespace-nowrap text-slate-400">{t.tag}</span>}
    </div>
  );
}

function day(d: Date) {
  return d.toISOString().slice(0, 10);
}

type Summary = Exclude<CardSummary, string>;

// The runner also writes `strengths`; the page does not show them for now.
const SUMMARY_PARTS = [
  {
    key: 'concerns',
    title: 'Findings',
    about: () =>
      'The clearest safety and alignment problems that our evals found, worst first. Hover a link to see the case or the run.',
    empty: () => 'No clear concern.',
  },
  {
    key: 'systemCardAudit',
    title: 'Self Evaluation Audit',
    about: (developer?: string) =>
      `This compares the safety claims in ${developer ? `${developer}'s` : "the developer's"} own system card with what our independent evaluations found, and shows notable differences. A system card is a report that a developer publishes with a model: what the model can do, how the developer tested it for safety, and which risks it found.`,
    empty: (s: Summary) =>
      !s.compared
        ? 'Not compared yet.'
        : s.compared.length
          ? 'The OpenAudit evals did not reveal significant differences with the system card evals. This could possibly be due to lack of system card evals.'
          : 'No system card to compare.',
  },
  {
    key: 'unknowns',
    title: 'Unknown',
    about: () => 'What we cannot say yet: risks and topics that no eval covers, or that have only weak evidence.',
    empty: () => 'Nothing.',
  },
] as const;

/** Summary parts and sections that are hidden for now. */
const HIDDEN_PARTS: readonly string[] = ['systemCardAudit'];
const SHOW_FRAMEWORKS = false;

const MINOR_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'but',
  'by',
  'for',
  'in',
  'nor',
  'of',
  'on',
  'or',
  'the',
  'to',
  'vs',
  'with',
]);

/** The item with its bold label in title case: "**Shutdown evasion:**" gives "**Shutdown Evasion:**". */
export function titleLabel(item: string) {
  return item.replace(/^\*\*([^*]+)\*\*/, (_, label: string) => {
    const words = label
      .split(' ')
      .map((w, i) =>
        i > 0 && MINOR_WORDS.has(w.toLowerCase())
          ? w.toLowerCase()
          : w.replace(/(^|-)(\p{Ll})/gu, (_m, dash: string, c: string) => dash + c.toUpperCase()),
      );
    return `**${words.join(' ')}**`;
  });
}

/** The executive summary in two columns: `lead`, then the parts in one box with a toggle (see
 * `SummaryTabs`). On small screens they stack. Items link to their evidence. `incidents`: a
 * second row below the parts; then `lead` is in the first row only. */
function SummaryColumns({
  summary,
  snippets,
  runs,
  cites,
  developer,
  lead,
  incidents,
}: {
  summary: Summary;
  snippets: Map<string, SnippetRef>;
  runs: Map<string, RunRef>;
  cites: Map<string, PdfTarget>;
  developer?: string;
  lead?: ReactNode;
  incidents?: ReactNode;
}) {
  const parts = SUMMARY_PARTS.filter((p) => !HIDDEN_PARTS.includes(p.key)).map((p) => {
    const items = summary[p.key] ?? [];
    return {
      key: p.key,
      title: p.title,
      about: p.about(developer),
      body: items.length ? (
        <ul className="flex flex-col gap-y-2 text-xs leading-[1.125rem] font-medium text-slate-700 [&_strong]:font-bold [&_strong]:text-slate-900">
          {items.map((t, i) => (
            <li key={i} className="flex gap-x-1">
              <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden />
              <span>
                <EvidenceMarkdown text={titleLabel(t)} snippets={snippets} runs={runs} cites={cites} inline />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs font-medium text-slate-600">{p.empty(summary)}</p>
      ),
    };
  });
  return (
    <div className={cn('grid gap-3', lead && 'md:grid-cols-2')}>
      {lead}
      <SummaryTabs parts={parts} />
      {incidents && <div className={cn('min-w-0', lead && 'md:col-start-2')}>{incidents}</div>}
    </div>
  );
}

const TOPICS_INFO =
  "The safety topics of the system card pages, but not bias, the most severe first, then the most high or mid severity flagged chats, then the most low ones. For each: the flagged chats, and the eval runs (ours, then the system card evals as unverified runs); then what our runs show, and what the system card states. The dot is the LLM's reading of the OpenAudit runs for safety, from active evals only: red is a clear concern, orange is mixed or a mild concern, grey is neutral, too weak to judge, or no run covers the topic, green is good.";

const TONE_RANK: Record<Tone, number> = { bad: 0, mixed: 1, neutral: 2, good: 3 };
/** Red, then orange, then grey (or no tone), then green. */
const toneRank = (tone?: Tone | null) => (tone ? TONE_RANK[tone] : TONE_RANK.neutral);

function ToneDot({ tone, className }: { tone: Tone; className?: string }) {
  const [color, label] = TONE[tone];
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn('size-2 shrink-0 rounded-full', color, className)}
    />
  );
}

/** Markdown at the size of its parent, as on the system card page. */
function Text({ children }: { children: string }) {
  return (
    <div className="[&_a]:text-sky-800 [&_a]:hover:underline [&_p]:my-0">
      <Markdown remarkPlugins={[remarkGfm]}>{children}</Markdown>
    </div>
  );
}

/** A run as its hover link shows it, with the model's place from `places` when it is of this run. */
function runRef(r: LatestRun, places: Record<string, EvalPlace> = {}): RunRef {
  const place = places[r.run.evalId];
  return {
    place: place?.href === runPath(r.run) ? { rank: place.rank, of: place.of } : undefined,
    href: runPath(r.run),
    evalName: r.eval.displayName,
    evalSlug: r.eval.slug,
    evalStatus: r.eval.status,
    date: day(new Date(r.run.createdAt)),
    samples: r.run.attemptCount,
    limited: r.limited,
    result: r.result && {
      metric: r.result.metric,
      value: r.result.value,
      unit: r.result.unit,
      stderr: r.result.stderr,
      safetyDirection: r.result.safetyDirection,
      range: r.result.range,
    },
  };
}

/** Links to the runs a statement rests on, by eval name. On hover: the run's result; on click: the
 * run in the side panel. */
function RunRefs({ ids, runs }: { ids: string[]; runs: Map<string, LatestRun> }) {
  const known = ids.flatMap((id) => {
    const r = runs.get(id);
    return r ? [r] : [];
  });
  if (!known.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {known.map((r) => (
        <RunHover
          key={r.run.id}
          run={runRef(r)}
          className="rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10.5px]/[14px] text-sky-800 hover:border-sky-700"
        >
          {r.eval.displayName}
        </RunHover>
      ))}
    </span>
  );
}

const TOPIC_HEAD = 'flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5';

/** At the right of a topic's title: its flagged chats, then its eval runs and system card results. */
function TopicEvidence({
  topic,
  snippets,
  runs,
  results,
  noEvals,
}: {
  topic: Topic;
  snippets: SnippetView[];
  runs: RunRef[];
  results: SystemResult[];
  noEvals?: boolean;
}) {
  return (
    <div className="grid shrink-0 grid-cols-[4.75rem_3.5rem] gap-1.5">
      <TopicSnippets snippets={snippets} topic={topic} />
      <TopicRuns topic={topic} runs={runs} results={results} noEvals={noEvals} />
    </div>
  );
}

const views = new WeakMap<OpenAuditCardView, SnippetView[]>();

/** A card version's flagged chats, as the page shows them. The same objects for the same card: the
 * page then sends each chat to the browser once, not once for each part that shows it. */
export function snippetViews(card: OpenAuditCardView): SnippetView[] {
  const hit = views.get(card);
  if (hit) return hit;
  const runDates = new Map(card.runs.map((r) => [r.run.id, new Date(r.run.createdAt).toISOString()]));
  const out = card.snippets.map((s) => ({
    id: s.id,
    href: attemptPath({ id: s.runId }, s.ordinal),
    evalName: s.eval.displayName,
    ordinal: s.ordinal,
    sample: s.sample,
    category: s.category,
    topics: snippetTopics(s.category, s.eval.topics),
    severity: s.severity as SnippetSeverity,
    title: s.title,
    reason: s.reason,
    locked: s.locked,
    date: runDates.get(s.runId),
    tokens: s.tokens,
  }));
  views.set(card, out);
  return out;
}

/** `system`: each topic as the system cards state it. With none, the topics show only our runs.
 * `evalTopics`: the topics of the active evals we can run. `incidents`: a row below the summary.
 * `evaluations`: the Evaluations section, given the topics column and the executive summary; the
 * notable findings then follow it. `places`: by eval id, the model's place among the models.
 * `outdated`: the eval counts when the model came out after most of our evals (`evalsTooOld`); a
 * rose bar under the summary title says so. */
export function OpenAuditCardBody({
  card,
  developer,
  system,
  evalTopics,
  incidents,
  deploymeter,
  evaluations,
  places,
  outdated,
}: {
  card: OpenAuditCardView;
  developer?: string;
  system?: Partial<Record<Topic, SystemTopic>>;
  evalTopics?: Topic[];
  incidents?: ReactNode;
  deploymeter?: ReactNode;
  evaluations?: (topics: ReactNode, summary?: ReactNode) => ReactNode;
  places?: Record<string, EvalPlace>;
  outdated?: { evals: number; older: number };
}) {
  const { version } = card;
  const runs = new Map(card.runs.map((r) => [r.run.id, r]));
  const snippets = snippetViews(card);
  const verdicts = new Map(version.verdicts.map((v) => [v.risk, v]));
  const toned = version.topics.some((t) => t.tone);
  const oneText = summaryCoversSystemCard(version.promptVersion);
  const snippetRefs = new Map(snippets.map((s) => [s.id, s]));
  const runRefs = new Map(card.runs.map((r) => [r.run.id, runRef(r, places)]));
  const frameworksInfo = (
    <>
      The systemic risks of the{' '}
      <a href={EU_COP_URL} className="text-sky-800 underline">
        EU General-Purpose AI Code of Practice
      </a>{' '}
      (Safety and Security chapter). Each verdict says which runs it rests on and what no run covers. Levels:{' '}
      {Object.values(LEVELS)
        .map((l) => `${l.label}: ${l.text}`)
        .join(' ')}
    </>
  );
  const verdictList = (
    <>
      <div className="-mb-0.5 flex flex-col gap-y-1 rounded-md bg-slate-50 px-3 py-2 text-xs">
        <span className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Framework</span>
        <a href={EU_COP_URL} className="font-medium text-sky-800 hover:underline">
          EU General-Purpose AI Code of Practice
        </a>
        <span className="text-slate-500">Our verdicts from independent runs, not a check of legal compliance.</span>
      </div>
      <ul className="flex flex-col text-[13px]/[18px]">
        {RISKS.map((risk) => {
          const v = verdicts.get(risk.key);
          const level = LEVELS[v?.level ?? 'not_enough_evidence'];
          return (
            <li key={risk.key} className="flex flex-col gap-y-1 rounded-md px-2 py-2 transition-colors hover:bg-sky-50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium text-slate-800" title={risk.text}>
                  {risk.name}
                </h3>
                <span
                  className={cn('rounded border px-1.5 py-0.5 text-[11px]/none', level.className)}
                  title={level.text}
                >
                  {level.label}
                </span>
              </div>
              {v ? (
                <>
                  <span className="text-[11px] text-slate-500">{COVERAGE_LABELS[v.coverage]}</span>
                  <div className="text-slate-700">
                    <Text>{v.summary}</Text>
                  </div>
                  <p className="text-xs text-slate-500">
                    <span className="font-medium text-slate-600">Not covered: </span>
                    {v.missing}
                  </p>
                  <RunRefs ids={v.runIds} runs={runs} />
                </>
              ) : (
                <p className="text-slate-500">No verdict in this version.</p>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
  const frameworks = (
    <Popover>
      <PopoverTrigger className="flex items-center gap-x-1 text-xs font-medium text-slate-600 hover:text-sky-800 [&[data-state=open]>svg]:rotate-180">
        Safety Frameworks
        <ChevronDown className="size-3.5 transition-transform" aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="flex max-h-[70vh] w-[28rem] max-w-[calc(100vw-2rem)] flex-col gap-2 overflow-y-auto"
      >
        <p className="flex items-center gap-x-1.5 text-sm font-semibold text-slate-800">
          Safety Framework Verdicts
          <InfoPopover label="Safety Framework Verdicts">{frameworksInfo}</InfoPopover>
        </p>
        {verdictList}
      </PopoverContent>
    </Popover>
  );

  const flagged = (topic: string, counted: boolean) =>
    snippets.filter((s) => isCounted(s) === counted && s.topics.includes(topic)).length;
  const topicList = (
    <div className="@container p-1">
      <ul className="grid grid-cols-1 gap-x-1 gap-y-0.5 text-sm @2xl:grid-cols-2 @5xl:grid-cols-3">
        {version.topics
          .filter((t) => !HIDDEN_TOPICS.includes(t.topic))
          .sort(
            (a, b) =>
              toneRank(a.tone) - toneRank(b.tone) ||
              flagged(b.topic, true) - flagged(a.topic, true) ||
              flagged(b.topic, false) - flagged(a.topic, false) ||
              (TOPIC_LABELS[a.topic as Topic] ?? a.topic).localeCompare(TOPIC_LABELS[b.topic as Topic] ?? b.topic),
          )
          .map((t) => (
            <li key={t.topic} className="flex min-w-0 flex-col gap-y-1.5 rounded-xl px-3 py-2.5">
              <div className={TOPIC_HEAD}>
                <div className="flex min-w-0 items-center gap-x-2">
                  {toned &&
                    (t.tone ? (
                      <ToneDot tone={t.tone} />
                    ) : (
                      <span
                        role="img"
                        aria-label="Not covered"
                        title="Not covered"
                        className={cn(
                          'size-2 shrink-0 rounded-full',
                          t.coverage === 'none' ? 'bg-slate-300' : 'border border-slate-300',
                        )}
                      />
                    ))}
                  <TopicLabel topic={t.topic as Topic} className="text-[13px]" />
                </div>
                <TopicEvidence
                  topic={t.topic as Topic}
                  snippets={snippets.filter((s) => s.topics.includes(t.topic))}
                  runs={t.runIds.flatMap((id) => runRefs.get(id) ?? [])}
                  results={system?.[t.topic as Topic]?.results ?? []}
                  noEvals={evalTopics && !evalTopics.includes(t.topic as Topic)}
                />
              </div>
              <div className={cn('flex min-w-0 flex-col gap-y-1.5', toned && 'pl-4')}>
                {t.summary && (
                  <div className="text-xs text-slate-700">
                    <Text>{t.summary}</Text>
                  </div>
                )}
                {system && !oneText && <SystemTopicPart topic={system[t.topic as Topic]} />}
              </div>
            </li>
          ))}
      </ul>
    </div>
  );

  const summary = version.summary ? (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex min-h-10 shrink-0 items-center gap-x-1 bg-slate-50 px-4 py-2">
        <h2 className={INSET_TITLE}>Audit Summary</h2>
        {SHOW_FRAMEWORKS && <div className="ml-auto">{frameworks}</div>}
      </div>
      {outdated && (
        <OutdatedNote>
          {outdated.older} of {outdated.evals} evaluations were older than this model, so positive results are not
          reliable.
        </OutdatedNote>
      )}
      <div className="flex flex-col gap-2 p-3 sm:p-4">
        {typeof version.summary === 'string' ? (
          <div className="markdown text-sm text-slate-700">
            <Markdown remarkPlugins={[remarkGfm]}>{version.summary}</Markdown>
          </div>
        ) : (
          <SummaryColumns
            summary={version.summary}
            snippets={snippetRefs}
            runs={runRefs}
            cites={new Map(Object.entries(card.cites))}
            developer={developer}
            lead={deploymeter}
            incidents={incidents}
          />
        )}
        {typeof version.summary === 'string' && incidents}
      </div>
    </section>
  ) : (
    <>
      {incidents}
      {SHOW_FRAMEWORKS && (
        <Section title="Safety Frameworks" info={frameworksInfo}>
          {verdictList}
        </Section>
      )}
    </>
  );
  const findings = version.findings.length > 0 && (
    <Section
      title="Notable Findings"
      info="The results and behaviors that matter most for safety, from the runs on this page. The dot is the LLM's reading for safety: green is good, orange is mixed or a mild concern, red is a clear concern, grey is neutral."
    >
      <div className="@container">
        <ul className="grid grid-cols-1 text-[13px] text-slate-700 @3xl:grid-cols-2 @3xl:gap-x-4">
          {version.findings.map((f, i) => (
            <li key={i} className="flex gap-x-2 rounded-md px-2 py-2 transition-colors hover:bg-sky-50">
              <ToneDot tone={f.tone} className="mt-1.5" />
              <div className="flex min-w-0 flex-col gap-y-1">
                <Text>{f.text}</Text>
                <RunRefs ids={f.runIds} runs={runs} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );

  return evaluations ? (
    <>
      {evaluations(
        <Fold more="Show more topics">
          <EvalColumn title="Evaluation Topics" info={TOPICS_INFO} className={EVAL_COLUMN_HEIGHT}>
            {topicList}
          </EvalColumn>
        </Fold>,
        summary,
      )}
      {findings}
    </>
  ) : (
    <>
      {summary}
      {findings}
      <Section title="Topics" info={TOPICS_INFO}>
        {topicList}
      </Section>
    </>
  );
}
