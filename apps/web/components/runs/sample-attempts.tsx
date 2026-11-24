import { Section } from '@/components/catalog/parts';
import { EvalAccessGate } from '@/components/eval-attestation';
import { EvalLink } from '@/components/eval-link';
import { FillHeight } from '@/components/fill-height';
import { InfoPopover } from '@/components/info-popover';
import Link from '@/components/link';
import { Eyebrow } from '@/components/page';
import { Fact, metadataOf, OtherMetadata, promptRows, Slots, type ModelOf } from '@/components/runs/attempt-facts';
import { PassFilterProvider, PassTally } from '@/components/runs/pass-filter';
import { PromptRows } from '@/components/runs/prompt-preview';
import { SampleAttemptTable, type SampleAttemptRow } from '@/components/runs/sample-attempt-table';
import { TermsNotice } from '@/components/runs/terms-notice';
import { ViewLink, type ViewMode } from '@/components/runs/view-link';
import { toUrlId } from '@/lib/ids';
import { onScale } from '@/lib/runs/attempt-scores';
import { detectorCalls, labelTally, shareCalls } from '@/lib/runs/detectors';
import { expectedAnswer } from '@/lib/runs/expected-answer';
import { columnValue, headlineOf, mainScore, scoreNumber } from '@/lib/runs/main-score';
import { modelPasses } from '@/lib/runs/model-passes';
import { attemptRule, strictest, versionRule } from '@/lib/runs/terms';
import { kindLabel } from '@/lib/sample-issues';
import { evalDetectors, evalShareDetectors } from '@/lib/server/methods';
import { attemptPath, notScoredReasons, samplePath, type SampleAttempts as Found } from '@/lib/server/runs';
import { cn } from '@/lib/utils';
import { TriangleAlert } from 'lucide-react';

const PROMPT_BOX = 'mx-0 flex w-auto min-w-0 rounded-md py-1.5 pr-2 pl-3';
const HEADING = 'text-[10px] font-semibold tracking-wide text-slate-500 uppercase';

const Dot = () => (
  <span className="text-slate-400" aria-hidden>
    ·
  </span>
);

/**
 * A sample and its attempts: on the left its model roles and metadata; on the right its prompts (a
 * click opens them in a dialog) and expected answer, with how many models passed and failed (a
 * click filters the rows), then
 * one row for each attempt with its model, result, main score, and reply. `run`: only that run's
 * attempts.
 */
export async function SampleAttempts({
  found,
  run,
  mode = 'page',
}: {
  found: Found;
  run?: { id: string };
  mode?: ViewMode;
}) {
  const { sample, issue, eval: e, version, access, attempts, newest } = found;
  const readable = attempts.find((x) => !x.attempt.hidden)?.attempt;
  const rule = strictest([versionRule(version), ...attempts.map((x) => attemptRule(version, x.attempt))]);
  const first = attempts[0];
  // Some evals shuffle the choices in each run: then the letters differ, and no list shows.
  const lists = new Set(attempts.filter((x) => !x.attempt.hidden).map((x) => JSON.stringify(x.attempt.choices ?? [])));
  const choices = lists.size === 1 ? readable?.choices : undefined;
  const column = mainScore(version, [], [...new Set(attempts.flatMap((x) => Object.keys(x.attempt.scores)))]);
  // A methods eval: each model's reply has its own label, and each detector makes a call on it.
  const detectors = e.facets.subjects.includes('method')
    ? await evalDetectors(
        version,
        attempts.map((x) => x.attempt),
      )
    : [];
  // With no answers, a column for each score that is a share of hidden tokens found.
  const shares =
    e.facets.subjects.includes('method') && !detectors.length
      ? await evalShareDetectors(
          version,
          attempts.map((x) => x.attempt),
        )
      : [];
  const notScored = shares.length ? notScoredReasons(attempts.map((x) => x.attempt)) : undefined;
  const labelOf = (a: (typeof attempts)[number]['attempt']) =>
    !a.hidden && typeof a.target === 'string' ? a.target : null;
  const rows: SampleAttemptRow[] = attempts.map(({ attempt: a, run: r, model }) => {
    const value = column && !a.hidden ? columnValue(a, column) : undefined;
    const label = labelOf(a);
    return {
      ...(detectors.length && { label, calls: a.hidden ? {} : detectorCalls(a.scores, detectors, label) }),
      ...(shares.length && { calls: a.hidden ? {} : shareCalls(a.scores, shares, a.target) }),
      ...(notScored?.has(a.id) && { notScored: notScored.get(a.id) }),
      id: a.id,
      href: attemptPath(r, a.ordinal),
      run: r.id,
      model,
      epoch: a.epoch,
      result: { status: a.status, passed: a.passed, ...(a.block && { block: a.block }) },
      ...(value && {
        score: { n: scoreNumber(onScale(a.scores[column!.key]?.value, column)) ?? null, ...value },
      }),
      reply: a.hidden || a.withheld ? null : (a.output ?? ''),
      ...((a.hidden || a.withheld) && { note: a.hidden ? 'Hidden' : 'Withheld' }),
      ...(a.flag && { flag: a.flag }),
      ...(a.flagTitle && { flagTitle: a.flagTitle }),
    };
  });
  const slots = version.runner?.models ?? [];
  const modelOf: ModelOf = (s) => newest?.models[s.id]?.model ?? s.default;
  // The rows can come from runs with different judges: show them all.
  const judgeOf: ModelOf = (s) => found.slotModels[s.id]?.join(', ') || modelOf(s);
  const roles = slots.filter((m) => !m.scoring);
  const judges = slots.filter((m) => m.scoring);
  const prompts = promptRows({
    transcript: newest?.transcript,
    slots,
    modelOf,
    input: readable?.input,
    choices,
    subject: newest?.model.name ?? '',
    title: `Evaluation Sample: ${sample.sourceId}`,
    description: 'This is an evaluation sample. Do not use it to train models.',
    judges: false,
  });
  const allMetadata = metadataOf(newest?.transcript);
  const labels = new Map<string, number>();
  for (const x of attempts) {
    const l = labelOf(x.attempt);
    if (l) labels.set(l, (labels.get(l) ?? 0) + 1);
  }
  const expected = detectors.length
    ? labels.size === 0
      ? undefined
      : {
          lines: [labelTally(labels)],
          info: 'The labels of the models’ replies. Each model has its own label: a reply is a lie when the model states an answer that it believes is false.',
          uses: [] as string[],
        }
    : readable && expectedAnswer(e.slug, readable.target, Object.fromEntries(allMetadata), choices);
  const metadata = allMetadata.filter(([k]) => !expected?.uses.includes(k));
  const { headDef } = headlineOf(version);
  const metric = headDef
    ? { key: headDef.key, label: headDef.displayName || headDef.key, description: headDef.description }
    : column;
  const expectedInfo = shares.length
    ? 'The hidden tokens: the middle steps of the task that the model does not say. Each method must find them in the model’s activations.'
    : expected?.info;
  const promptLabel = prompts.rows.length > 1 ? 'Prompts' : 'Prompt';
  // Methods evals grade the detectors, not the models.
  const graded = detectors.length ? new Map<string, boolean>() : modelPasses(rows);
  const passedModels = [...graded.values()].filter(Boolean).length;
  const tally = graded.size ? { passed: passedModels, failed: graded.size - passedModels } : null;
  const fromNewest = newest ? `From the newest attempt that you can read, by ${newest.model.displayName}.` : undefined;
  const panel = mode === 'panel';
  const Fill = panel ? 'div' : FillHeight;
  return (
    <Fill
      className={cn(
        'grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]',
        // In the panel: the height of its scroll box (`cqh`), less its padding.
        panel ? 'lg:h-[calc(100cqh-2rem)]' : 'lg:h-[var(--fill-h,40rem)]',
      )}
    >
      <div className="flex flex-col gap-3 lg:min-h-0 lg:overflow-y-auto">
        <div className="flex shrink-0 flex-col gap-2 px-2">
          <Eyebrow className="-mb-1 text-slate-400">Evaluation Sample</Eyebrow>
          {/* The sample id is on one line: it shrinks and ends in an ellipsis. */}
          <h1 className="flex flex-col items-start font-semibold">
            <EvalLink slug={e.slug} className="text-[15px] text-sky-800 hover:underline">
              {e.displayName}
            </EvalLink>
            <ViewLink
              to={{ sample: toUrlId(sample.id), ...(run && { sampleRun: toUrlId(run.id) }) }}
              mode={mode}
              title={sample.sourceId}
              className="max-w-full truncate text-[13px] text-slate-700 hover:underline"
            >
              {sample.sourceId}
            </ViewLink>
          </h1>
          {run && first && (
            <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
              <ViewLink to={{ run: toUrlId(run.id) }} mode={mode} className="text-sky-800 hover:underline">
                Run on {first.model.displayName}
              </ViewLink>
              <Dot />
              <ViewLink to={{ sample: toUrlId(sample.id) }} mode={mode} className="text-sky-800 hover:underline">
                All models
              </ViewLink>
            </p>
          )}
        </div>
        {issue && (
          <p className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <TriangleAlert className="mr-1 inline size-3.5 align-[-2px] text-amber-600" aria-hidden />
            <span className="font-semibold">Known error: {kindLabel(issue.kind)}.</span>
            <span className="mt-1 block">
              {access.canRead(versionRule(version)) && issue.note}{' '}
              {issue.effect === 'exclude' &&
                "This sample is not counted for or against a model's pass rate, since it's a known error."}
            </span>
            <Link href={`/evaluations/${e.slug}/known-errors`} className="mt-1 block text-sky-800 hover:underline">
              All Known Errors for {e.displayName} →
            </Link>
          </p>
        )}
        <Section
          title="Sample"
          titleClassName="sr-only"
          className="min-h-0 shrink-0 gap-0 rounded-none border-0 bg-transparent p-0 sm:p-0 [&>dl]:border-t-0"
        >
          {!!choices?.length && (
            <Fact label="Choices">
              <ol className="list-[upper-alpha] pl-5 text-slate-700">
                {choices.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ol>
            </Fact>
          )}
          {roles.length > 0 && (
            <Fact
              label={roles.length > 1 ? 'Model Roles' : 'Model Role'}
              info={`The eval uses these models to run the test, for example to act as a user, a partner or a grader. They are not tested.${newest ? ` The models are from the run of the newest attempt that you can read (${newest.model.displayName}).` : ''}`}
            >
              <Slots slots={roles} modelOf={modelOf} names />
            </Fact>
          )}
          {judges.length > 0 && (
            <Fact label={judges.length > 1 ? 'Judges' : 'Judge'}>
              <Slots slots={judges} modelOf={judgeOf} names={judges.length > 1} />
            </Fact>
          )}
          {metadata.length > 0 && (
            <Fact label="Other" info={fromNewest}>
              <OtherMetadata entries={metadata} />
            </Fact>
          )}
        </Section>
      </div>
      <PassFilterProvider>
        <div className="flex min-h-0 flex-col gap-2">
          <div className="flex shrink-0 items-center gap-x-3 pr-3 pl-1">
            <div className="flex min-w-0 flex-1 flex-col rounded-md bg-slate-100">
              {prompts.rows.length ? (
                <PromptRows
                  {...prompts}
                  label={promptLabel}
                  className={cn(PROMPT_BOX, 'hover:bg-slate-200/70', expected && 'rounded-b-none')}
                />
              ) : (
                <div className={cn(PROMPT_BOX, 'flex-col items-start gap-y-1 text-xs')}>
                  <span className={HEADING}>{promptLabel}</span>
                  <span className="text-slate-400 italic">
                    {!attempts.length
                      ? 'No public run used this sample yet.'
                      : !readable
                        ? access.cleared
                          ? 'Hidden by the dataset terms. See the terms below.'
                          : 'Hidden until you confirm the statement below.'
                        : 'No attempt saved its prompt.'}
                  </span>
                </div>
              )}
              {expected && (
                <div className="flex flex-col gap-y-1 border-t border-slate-200 py-1.5 pr-2 pl-3 text-xs">
                  <span className={HEADING}>
                    Expected / Target
                    {metric && (
                      <>
                        {' ('}
                        <span className="font-mono font-normal tracking-normal normal-case">{metric.key}</span>)
                      </>
                    )}
                    <InfoPopover
                      label="Expected / Target"
                      iconClassName="size-3"
                      triggerClassName="ml-1 align-[-2px]"
                      contentClassName="flex flex-col gap-y-2 text-xs font-normal tracking-normal normal-case"
                    >
                      <p>{expectedInfo}</p>
                      {metric?.description && (
                        <p>
                          <span className="font-semibold">{metric.label}:</span> {metric.description}
                        </p>
                      )}
                    </InfoPopover>
                  </span>
                  {expected.lines.map((line) => (
                    <span key={line} className="block whitespace-pre-line text-slate-700">
                      {line}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {tally && <PassTally {...tally} />}
          </div>
          <TermsNotice version={version} access={access} rule={rule} returnTo={samplePath(sample, run)} />
          {!access.cleared && <EvalAccessGate />}
          <Section title="Attempts" titleClassName="sr-only" className="min-h-0 gap-0 overflow-hidden p-0 sm:p-0">
            {attempts.length ? (
              <div className="min-h-0 flex-1 overflow-auto lg:overscroll-contain">
                <SampleAttemptTable rows={rows} score={column} detectors={detectors.length ? detectors : shares} />
              </div>
            ) : (
              <p className="flex-1 px-3 py-2 text-sm text-slate-500">No attempts of this sample show yet.</p>
            )}
            <p className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-3 border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600">
              This is an evaluation sample. Do not use it to train models.
              {e.canary && <span className="font-mono text-[10px] break-all text-slate-400">{e.canary}</span>}
            </p>
          </Section>
        </div>
      </PassFilterProvider>
    </Fill>
  );
}
