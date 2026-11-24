import { EvalStatusTag } from '@/components/catalog/eval-status';
import { ResultValue } from '@/components/catalog/score';
import Link from '@/components/link';
import { LocalTime } from '@/components/local-time';
import { ACTIVE, RunStatusBadge } from '@/components/runs/status-badge';
import { effortLabel, effortOf } from '@/lib/runs/effort';
import { runPath, type RunListItem } from '@/lib/server/runs';
import type { EvalRun, ServingRoute } from '@openaudit/spec';

export { PassMark, targetText } from '@/components/runs/pass-mark';
export { ACTIVE, RunStatusBadge };

/** "OpenRouter qwen/qwen3.6-27b via Alibaba (no fallbacks), quantization unknown". */
export function routeText(r: ServingRoute) {
  const kind = { openrouter: 'OpenRouter', direct: 'Direct API' }[r.kind as string] ?? r.kind;
  return [
    `${kind} ${r.model}`,
    r.providers?.length && `via ${r.providers.join(', ')}${r.allowFallbacks === false ? ' (no fallbacks)' : ''}`,
    r.quantization && `quantization ${r.quantization}`,
  ]
    .filter(Boolean)
    .join(', ');
}

/** "thinking high". Empty when the run set no effort. */
export function thinkingText(settings: EvalRun['settings']) {
  const effort = effortOf(settings);
  return effort ? `thinking ${effortLabel(effort).toLowerCase()}` : '';
}

export function runSettingsText(run: EvalRun) {
  const s = run.settings;
  return [
    thinkingText(s),
    s.limit ? `first ${s.limit} samples` : 'all samples',
    s.epochs && s.epochs > 1 && `${s.epochs} epochs`,
    runModelsText(run),
  ]
    .filter(Boolean)
    .join(', ');
}

/** The slot models: "judge: openai/gpt-4o". */
export function runModelsText(run: EvalRun) {
  return Object.entries(run.settings.models ?? {})
    .map(([id, r]) => `${id}: ${r?.model}`)
    .join(', ');
}

export function OriginTag({ run }: { run: EvalRun }) {
  if (run.origin === 'import') return <span className="ml-1.5 text-slate-400">imported</span>;
  if (run.origin === 'rescore') return <span className="ml-1.5 text-slate-400">re-score</span>;
  return null;
}

export function progressText(run: EvalRun) {
  const done = run.attemptCount ?? 0;
  return run.sampleCount ? `${done} of ${run.sampleCount}` : String(done);
}

/** The run's total cost, as the route reported it: "$0.0123". */
export function costShort(run: EvalRun) {
  const cost = run.provenance?.costUsd;
  return cost !== undefined && cost !== null ? `$${cost.toFixed(4)}` : undefined;
}

/** Runs as a table. `show` picks the column that names the other side: the eval or the model. */
export function RunTable({ runs, show }: { runs: RunListItem[]; show: 'eval' | 'model' }) {
  const rows = (list: RunListItem[]) =>
    list.map(({ run, eval: e, model, version, result }) => (
      <tr key={run.id} className="hover:bg-slate-50">
        <td className="px-2 py-1">
          <Link href={runPath(run)} className="text-sky-800 hover:underline">
            {show === 'eval' ? `${e.displayName} (${version})` : model.displayName}
          </Link>
          <OriginTag run={run} />
          {show === 'eval' && <EvalStatusTag status={e.status} className="ml-1.5" />}
        </td>
        <td className="px-2 py-1 text-slate-600">{runSettingsText(run)}</td>
        <td className="px-2 py-1">
          <RunStatusBadge status={run.status} />
          {ACTIVE.includes(run.status) && (
            <span className="ml-1.5 text-slate-500 tabular-nums">{progressText(run)}</span>
          )}
        </td>
        <td className="px-2 py-1 text-right whitespace-nowrap text-slate-800 tabular-nums">
          {result ? (
            <>
              <ResultValue result={result} round />
              <span className="ml-1 text-slate-400">{result.metric}</span>
            </>
          ) : (
            '—'
          )}
        </td>
        <td className="hidden px-2 py-1 text-slate-500 sm:table-cell">
          <LocalTime value={run.createdAt} />
        </td>
      </tr>
    ));
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-2 py-1.5 font-medium">{show === 'eval' ? 'Evaluation' : 'Model'}</th>
            <th className="px-2 py-1.5 font-medium">Settings</th>
            <th className="px-2 py-1.5 font-medium">Status</th>
            <th className="px-2 py-1.5 text-right font-medium">Result</th>
            <th className="hidden px-2 py-1.5 font-medium sm:table-cell">Started</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{rows(runs)}</tbody>
      </table>
    </div>
  );
}
