'use client';

import { Section } from '@/components/catalog/parts';
import { CodeText } from '@/components/runs/code-text';
import { PassMark } from '@/components/runs/pass-mark';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { tokenText } from '@/lib/runs/lens-readout';
import type { ProbeSwap, SwapFacts, SwapVariant } from '@/lib/runs/probe-swap';
import { cn } from '@/lib/utils';
import { useState, type ReactNode } from 'react';

const KINDS: { key: SwapVariant; label: string; note?: string; about: string }[] = [
  { key: 'main', label: 'Swap', about: 'The hidden step is swapped.' },
  {
    key: 'answerSwap',
    label: 'Answer Swap',
    note: 'Ceiling',
    about: 'The answer is swapped. If this fails, the edit is too weak to test the hidden step.',
  },
  {
    key: 'randomNull',
    label: 'Random Word',
    note: 'Control',
    about: 'The hidden step is swapped for an unrelated word. A success here is by chance.',
  },
];

const TH = 'px-2 py-1.5 font-medium';
const TD = 'px-2 py-1.5';

/**
 * A probe swap of one sample: for each lens, the ranks of the old and new answers after the edit, at
 * one scale. "Best" is each lens's best scale for the model. `names`: each lens key's display name.
 */
export function ProbeSwapView({
  swap,
  facts,
  names,
}: {
  swap: ProbeSwap;
  facts: SwapFacts;
  names: Record<string, string>;
}) {
  const [kind, setKind] = useState<SwapVariant>('main');
  const [scale, setScale] = useState('best');
  const kinds = KINDS.filter((k) => swap.trials[k.key]);
  const byLens = swap.trials[kind] ?? {};
  const rows = [...new Set([...Object.keys(names), ...Object.keys(swap.trials.main ?? {})])]
    .filter((key) => byLens[key])
    .map((key) => {
      const s = scale === 'best' ? swap.bestScale[key] : Number(scale);
      return { key, name: names[key] ?? key, scale: s, trial: byLens[key]!.find((t) => t.scale === s) };
    });
  const randomTo = Object.values(swap.trials.randomNull ?? {})
    .flat()
    .find((t) => t.to)?.to;
  const from = kind === 'answerSwap' ? swap.answer : swap.intermediate;
  const to = kind === 'answerSwap' ? swap.swapAnswer : kind === 'randomNull' ? (randomTo ?? '?') : swap.swapTo;
  return (
    <Section
      title="Probe Swap"
      info={
        <>
          Each lens gives a direction for each word. At layers {swap.layers.join(', ')}, the edit exchanges the amounts
          of the two words&apos; directions, times the scale. The swap succeeds when the new answer is the model&apos;s
          top word. The score uses each lens&apos;s best scale for the model, on all items.
        </>
      }
    >
      {facts.notScored && (
        <p className="text-xs text-amber-800">
          <CodeText text={facts.notScored} />
        </p>
      )}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-8">
        <div className="flex flex-wrap gap-x-6 gap-y-2 whitespace-nowrap lg:shrink-0">
          <Term label="Swap">
            <Chip text={from} /> → <Chip text={to} />
          </Term>
        </div>
        <div className="flex min-w-0 flex-1 gap-2">
          {kinds.length > 1 && (
            <div className="min-w-0 flex-[3]">
              <SegmentedControl
                label="Trial kind"
                value={kind}
                onValueChange={setKind}
                options={kinds.map((k) => ({
                  value: k.key,
                  label: (
                    <span title={k.about} className="flex flex-col items-center leading-tight">
                      {k.label}
                      {k.note && <span>({k.note})</span>}
                    </span>
                  ),
                }))}
                className="flex h-full w-full"
                itemClassName="min-w-0 flex-1 px-2 py-1 text-center sm:px-2"
              />
            </div>
          )}
          <div className="min-w-0 flex-[3]">
            <SegmentedControl
              label="Scale"
              value={scale}
              onValueChange={setScale}
              options={[
                { value: 'best', label: <span title="Each lens's best scale for this model">Best</span> },
                ...swap.scales.map((s) => ({ value: String(s), label: `×${s}` })),
              ]}
              className="flex h-full w-full"
              itemClassName="min-w-0 flex-1 px-1 py-1 text-center sm:px-1"
            />
          </div>
        </div>
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className={cn(TH, 'text-left')}>Lens</th>
              <th className={cn(TH, 'text-center')}>Scale</th>
              <th className={cn(TH, 'text-center')}>
                Default Output Token
                <span className="mt-0.5 block">
                  <Chip text={swap.answer} bad />
                </span>
              </th>
              <th className={cn(TH, 'text-center')}>
                Target Output Token
                <span className="mt-0.5 block">
                  <Chip text={swap.swapAnswer} good />
                </span>
              </th>
              <th className={cn(TH, 'text-center')}>Swap Success</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className={cn(TD, 'text-slate-700')}>{r.name}</td>
                <td className={cn(TD, 'text-center font-mono text-[11px] text-slate-600 tabular-nums')}>
                  {r.scale != null ? `×${r.scale}` : '–'}
                </td>
                <td className={cn(TD, 'text-center')}>{r.trial ? <Rank rank={r.trial.answerRank} /> : '–'}</td>
                <td className={cn(TD, 'text-center')}>{r.trial ? <Rank rank={r.trial.rank} target /> : '–'}</td>
                <td className={cn(TD, 'text-center')}>
                  {r.trial ? <PassMark attempt={{ status: 'success', passed: r.trial.rank === 1 }} label /> : '–'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/** A word's rank after the edit: the old answer's is rose at #1. `target`: the new answer's, emerald
 * at #1 and amber to #5. */
function Rank({ rank: r, target }: { rank: number; target?: boolean }) {
  return (
    <span
      className={cn(
        'font-mono text-[11px] font-medium tabular-nums',
        !target
          ? r === 1
            ? 'text-rose-700'
            : 'text-slate-400'
          : r === 1
            ? 'text-emerald-700'
            : r > 0 && r <= 5
              ? 'text-amber-700'
              : 'text-slate-400',
      )}
    >
      {r > 0 ? `#${r.toLocaleString()}` : '–'}
    </span>
  );
}

/** A small label, with its words below it. */
function Term({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 text-xs text-slate-500">
      <span className="text-[11px] font-medium">{label}</span>
      <span className="flex flex-wrap items-center gap-1">{children}</span>
    </div>
  );
}

function Chip({ text, good, bad }: { text: string; good?: boolean; bad?: boolean }) {
  return (
    <span
      title={JSON.stringify(text)}
      className={cn(
        'inline-block max-w-[14ch] truncate rounded px-1 py-px align-bottom font-mono text-[11px]',
        good ? 'bg-emerald-100 text-emerald-900' : bad ? 'bg-rose-100 text-rose-900' : 'bg-slate-100 text-slate-700',
      )}
    >
      {text.trim() || tokenText(text)}
    </span>
  );
}
