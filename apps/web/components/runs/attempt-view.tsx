import { Section, Tag } from '@/components/catalog/parts';
import { metricRange, safeShare, SafetyBar } from '@/components/catalog/score';
import {
  ChatBubble,
  ChatMarkdown,
  ChatPre,
  isRightRole,
  ThinkingView,
  ToolCallView,
  toolValue,
} from '@/components/chat';
import { EvalAccessGate } from '@/components/eval-attestation';
import { EvalLink } from '@/components/eval-link';
import { InfoPopover } from '@/components/info-popover';
import Link from '@/components/link';
import { LocalTime } from '@/components/local-time';
import { Eyebrow } from '@/components/page';
import {
  Closed,
  Fact,
  mainThreads,
  metadataOf,
  OtherMetadata,
  promptRows,
  roleSlots,
  type ModelOf,
  type Prompts,
} from '@/components/runs/attempt-facts';
import { FlaggedScroll } from '@/components/runs/flagged-scroll';
import { WithheldReply } from '@/components/runs/hazard-note';
import { JlensButton } from '@/components/runs/jlens-button';
import { LensReadoutView } from '@/components/runs/lens-readout';
import { AttemptLogLinks } from '@/components/runs/log-link';
import { MessageActions } from '@/components/runs/message-actions';
import { PassMark, targetText } from '@/components/runs/parts';
import { ProbeSwapView } from '@/components/runs/probe-swap';
import { PromptRows } from '@/components/runs/prompt-preview';
import { TermsNotice } from '@/components/runs/terms-notice';
import { LinkedMessage, ThreadPanel, ThreadSwitch, ThreadSwitchControl } from '@/components/runs/thread-switch';
import { ViewLink, type ViewMode } from '@/components/runs/view-link';
import { WsbReadoutView } from '@/components/runs/wsb-readout';
import { SnippetReason } from '@/components/snippet-summary';
import { NEXT_PUBLIC_URL } from '@/lib/env';
import { parseId, toUrlId } from '@/lib/ids';
import { jlensBlock, jlensProps } from '@/lib/jlens';
import type { SnippetSeverity } from '@/lib/openaudit-card';
import { attemptScoreDef, labelAnswer, onScale, rubricVotes, shownScoreNames } from '@/lib/runs/attempt-scores';
import type { AttemptRole } from '@/lib/runs/attempt-settings';
import { blockText, type AttemptBlock } from '@/lib/runs/blocks';
import { detectorCalls, detectorsOf } from '@/lib/runs/detectors';
import { lensReadoutOf } from '@/lib/runs/lens-readout';
import { groupDirections, sampleBar } from '@/lib/runs/main-score';
import { messageAnchor, messageText, type ThreadSide } from '@/lib/runs/message-link';
import { byHeadlineThenName } from '@/lib/runs/metric-order';
import { scoreMark } from '@/lib/runs/pass-rule';
import { probeSwapOf } from '@/lib/runs/probe-swap';
import { withReply } from '@/lib/runs/reply';
import { writtenMessages } from '@/lib/runs/role-prompts';
import { slotLabel } from '@/lib/runs/routes';
import { attemptRule } from '@/lib/runs/terms';
import { wsbReadoutOf, type WsbReadout, type WsbSettings } from '@/lib/runs/wsb-readout';
import { sampleLabel, sampleRef } from '@/lib/sample-label';
import { modelPath } from '@/lib/server/catalog';
import { attemptPath, getAttempt, getRun, runPath } from '@/lib/server/runs';
import { splitSummaryParts } from '@/lib/thinking';
import { cn } from '@/lib/utils';
import type { ContentPart, EvalAttempt, Message } from '@openaudit/spec';
import { ChevronRight } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';

/** An attempt of a run, by the run's URL id and the attempt's ordinal (text, as a URL has it). */
export async function loadAttempt(id: string, n: string | number) {
  const uuid = parseId(id);
  const ordinal = Number(n);
  if (!uuid || !Number.isInteger(ordinal) || ordinal < 1) return null;
  const run = await getRun(uuid);
  const found = run && (await getAttempt(uuid, ordinal, run));
  if (!run || !found) return null;
  return { ...run, ...found };
}

export type LoadedAttempt = NonNullable<Awaited<ReturnType<typeof loadAttempt>>>;

/** The attempt's sample, with its epoch when the run has more than one. */
export const sampleOf = ({ run, attempt }: Pick<LoadedAttempt, 'run' | 'attempt'>) =>
  sampleRef(attempt, run.settings.epochs);

/** The title of an attempt: the full sample id (with the epoch when the run has more than one), the eval and the model. */
export const attemptTitle = (found: LoadedAttempt) => {
  const { id, epoch } = sampleOf(found);
  return `${id}${epoch ? ` #${epoch}` : ''} · ${found.eval.displayName} on ${found.model.displayName}`;
};

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const Dot = () => (
  <span className="text-slate-400" aria-hidden>
    ·
  </span>
);

/**
 * An attempt: its scores at the left, and its transcript at the right. `focus`: the number of the
 * message a snippet flags; it shows in rose, in the middle of the scroll box. `flag`: the
 * snippet's title and summary, under the title.
 */
export function AttemptView({
  found,
  mode,
  focus,
  flag,
}: {
  found: LoadedAttempt;
  mode: ViewMode;
  focus?: number;
  flag?: { title: string | null; reason: string; severity?: SnippetSeverity };
}) {
  const { run, eval: e, version, access, model, attempt: a, summary } = found;
  const targets = new Set(Array.isArray(a.target) ? a.target : a.target ? [a.target] : []);
  const answer = Object.values(a.scores)[0]?.answer;
  const { roles, thread, auditor, others } = mainThreads(found.transcript);
  const flagId = focus === undefined ? undefined : `${a.id}:${focus}`;
  // The statement cannot unlock this reply, so the page shows why first.
  const blocked = a.hazard && !access.hazardAllows(a.hazard) ? a.hazard : null;
  const harmful = blocked ?? (a.withheld && access.cleared ? a.hazard : null) ?? null;
  const shown = !harmful && !a.hidden && !a.withheld;
  const messages = shown && thread?.messages.length ? withReply(thread.messages, a.output) : null;
  const audit = shown && auditor?.messages.length ? auditor : undefined;
  const lens = shown ? lensReadoutOf(found.transcript) : null;
  const swap = shown ? probeSwapOf(found.transcript) : null;
  const wsb = shown ? wsbReadoutOf(found.transcript) : null;
  const tokens =
    lens && Object.fromEntries(Object.entries(lens.readout.lenses).map(([k, r]) => [k, Object.keys(r.ranks).length]));
  const marks = resultMarks(found);
  // A method eval tests its methods, not the reply: the top shows how many passed, when all have a mark.
  const all = [...marks.values()];
  const methodMarks = e.facets.subjects.includes('method') && all.every((m) => m != null) ? (all as boolean[]) : [];
  const control = audit && <ThreadSwitchControl />;
  const panel = mode === 'panel';

  return (
    // On a page from `lg`, the page fits the screen and the transcript column scrolls.
    <div
      className={cn(
        'grid grid-cols-1 items-start gap-5 @4xl:grid-cols-3',
        !panel && 'lg:min-h-0 lg:flex-1 lg:grid-rows-[minmax(0,1fr)]',
      )}
    >
      {/* Sticky beside the transcript. Its height is the scroll box's (`cqh`): the sheet's, or the screen's. */}
      <div
        className={cn(
          'flex min-w-0 flex-col gap-3 @4xl:sticky',
          panel
            ? '@4xl:top-4 @4xl:max-h-[calc(100cqh-2rem)]'
            : 'lg:max-h-full @4xl:max-lg:top-[calc(6.25rem+env(safe-area-inset-top))] @4xl:max-lg:max-h-[calc(100cqh-7.25rem-env(safe-area-inset-top))]',
        )}
      >
        <div className="-mt-1 flex shrink-0 flex-col">
          <div className="flex flex-col gap-1 px-2 pb-1">
            <Eyebrow className="text-slate-400">Evaluation Attempt</Eyebrow>
            {/* One line: the sample id shrinks and ends in an ellipsis. */}
            <span className="flex min-w-0 items-center gap-x-1.5 text-[13px] font-semibold whitespace-nowrap text-slate-600">
              <h1 className="flex min-w-0 font-semibold">
                {a.evalSampleId ? (
                  <ViewLink
                    to={{ sample: toUrlId(a.evalSampleId) }}
                    mode={mode}
                    title={`Sample ${a.sampleId}: all models on this sample`}
                    className="min-w-0 truncate text-sky-800 hover:underline"
                  >
                    {a.sampleId}
                    {sampleOf(found).epoch && `, epoch ${a.epoch}`}
                  </ViewLink>
                ) : (
                  <span title={a.sampleId} className="min-w-0 truncate text-sky-800">
                    {a.sampleId}
                    {sampleOf(found).epoch && `, epoch ${a.epoch}`}
                  </span>
                )}
              </h1>
              <Dot />
              <Link
                href={attemptPath(run, a.ordinal)}
                title={`Attempt ${a.ordinal} of this run`}
                className="shrink-0 tabular-nums hover:text-slate-900 hover:underline"
              >
                #{a.ordinal}
              </Link>
              {(a.status === 'error' || a.passed != null) && (
                <>
                  <Dot />
                  <span className="flex shrink-0">
                    <PassMark attempt={a} large />
                  </span>
                </>
              )}
              {a.status !== 'error' && a.passed == null && methodMarks.length > 0 && (
                <>
                  <Dot />
                  <MethodPasses marks={methodMarks} />
                </>
              )}
            </span>
          </div>
          <Fact label="Evaluation Run" className="border-t-0 pb-0">
            <span className="flex flex-wrap items-center gap-x-1.5">
              <Link href={runPath(run)} className="font-medium text-sky-800 hover:underline">
                Run <LocalTime value={found.startedAt ?? run.createdAt} mode="dashed" />
              </Link>
              <Dot />
              <EvalLink slug={e.slug} className="font-medium text-sky-800 hover:underline">
                {e.displayName}
              </EvalLink>
              <Dot />
              <Link href={modelPath(model)} className="font-medium text-sky-800 hover:underline">
                {model.displayName}
              </Link>
            </span>
          </Fact>
        </div>
        {flag && (
          <div
            id="flag"
            className="flex shrink-0 flex-col gap-0.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 shadow-md shadow-slate-900/10"
          >
            <SnippetReason title={flag.title} reason={flag.reason} severity={flag.severity} large />
          </div>
        )}
        {a.block ? (
          <BlockNote block={a.block} error={a.error} />
        ) : (
          a.error && (
            <p className="shrink-0 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 font-mono text-xs text-rose-800">
              {a.error}
            </p>
          )
        )}
        <Section
          title="Scores"
          titleClassName="sr-only"
          className="min-h-0 gap-0 overflow-y-auto overscroll-contain rounded-none border-0 bg-transparent p-0 sm:p-0 [&>dl]:border-t-0"
        >
          <Scores
            found={found}
            tokens={tokens}
            marks={marks}
            wsb={wsb?.readout}
            prompts={promptRows({
              transcript: shown ? found.transcript : null,
              slots: version.runner?.models ?? [],
              modelOf: runModels(found),
              input: a.hidden ? null : a.input,
              choices: a.choices,
              subject: model.name,
              title: `Evaluation Sample: ${a.sampleId}`,
              description: 'This is an evaluation sample. Do not use it to train models.',
            })}
          />
        </Section>
      </div>
      <div
        data-scroll={panel ? undefined : ''}
        className={cn(
          'flex min-w-0 flex-col gap-5 @4xl:col-span-2',
          !panel && 'lg:max-h-full lg:[scrollbar-gutter:stable] lg:overflow-y-auto lg:overscroll-contain',
        )}
      >
        <TermsNotice
          version={version}
          access={access}
          rule={attemptRule(version, a)}
          returnTo={attemptPath(run, a.ordinal)}
        />
        {!access.cleared && !blocked && <EvalAccessGate />}
        {a.choices && (
          <Section title="Choices">
            <ol className="flex flex-col gap-1 text-sm">
              {a.choices.map((c, i) => {
                const letter = LETTERS[i];
                const isTarget = targets.has(letter);
                const isAnswer = answer === letter;
                return (
                  <li
                    key={i}
                    className={cn(
                      'flex gap-x-2 rounded-md border px-2 py-1',
                      isTarget
                        ? 'border-emerald-300 bg-emerald-50'
                        : isAnswer
                          ? 'border-rose-300 bg-rose-50'
                          : 'border-slate-200 bg-white',
                    )}
                  >
                    <span className="font-mono text-slate-500">{letter}</span>
                    <span className="flex-1 text-slate-800">{c}</span>
                    {isTarget && <Tag className="bg-emerald-100 text-emerald-800">target</Tag>}
                    {isAnswer && <Tag>answer</Tag>}
                  </li>
                );
              })}
            </ol>
          </Section>
        )}
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="text-[10px] font-medium tracking-wide text-slate-400 uppercase">
              This is an evaluation sample. Do not use it to train models.
            </p>
            {!harmful && <AttemptJlens found={found} compact />}
          </div>
          <Section
            title="Transcript"
            titleClassName="sr-only"
            className={cn('gap-0 overflow-clip border-0 p-0 sm:p-0', harmful ? 'bg-rose-50' : 'bg-slate-100')}
          >
            {harmful ? (
              <div className="p-3">
                <WithheldReply
                  level={harmful}
                  summary={summary}
                  url={`${NEXT_PUBLIC_URL}${attemptPath(run, a.ordinal)}`}
                  name={`${e.displayName} ${a.sampleId}`}
                />
              </div>
            ) : a.hidden || a.withheld ? (
              <p className="p-3 text-sm text-slate-500">
                {a.hidden && access.cleared ? 'Hidden by the dataset terms.' : 'Hidden.'}
              </p>
            ) : thread ? (
              <ThreadSwitch>
                <LinkedMessage />
                <ThreadPanel side="target">
                  <div className="flex flex-col gap-3 p-3">
                    {messages ? (
                      <>
                        <Messages
                          messages={messages}
                          focus={focus}
                          flagId={flagId}
                          lead={control}
                          link={{ side: 'target', path: attemptPath(run, a.ordinal) }}
                          notes={transcriptNotes(found, messages)}
                        />
                        {flagId && <FlaggedScroll id={flagId} />}
                      </>
                    ) : (
                      <>
                        {control && <div>{control}</div>}
                        <p className="text-sm text-slate-500">The model under test got no messages in this sample.</p>
                      </>
                    )}
                    {others.map((t, i) => (
                      <details key={t.id} className="rounded-md bg-white">
                        <summary className="cursor-pointer px-3 py-2 text-sm text-slate-600 select-none">
                          {roles.get(t.participant) === 'auditor'
                            ? "The auditor's side"
                            : t.id.startsWith('call-')
                              ? `Other model call ${i + 1}`
                              : `Other branch ${i + 1}`}{' '}
                          <span className="text-slate-400">({t.messages.length} messages)</span>
                        </summary>
                        <div className="px-3 pb-3">
                          <Messages messages={t.messages} />
                        </div>
                      </details>
                    ))}
                  </div>
                </ThreadPanel>
                {audit && (
                  <ThreadPanel side="auditor">
                    <div className="p-3">
                      <Messages
                        messages={audit.messages}
                        lead={control}
                        link={{ side: 'auditor', path: attemptPath(run, a.ordinal) }}
                      />
                    </div>
                  </ThreadPanel>
                )}
              </ThreadSwitch>
            ) : (
              <p className="p-3 text-sm text-slate-500">The transcript is not available.</p>
            )}
          </Section>
        </div>
        {lens && (
          <LensReadoutView
            readout={lens.readout}
            facts={lens.facts}
            names={Object.fromEntries(version.scores.map((s) => [s.key, s.displayName]))}
          />
        )}
        {swap && (
          <ProbeSwapView
            swap={swap.swap}
            facts={swap.facts}
            names={Object.fromEntries(version.scores.map((s) => [s.key, s.displayName]))}
          />
        )}
        {wsb && (
          <WsbReadoutView
            readout={wsb.readout}
            facts={wsb.facts}
            names={Object.fromEntries(version.scores.map((s) => [s.key, s.displayName]))}
          />
        )}
      </div>
    </div>
  );
}

/** The run's model of each slot. */
const runModels =
  ({ run }: Pick<LoadedAttempt, 'run'>): ModelOf =>
  (s) =>
    run.settings.models?.[s.id]?.model ?? s.default;

/**
 * The role prompts in the transcript: before each user message that a simulated user or partner
 * wrote, the prompt that it got first for that call, and the writer's name. After the last
 * message, the judges' prompts.
 */
function transcriptNotes(found: LoadedAttempt, messages: Message[]) {
  const before = new Map<number, ReactNode>();
  const writer = new Map<number, string>();
  const judges: ReactNode[] = [];
  const users = messages.flatMap((m, i) => (m.role === 'user' ? [i] : []));
  for (const { slot, prompt, label, model, headings } of roleSlots(
    found.transcript,
    found.version.runner?.models ?? [],
    runModels(found),
  )) {
    const parts = prompt.messages.map((m, i) => ({ heading: headings[i]!, text: m.text, call: m.call }));
    if (slot.role !== 'auditor') {
      judges.push(<PromptNote key={slot.id} title={`${label} Prompt`} model={model} parts={parts} />);
      continue;
    }
    writtenMessages(users, prompt.calls).forEach((at, j) => {
      writer.set(at, `${label} · ${model}`);
      const got = parts.filter((p) => p.call === j + 1);
      if (got.length)
        before.set(at, <PromptNote key={slot.id} title={`${label} Prompt`} model={model} parts={got} right />);
    });
  }
  return { before, writer, after: judges.length ? judges : null };
}

/** A prompt that another model got, open, in the transcript. `right`: beside a user message. */
function PromptNote({
  title,
  model,
  parts,
  right,
}: {
  title: string;
  model: string;
  parts: { heading: string; text: string }[];
  right?: boolean;
}) {
  return (
    <details
      open
      className={cn(
        'group/note w-full max-w-[90%] rounded-lg border border-dashed border-slate-300 bg-white/60 px-3 py-1.5 text-xs text-slate-600',
        right ? 'self-end' : 'self-start',
      )}
    >
      <summary className="flex cursor-pointer list-none items-center gap-x-1 select-none [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3 shrink-0 transition-transform group-open/note:rotate-90" aria-hidden />
        <span className="font-medium text-slate-700">{title}</span>
        <span className="min-w-0 truncate font-mono text-[11px] text-slate-400">{model}</span>
      </summary>
      <div className="mt-1.5 flex flex-col gap-2 pl-4">
        {parts.map((p, i) => (
          <section key={i} className="flex flex-col gap-0.5">
            <h4 className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">{p.heading}</h4>
            <div className="wrap-anywhere whitespace-pre-wrap text-slate-700">{p.text}</div>
          </section>
        ))}
      </div>
    </details>
  );
}
/** A provider refused the attempt's call for its policy: what it said, and the full error closed. */
function BlockNote({ block, error }: { block: AttemptBlock; error?: string }) {
  return (
    <div className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
      <p className="font-semibold text-slate-800">
        {block.provider === 'unknown' ? 'Blocked by the provider' : `Blocked by ${block.provider}`}
      </p>
      <p className="mt-0.5">
        {blockText(block)}
        {block.message ? `: “${block.message}”` : '.'} This is the provider&apos;s policy filter, not a reply from the
        model. The sample has no score.
      </p>
      {error && (
        <details className="mt-1.5">
          <summary className="cursor-pointer text-slate-500 hover:text-slate-700">Error</summary>
          <p className="mt-1 font-mono text-[11px] wrap-anywhere whitespace-pre-wrap text-slate-600">{error}</p>
        </details>
      )}
    </div>
  );
}

/** The interpretability tools for an attempt. `compact`: small, for one line of text. */
export function AttemptJlens({ found, compact }: { found: LoadedAttempt; compact?: boolean }) {
  const { run, eval: e, version, model, attempt: a } = found;
  const { thread } = mainThreads(found.transcript);
  const blocked = jlensBlock(version, a);
  // A blocked sample sends no messages to the client.
  const props = blocked
    ? { hasToolCalls: false, full: { messages: [], refusal: blocked } }
    : jlensProps(thread ? withReply(thread.messages, a.output) : []);
  return (
    <JlensButton
      {...props}
      compact={compact}
      names={[model.name, ...model.aliases]}
      source={{
        evalName: e.displayName,
        sample: sampleLabel(sampleOf(found)),
        modelName: model.displayName,
        url: `${NEXT_PUBLIC_URL}${attemptPath(run, a.ordinal)}`,
      }}
    />
  );
}

/**
 * The scores as a table, like the run's metrics: a row for each score, with its value and, for a
 * panel of judges, each judge's own value ("concerning@judge_2"). A score shows the eval's name for
 * it, found by its key or its last part ("audit_judge/concerning"), with the key below.
 * `tokens`: for a lens score, the number of hidden tokens it scores; it shows the missed tokens.
 */
function Scores({
  found,
  prompts,
  tokens,
  marks,
  wsb,
}: {
  found: LoadedAttempt;
  prompts: Prompts;
  tokens?: Record<string, number> | null;
  /** Each result's pass or fail (`resultMarks`). */
  marks: Map<string, boolean | null>;
  /** The WorkspaceBench readout: a regex family has no judge. */
  wsb?: Pick<WsbReadout, 'regex'>;
}) {
  const { run, version, attempt: a } = found;
  const slots = (version.runner?.models ?? []).filter((m) => m.scoring);
  type Row = { value?: ScoreValue; judges: Map<string, ScoreValue> };
  const rows = new Map<string, Row>();
  for (const name of shownScoreNames(version.scores, Object.keys(a.scores))) {
    const value = a.scores[name]!;
    const [base, judge] = name.split('@');
    const row: Row = rows.get(base) ?? { judges: new Map() };
    if (judge) row.judges.set(judge, value);
    else row.value = value;
    rows.set(base, row);
  }
  const panel = slots.filter((m) => [...rows.values()].some((r) => r.judges.has(m.id)));
  // `metric`: the score's mean metric if it has one, as its range is the score's (not a share above a cutoff).
  const lookup = (base: string) => {
    const def = attemptScoreDef(version.scores, base);
    const key = def?.key ?? base.split('/').pop()!;
    const own = version.metrics.filter((m) => m.score === key || m.key === key);
    const metric = own.find((m) => m.aggregation === 'mean') ?? own[0];
    return { def, metric, headline: own.some((m) => m.headline) };
  };
  const sorted = [...rows].sort(
    byHeadlineThenName(
      ([base]) => lookup(base).headline,
      ([base]) => lookup(base).def?.displayName ?? base,
    ),
  );
  const target = targetText(a.target);
  const scoreValues = [...rows.values()].map((r) => r.value);
  const votes = scoreValues.map((v) => rubricVotes(target, v?.explanation)).find(Boolean);
  // One row for each explanation text: two scores can share one judge's reply.
  const byText = new Map<string, string[]>();
  for (const [base, { value }] of sorted)
    if (value?.explanation) byText.set(value.explanation, [...(byText.get(value.explanation) ?? []), base]);
  const explained = [...byText].map(
    ([text, bases]) => [text, bases.map((b) => lookup(b).def?.displayName ?? b)] as const,
  );
  const groups = (a.metrics ?? []).map((k) => version.metrics.find((m) => m.key === k)?.displayName ?? k);
  const taskArgs = Object.entries((a.settings?.generation ?? run.settings).taskArgs ?? {});
  // The result groups that this attempt counts in go first.
  const metadata = [
    ...(groups.length ? [['result groups', groups.join('\n')] as const] : []),
    ...metadataOf(found.transcript),
    ...(taskArgs.length ? [['task args', taskArgs.map(([k, v]) => `${k}=${valueText(v)}`).join('\n')] as const] : []),
  ];
  const prompted = prompts.rows.length > 0;
  return (
    <>
      {prompted && (
        <Fact label={prompts.rows.length > 1 ? 'Prompts' : 'Prompt'} className="border-t-0">
          <PromptRows {...prompts} />
        </Fact>
      )}
      {target && (
        <Fact label="Target" className={cn(!prompted && 'border-t-0')}>
          {votes ? (
            <ol className="flex flex-col gap-0.5" title="The judges' majority vote on each item">
              {votes.map((v, i) => (
                <li key={i} className="flex gap-x-1.5">
                  <span
                    className={cn('w-2 shrink-0 font-mono font-semibold', v.yes ? 'text-rose-700' : 'text-slate-400')}
                  >
                    {v.yes ? 'Y' : 'N'}
                  </span>
                  <span>{v.line}</span>
                </li>
              ))}
            </ol>
          ) : (
            <span className="whitespace-pre-line">{target}</span>
          )}
        </Fact>
      )}
      {rows.size > 0 && (
        <div className="flex flex-col pt-1.5 pb-1 text-xs">
          <div className="flex items-baseline justify-between px-3 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Results
            {panel.length > 0 && (
              <span className="font-normal tracking-normal text-slate-400 normal-case">Mean · Judges</span>
            )}
          </div>
          {/* Indented under the title, as the other facts are. */}
          <table className="ml-5 w-[calc(100%-1.25rem)] text-left">
            <tbody>
              {sorted.map(([base, { value, judges }]) => {
                const { def, metric } = lookup(base);
                const n = onScale(value?.value, def);
                const range: [number, number] | undefined =
                  metricRange(version.metrics, metric?.key ?? '') ??
                  (typeof def?.min === 'number' && typeof def?.max === 'number' ? [def.min, def.max] : undefined);
                const score =
                  typeof n === 'number'
                    ? sampleBar(
                        base,
                        n,
                        {
                          safetyDirection: metric?.safetyDirection,
                          range,
                          groups: groupDirections(version, metric?.key),
                        },
                        a.metrics,
                      )
                    : null;
                const of = tokens?.[base];
                const missed = of && typeof value?.value === 'number' ? Math.round((1 - value.value) * of) : null;
                const passed = marks.get(base) ?? undefined;
                const plain = passed !== undefined && panel.length === 0 && isMarkValue(value?.value);
                return (
                  <tr key={base}>
                    <td className="py-1.5 pr-3 wrap-anywhere text-slate-800">
                      {def ? (
                        <>
                          <span className="block text-xs/4">
                            {def.displayName}
                            {def.description && (
                              <InfoPopover
                                label={def.displayName}
                                iconClassName="size-3"
                                triggerClassName="ml-1 align-[-2px]"
                                contentClassName="text-xs"
                              >
                                {def.description}
                              </InfoPopover>
                            )}
                          </span>
                          <span className="block font-mono text-[9px] text-slate-400">{base}</span>
                        </>
                      ) : (
                        <span className="block font-mono text-[9px]/4 text-slate-700">{base}</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-center font-mono text-[11px]/4 font-medium whitespace-nowrap text-slate-800 tabular-nums">
                      {missed != null && of === 1 ? (
                        <span className={cn('font-sans', missed ? 'text-rose-700' : 'font-normal text-slate-500')}>
                          {missed ? 'Missed' : 'Passed'}
                        </span>
                      ) : missed != null ? (
                        <span className="font-sans font-normal text-slate-500">
                          <span className={missed ? 'font-medium text-rose-700' : 'text-slate-400'}>{missed}</span> of{' '}
                          {of} Missed
                        </span>
                      ) : value === undefined ? (
                        '—'
                      ) : plain ? (
                        <PassMark attempt={{ status: 'success', passed }} label />
                      ) : (
                        scoreText(n, panel.length > 0)
                      )}
                      {labelAnswer(value?.answer) && (
                        <span className="block font-sans text-[10px] font-normal text-slate-500">
                          answer {labelAnswer(value?.answer)}
                        </span>
                      )}
                      {passed !== undefined && !plain && missed == null && (
                        <span className="mt-0.5 flex justify-center">
                          <PassMark attempt={{ status: 'success', passed }} label />
                        </span>
                      )}
                      {score && passed === undefined && safeShare(score) !== undefined && (
                        <SafetyBar result={score} className="mx-auto mt-0.5 h-1.5 w-10" />
                      )}
                    </td>
                    {panel.length > 0 && (
                      <td className="px-3 py-1.5 text-center font-mono text-[9px]/3 whitespace-nowrap text-slate-600 tabular-nums">
                        {judges.size > 0
                          ? panel.map((m) => (
                              <span
                                key={m.id}
                                title={`${slotLabel(m)}: ${run.settings.models?.[m.id]?.model ?? m.default}`}
                                className="block cursor-help"
                              >
                                {judges.has(m.id) ? scoreText(onScale(judges.get(m.id)!.value, def)) : '—'}
                              </span>
                            ))
                          : '—'}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <SettingsFact
        found={found}
        regex={wsb?.regex}
        names={Object.fromEntries(version.scores.map((s) => [s.key, s.displayName]))}
      />
      {explained.length > 0 && (
        <Fact label={explained.length > 1 ? 'Explanations' : 'Explanation'}>
          <span className="flex flex-col gap-y-2">
            {explained.map(([text, names]) => (
              <span key={text} className="block">
                {explained.length > 1 && <span className="block text-slate-500">{names.join(', ')}</span>}
                <span className={cn('block whitespace-pre-line', explained.length > 1 && 'pl-2')}>{text}</span>
              </span>
            ))}
          </span>
        </Fact>
      )}
      {(run.log || metadata.length > 0 || run.provenance?.note) && (
        <Fact label="Other">
          {run.provenance?.note && (
            <Closed label="Caveat" className="mb-1">
              <p className="mt-1 mb-1 pl-2 whitespace-pre-line">{run.provenance.note}</p>
            </Closed>
          )}
          <span className="flex flex-col gap-y-1">
            <AttemptLogLinks found={found} attempt={found.attempt} />
          </span>
          {metadata.length > 0 && <OtherMetadata entries={metadata} />}
        </Fact>
      )}
    </>
  );
}

const WSB_METRICS: Record<string, string> = {
  pass_rate: 'Pass rate',
  pair_rate: 'Pair rate: a pair passes when the lens passes the scenario and its clean twin',
};

const GENERATION: Record<string, string> = {
  reasoning: 'Reasoning',
  maxTokens: 'Max Tokens',
  temperature: 'Temperature',
  epochs: 'Epochs',
  limit: 'Sample Limit',
};

const valueText = (v: unknown): string =>
  typeof v === 'string' ? v : Array.isArray(v) ? v.map(valueText).join(', ') : JSON.stringify(v);

/**
 * The settings of the attempt's run, as the attempt keeps them: the model of each role (judges
 * first), the sample's own settings and the generation settings. An attempt with none kept: from
 * the run and its version. `regex`: a WorkspaceBench family with no judge. `names`: score names.
 */
function SettingsFact({
  found,
  regex,
  names,
}: {
  found: LoadedAttempt;
  regex?: boolean;
  names: Record<string, string>;
}) {
  const { run, version, attempt } = found;
  const kept = attempt.settings;
  const modelOf = runModels(found);
  const roles: AttemptRole[] = kept?.roles ?? (version.runner?.models ?? []).map((s) => ({ ...s, model: modelOf(s) }));
  const generation = kept?.generation ?? run.settings;
  const rows: [string, ReactNode][] = [
    ...[...roles]
      .sort((a, b) => Number(!!b.scoring) - Number(!!a.scoring))
      .map((r): [string, ReactNode] => [
        slotLabel(r),
        <span key={r.id} className="font-mono text-[11px] wrap-anywhere">
          {r.model}
        </span>,
      ]),
    ...(kept?.sample ? wsbRows(kept.sample, regex, names) : []),
    ...Object.entries(GENERATION).map(([key, label]): [string, ReactNode] => {
      const v = (generation as Record<string, unknown>)[key];
      return [label, v == null || v === '' ? null : valueText(v)];
    }),
  ];
  const shown = rows.filter(([, value]) => value);
  if (!shown.length) return null;
  return (
    <Fact
      label="Settings"
      info={`The run's settings. Judges score the reply. Other roles run the test, for example as a user or a partner. They are not tested. The tested model is ${found.model.displayName}.`}
    >
      <span className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
        {shown.map(([label, value], i) => (
          <Fragment key={i}>
            <span className="text-slate-500">{label}</span>
            <span className="min-w-0">{value}</span>
          </Fragment>
        ))}
      </span>
    </Fact>
  );
}

/** A WorkspaceBench family's judge, summarizer and metric, and who made each lens's readouts.
 * `regex`: the family has no judge. `names`: the lens names, by score key. */
function wsbRows(s: WsbSettings, regex: boolean | undefined, names: Record<string, string>): [string, ReactNode][] {
  const by = new Map<string, { url?: string; lenses: string[] }>();
  for (const [key, r] of Object.entries(s.readouts ?? {})) {
    const group = by.get(r.by) ?? { url: r.url, lenses: [] };
    group.lenses.push(names[key] ?? key);
    by.set(r.by, group);
  }
  return [
    [
      'Judge',
      regex ? (
        <span className="text-slate-500">None: a regex scores the summarizer's notes</span>
      ) : (
        s.judge && (
          <span title={s.judge.model}>
            {s.judge.name}
            {s.route && <span className="text-slate-500"> · {s.route}</span>}
          </span>
        )
      ),
    ],
    ['Summarizer', s.summarizer && <span title={s.summarizer.model}>{s.summarizer.name}</span>],
    ['Metric', s.metric && (WSB_METRICS[s.metric] ?? s.metric)],
    [
      'Readouts',
      by.size > 0 && (
        <span className="flex flex-col">
          {[...by].map(([who, { url, lenses }]) => (
            <span key={who}>
              <span className="text-slate-500">{lenses.join(', ')}:</span>{' '}
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-sky-800 hover:underline">
                  {who}
                </a>
              ) : (
                who
              )}
            </span>
          ))}
        </span>
      ),
    ],
  ];
}

type ScoreValue = EvalAttempt['scores'][string];

/** How many of a method eval's results passed, as "2 of 4 Passed", in the size of `PassMark large`. */
function MethodPasses({ marks }: { marks: boolean[] }) {
  const n = marks.filter(Boolean).length;
  const color = n === marks.length ? 'text-emerald-600' : n === 0 ? 'text-red-700' : 'text-slate-600';
  return (
    <span className={cn('shrink-0 font-sans text-[13px] font-bold tracking-wide uppercase', color)}>
      {n} of {marks.length} Passed
    </span>
  );
}

/** A value that the mark says in full (1, `true`, `C`), so the mark shows in its place. */
const isMarkValue = (v: unknown) => typeof v === 'boolean' || v === 0 || v === 1 || v === 'C' || v === 'I';

/**
 * Each result's mark; null for none. A method eval: the detector's call against the reply's label.
 * Else the score's `pass` rule or direction, as the runner marks the attempt (a lens score: a pass
 * when it found all the hidden tokens, a fail when it found none). A rule by target, when the
 * dataset terms hide the target: the attempt's own mark.
 */
function resultMarks(found: LoadedAttempt) {
  const { eval: e, version, attempt: a } = found;
  const names = shownScoreNames(version.scores, Object.keys(a.scores)).filter((n) => !n.includes('@'));
  const calls = e.facets.subjects.includes('method')
    ? detectorCalls(a.scores, detectorsOf(version.scores, [a]), typeof a.target === 'string' ? a.target : null)
    : {};
  return new Map(
    names.map((name) => {
      const v = a.scores[name]?.value;
      const def = attemptScoreDef(version.scores, name);
      if (def?.pass?.byTarget && a.target == null) return [name, a.passed ?? null];
      return [name, calls[name]?.right ?? scoreMark(v, def, a.target, a.metrics)];
    }),
  );
}

/** A score's value: a number with at most 2 decimal places (`fixed`: always 2), else as text. */
const scoreText = (v: unknown, fixed?: boolean) =>
  typeof v === 'number' ? (fixed || !Number.isInteger(v) ? v.toFixed(2) : String(v)) : String(v);

/**
 * `lead`: a note at the top left. Beside a first message at the right, else above it. `notes`:
 * before some messages, the name of their writer, and after the last message.
 */
function Messages({
  messages,
  focus,
  flagId,
  lead,
  link,
  notes,
}: {
  messages: Message[];
  focus?: number;
  flagId?: string;
  lead?: ReactNode;
  link?: { side: ThreadSide; path: string };
  notes?: ReturnType<typeof transcriptNotes>;
}) {
  const beside = !!lead && !!messages[0] && isRightRole(messages[0].role);
  return (
    <div className="relative flex flex-col gap-2">
      {lead && <div className={cn(beside && 'absolute top-0 left-0 w-44')}>{lead}</div>}
      {messages.map((m, i) => {
        const anchor = link && messageAnchor(link.side, i);
        const writer = notes?.writer.get(i);
        return (
          <Fragment key={m.id}>
            {notes?.before.get(i)}
            <ChatBubble
              role={m.role}
              index={i}
              flagged={i === focus}
              flagId={flagId}
              anchor={anchor}
              actions={<MessageActions text={messageText(m)} href={link && `${link.path}#${anchor}`} />}
              className={cn(beside && i === 0 && 'max-w-[calc(100%-12rem)]')}
              size="sm"
              meta={(m.model || writer) && <span className="pl-1 font-mono text-slate-400">{m.model ?? writer}</span>}
            >
              {m.content.map((p, j) => (
                <PartView key={j} part={p} role={m.role} />
              ))}
              {m.toolCalls?.map((t) => (
                <ToolCallView
                  key={t.id}
                  name={t.function}
                  args={JSON.stringify(t.arguments ?? {}, null, 2)}
                  size="sm"
                />
              ))}
            </ChatBubble>
          </Fragment>
        );
      })}
      {notes?.after}
    </div>
  );
}

// Encrypted reasoning (a Fernet token, maybe with a "." and a suffix). Some providers put it in
// the summary field.
const ENCRYPTED = /^gAAAAA[\w=.-]+$/;
/** Thinking shorter than this many characters shows open, with no control to close it. */
const THINKING_OPEN_BELOW = 1024;

function PartView({ part: p, role }: { part: ContentPart; role: Message['role'] }) {
  if (p.type === 'text') {
    const value = role === 'tool' ? toolValue(p.text) : undefined;
    if (value) return <ChatPre text={value} size="sm" />;
    return <ChatMarkdown text={p.text} size="sm" className={cn(role === 'tool' && 'text-xs/normal')} />;
  }
  if (p.type === 'reasoning') {
    const label = {
      raw: 'Thinking',
      summary: 'Thinking Summary',
      omitted: 'Thinking Not Returned',
      redacted: 'Thinking Redacted',
    }[p.kind];
    return p.text && !ENCRYPTED.test(p.text) ? (
      <ThinkingView
        label={label}
        note={`${p.text.length.toLocaleString('en-US')} Characters`}
        size="sm"
        fixed={p.text.length < THINKING_OPEN_BELOW}
      >
        <ChatMarkdown
          text={p.kind === 'summary' ? splitSummaryParts(p.text) : p.text}
          size="sm"
          className="text-xs/normal text-slate-600"
        />
      </ThinkingView>
    ) : p.kind === 'redacted' ? null : (
      <p className="text-xs text-slate-400">{label}</p>
    );
  }
  return <p className="text-xs text-slate-400">A {p.kind} part. The Inspect log has it.</p>;
}
