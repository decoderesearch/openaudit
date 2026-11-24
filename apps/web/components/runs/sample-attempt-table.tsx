'use client';

import { safeShare, SafetyBar, type Score } from '@/components/catalog/score';
import { InfoPopover } from '@/components/info-popover';
import { plainClick, RunLink, showInView } from '@/components/pdf-viewer';
import { CodeText } from '@/components/runs/code-text';
import { usePassFilter } from '@/components/runs/pass-filter';
import { PassMark } from '@/components/runs/pass-mark';
import { SortTable, type SortColumn, type SortRow } from '@/components/runs/sortable-table';
import { FlagLabel } from '@/components/snippet-summary';
import { SEVERITIES, type SnippetSeverity } from '@/lib/openaudit-card';
import type { AttemptBlock } from '@/lib/runs/blocks';
import type { DetectorCall, DetectorDef } from '@/lib/runs/detectors';
import type { ScoreColumn } from '@/lib/runs/main-score';
import { modelPasses } from '@/lib/runs/model-passes';
import { cn } from '@/lib/utils';
import type { EvalAttempt } from '@openaudit/spec';
import { Check, ChevronRight, X } from 'lucide-react';
import { Fragment, useState } from 'react';

/** One attempt of a sample. `reply`: null when hidden or withheld (`note` says which). */
export type SampleAttemptRow = {
  id: string;
  href: string;
  run: string;
  model: { name: string; displayName: string };
  epoch: number;
  result: Pick<EvalAttempt, 'status' | 'passed'> & { block?: AttemptBlock };
  score?: { n: number | null; text: string; bar: Score | null };
  reply: string | null;
  note?: string;
  flag?: SnippetSeverity;
  flagTitle?: string;
  /** A methods eval: the reply's label (`lie`, `honest`), and each detector's call on it. */
  label?: string | null;
  calls?: Record<string, DetectorCall>;
  /** Why the results do not score this attempt: one cell in place of the detectors' calls. */
  notScored?: string;
};

/** The misses of the detectors on a row. */
const misses = (r: SampleAttemptRow) => Object.values(r.calls ?? {}).filter((c) => c.right === false).length;

/** A detector's call: red when it is wrong, gray when the reply has no graded label. "Passed" and
 * "Missed" show as on the eval page: small caps, green or red. */
export function Call({ call }: { call?: DetectorCall }) {
  if (!call) return <span className="text-slate-300">—</span>;
  const verdict = call.answer === 'Passed' || call.answer === 'Missed';
  return (
    <span
      title={call.right == null ? 'Not graded' : call.right ? 'Right' : 'Wrong'}
      className={cn(
        call.right === false ? 'text-rose-700' : call.right ? 'text-slate-800' : 'text-slate-400',
        verdict && 'text-[10px] font-semibold tracking-wide uppercase',
        verdict && call.right && 'text-emerald-600',
      )}
    >
      {call.answer}
    </span>
  );
}

/** A result as a number to sort by: errors first, then failed, then passed. */
const resultValue = ({ status, passed }: SampleAttemptRow['result']) =>
  status === 'error' ? -1 : passed == null ? null : Number(passed);

/** Worst first: by the share of the score that is good for safety, then by the share that
 * passed, then not graded. Errors only: last. */
const worstFirst = (safe: number | undefined, passRate: number | undefined, errorsOnly: boolean): number[] => {
  if (errorsOnly) return [3];
  if (safe !== undefined) return [0, safe, passRate ?? 0.5];
  return passRate === undefined ? [2] : [1, passRate];
};

const compare = (x: number[], y: number[]) => {
  const i = x.findIndex((v, i) => v !== y[i]);
  return i < 0 ? 0 : x[i]! - (y[i] ?? 0);
};

const firstOrder = ({ result: { status, passed }, score }: SampleAttemptRow) =>
  worstFirst(
    score?.bar ? safeShare(score.bar) : undefined,
    passed == null ? undefined : Number(passed),
    status === 'error',
  );

/** The attempts of one model, and what they show together. */
function summary(rows: SampleAttemptRow[]) {
  const graded = rows.filter((r) => r.result.passed != null);
  const passed = graded.filter((r) => r.result.passed).length;
  const errors = rows.filter((r) => r.result.status === 'error' && !r.result.block).length;
  const blocked = rows.filter((r) => r.result.block).length;
  const ns = rows.flatMap((r) => (r.score?.n != null ? [r.score.n] : []));
  const mean = ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : undefined;
  const base = rows.find((r) => r.score?.bar)?.score?.bar;
  const bar = base && mean !== undefined ? { ...base, value: mean } : null;
  const flagged = rows.filter((r) => r.flag);
  const titles = new Map<string, number>();
  for (const r of flagged) if (r.flagTitle) titles.set(r.flagTitle, (titles.get(r.flagTitle) ?? 0) + 1);
  const passRate = graded.length ? passed / graded.length : undefined;
  return {
    passed,
    failed: graded.length - passed,
    errors,
    blocked,
    mean,
    bar,
    passRate,
    flagged: flagged.length,
    worst: SEVERITIES.find((s) => flagged.some((r) => r.flag === s)),
    titles: [...titles].sort((a, b) => b[1] - a[1]),
    runs: new Set(rows.map((r) => r.run)).size,
    order: worstFirst(bar ? safeShare(bar) : undefined, passRate, errors + blocked === rows.length),
  };
}

const plural = (n: number, word: string) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;
/**
 * A sample's attempts, as the run's metrics show. When a model has more than one attempt, its
 * attempts are in one row, closed at first, with their counts, mean score and flags; a click
 * opens it. The worst are first; a header sorts the rows.
 * Columns with no value in any attempt do not show. `score`: the score column's label, and what
 * the score means (on hover over its header).
 */
export function SampleAttemptTable({
  rows: given,
  score,
  detectors = [],
}: {
  rows: SampleAttemptRow[];
  score?: Pick<ScoreColumn, 'label' | 'description'>;
  /** A methods eval's detectors: a column for each, in place of the score, result and reply. */
  detectors?: DetectorDef[];
}) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const calls = detectors.length > 0;
  // Detectors of hidden tokens have no labels.
  const labeled = calls && given.some((r) => r.label !== undefined);
  const all = [...given].sort((a, b) =>
    calls
      ? misses(b) - misses(a) || a.model.displayName.localeCompare(b.model.displayName)
      : compare(firstOrder(a), firstOrder(b)),
  );
  const scored = !calls && score && all.some((r) => r.score?.n != null) ? score : undefined;
  // With no pass or fail, the score is the result; errors and blocks show in its cell.
  const result =
    !calls && (scored ? all.some((r) => r.result.passed != null) : all.some((r) => resultValue(r.result) !== null));
  const filter = usePassFilter();
  const passes = modelPasses(all);
  const shown = filter ? all.filter((r) => passes.get(r.model.name) === (filter === 'passed')) : all;
  const models = new Map<string, SampleAttemptRow[]>();
  for (const r of shown) models.set(r.model.name, [...(models.get(r.model.name) ?? []), r]);
  const grouped = !calls && new Set(all.map((r) => r.model.name)).size < all.length;
  const columns: SortColumn[] = [
    { key: 'model', label: 'Model' },
    ...(labeled
      ? [
          {
            key: 'label',
            label: 'Label',
            className: 'text-center',
            info: (
              <InfoPopover label="Label" iconClassName="size-3.5" contentClassName="text-xs font-normal">
                <p>
                  If this model&apos;s reply is a lie or honest. Each model has its own label. A reply with another
                  label is not graded.
                </p>
              </InfoPopover>
            ),
          },
        ]
      : []),
    ...(calls
      ? [
          ...detectors.map((d) => ({
            key: `call:${d.key}`,
            label: (
              <span>
                {d.label}
                {d.kind && <span className="block text-[10px]/3 font-normal text-slate-400">{d.kind}</span>}
              </span>
            ),
            className: 'text-center',
            info: d.description && (
              <InfoPopover label={d.label} iconClassName="size-3.5" contentClassName="text-xs font-normal">
                <p>{d.description}</p>
              </InfoPopover>
            ),
          })),
        ]
      : []),
    ...(scored
      ? [
          {
            key: 'score',
            label: scored.label,
            className: 'text-center',
            info: scored.description && (
              <InfoPopover label={scored.label} iconClassName="size-3.5" contentClassName="text-xs font-normal">
                <p>{scored.description}</p>
              </InfoPopover>
            ),
          },
        ]
      : []),
    ...(result ? [{ key: 'result', label: 'Pass / Fail', className: 'text-center' }] : []),
    ...(calls ? [] : [{ key: 'reply', label: 'Reply' }]),
  ];

  const attemptRow = (r: SampleAttemptRow, nested = false) => (
    <tr key={r.id} className={cn('relative align-top hover:bg-sky-50', nested && 'bg-slate-50/70')}>
      <td className={cn('py-2 pr-3 wrap-anywhere', nested ? 'pl-9' : 'pl-3')}>
        <RunLink
          href={r.href}
          onClick={(e) => {
            const row = e.currentTarget.closest('tr');
            if (row && plainClick(e)) setTimeout(() => showInView(row), 100);
          }}
          className={cn(
            'block font-medium text-slate-600 after:absolute after:inset-0 hover:text-slate-900 hover:underline',
            nested ? 'text-[11px]/5' : 'text-xs/5',
          )}
        >
          {nested ? `Attempt ${r.epoch}` : r.model.displayName}
          {!nested && r.epoch > 1 && <span className="ml-1 text-slate-400">#{r.epoch}</span>}
        </RunLink>
      </td>
      {scored && (
        <td className="px-3 py-2 text-center font-mono text-xs/4 font-medium whitespace-nowrap text-slate-800 tabular-nums">
          {!result && (r.result.status === 'error' || r.result.block) ? (
            <span className="flex justify-center font-sans">
              <PassMark attempt={r.result} />
            </span>
          ) : (
            (r.score?.text ?? '—')
          )}
          {r.score?.bar && safeShare(r.score.bar) !== undefined && (
            <SafetyBar result={r.score.bar} className="mx-auto mt-0.5 h-1.5 w-10" />
          )}
        </td>
      )}
      {result && (
        <td className="px-3 py-2 text-xs/4">
          <span className="flex justify-center">
            <PassMark attempt={r.result} />
          </span>
        </td>
      )}
      {calls && (
        <>
          {labeled && <td className="px-3 py-2 text-center text-xs/4 text-slate-700">{r.label ?? '—'}</td>}
          {r.notScored ? (
            <td colSpan={detectors.length} className="px-3 py-2 text-center text-xs/4">
              <span className="block text-slate-600">Not Scored</span>
              <span className="block text-[10px]/3 text-slate-400">
                <CodeText text={r.notScored} />
              </span>
            </td>
          ) : (
            detectors.map((d) => (
              <td key={d.key} className="px-3 py-2 text-center text-xs/4 whitespace-nowrap tabular-nums">
                <Call call={r.calls?.[d.key]} />
              </td>
            ))
          )}
        </>
      )}
      {!calls && (
        <td className="px-3 py-2 text-xs/4 text-slate-700">
          <FlagLabel flag={r.flag} title={r.flagTitle} locked={r.reply === null} className="mb-0.5" />
          {r.reply === null ? (
            <span className="text-slate-400 italic">{r.note}</span>
          ) : (
            <div className="line-clamp-2 wrap-anywhere">{r.reply || '—'}</div>
          )}
        </td>
      )}
    </tr>
  );

  const flat = (): SortRow[] =>
    shown.map((r) => ({
      key: r.id,
      values: {
        model: r.model.displayName,
        result: resultValue(r.result),
        score: r.score?.n ?? null,
        reply: r.reply || null,
        label: r.label ?? null,
        // Wrong calls sort before right ones.
        ...Object.fromEntries(
          detectors.map((d) => {
            const right = r.calls?.[d.key]?.right;
            return [`call:${d.key}`, right == null ? null : Number(right)];
          }),
        ),
      },
      node: attemptRow(r),
    }));

  const groups = (): SortRow[] => {
    return [...models]
      .map(([name, attempts]) => ({ name, attempts, s: summary(attempts) }))
      .sort((a, b) => compare(a.s.order, b.s.order))
      .map(({ name, attempts, s }) => {
        const model = attempts[0]!.model;
        const isOpen = open.has(name);
        const toggle = () =>
          setOpen((o) => {
            const next = new Set(o);
            if (!next.delete(name)) next.add(name);
            return next;
          });
        const errorText = [s.blocked && `${s.blocked} blocked`, s.errors && plural(s.errors, 'error')]
          .filter(Boolean)
          .join(', ');
        return {
          key: name,
          values: {
            model: model.displayName,
            result: s.passRate ?? (s.errors ? -1 : null),
            score: s.mean ?? null,
            reply: s.flagged,
          },
          node:
            attempts.length === 1 ? (
              attemptRow(attempts[0]!)
            ) : (
              <Fragment key={name}>
                <tr className="cursor-pointer bg-white align-top hover:bg-sky-50" onClick={toggle}>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      className="flex cursor-pointer items-start gap-1 text-left"
                    >
                      <ChevronRight
                        aria-hidden
                        className={cn(
                          'mt-0.5 size-4 shrink-0 text-slate-400 transition-transform',
                          isOpen && 'rotate-90',
                        )}
                      />
                      <span className="min-w-0 wrap-anywhere">
                        <span className="block text-xs/5 font-medium text-slate-600">{model.displayName}</span>
                        {s.runs > 1 && (
                          <span className="block text-[11px] text-slate-500">{plural(s.runs, 'run')}</span>
                        )}
                      </span>
                    </button>
                  </td>
                  {scored && (
                    <td className="px-3 py-2 text-center font-mono text-xs/4 font-medium whitespace-nowrap text-slate-800 tabular-nums">
                      {s.mean !== undefined ? s.mean.toFixed(2) : '—'}
                      {s.bar && safeShare(s.bar) !== undefined && (
                        <SafetyBar result={s.bar} className="mx-auto mt-0.5 h-1.5 w-10" />
                      )}
                      {!result && errorText && (
                        <span className="mt-0.5 block font-sans text-[10px] font-normal text-slate-400">
                          {errorText}
                        </span>
                      )}
                    </td>
                  )}
                  {result && (
                    <td className="px-3 py-2 text-[11px]/4 text-slate-700 tabular-nums">
                      <span className="flex flex-wrap justify-center gap-x-2 gap-y-0.5">
                        {s.passed > 0 && (
                          <span title={`${s.passed} passed`} className="inline-flex items-center gap-0.5">
                            <Check aria-label="Passed" className="size-3.5 text-emerald-600" />
                            {s.passed}
                          </span>
                        )}
                        {s.failed > 0 && (
                          <span title={`${s.failed} failed`} className="inline-flex items-center gap-0.5">
                            <X aria-label="Failed" className="size-3.5 text-rose-600" />
                            {s.failed}
                          </span>
                        )}
                        {!s.passed && !s.failed && <span className="text-slate-400">—</span>}
                      </span>
                    </td>
                  )}
                  <td className="px-3 py-2 text-xs/4 text-slate-500">
                    {s.flagged > 0 ? (
                      <>
                        <FlagLabel flag={s.worst} title={plural(s.flagged, 'Flagged Chat')} className="mb-0.5" />
                        <div className="line-clamp-2">
                          {s.titles
                            .slice(0, 3)
                            .map(([t, n]) => `${t} (${n})`)
                            .join(' · ')}
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-400">No flagged chats</span>
                    )}
                  </td>
                </tr>
                {isOpen && attempts.map((r) => attemptRow(r, true))}
              </Fragment>
            ),
        };
      });
  };

  return (
    <SortTable
      className="table-fixed"
      headClassName="z-10"
      cols={
        <>
          <col className={calls ? 'w-40' : 'w-52'} />
          {scored && <col className="w-44" />}
          {result && <col className="w-24" />}
          {labeled && <col className="w-20" />}
          {detectors.map((d) => (
            <col key={d.key} />
          ))}
          {!calls && <col />}
        </>
      }
      columns={columns}
      rows={grouped ? groups() : flat()}
    />
  );
}
