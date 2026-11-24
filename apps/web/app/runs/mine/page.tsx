import { EvalStatusTag } from '@/components/catalog/eval-status';
import Link from '@/components/link';
import { LocalTime } from '@/components/local-time';
import { Page, PageHeader } from '@/components/page';
import { AutoRefresh } from '@/components/runs/auto-refresh';
import { ACTIVE, OriginTag, RunStatusBadge, costShort, progressText, runSettingsText } from '@/components/runs/parts';
import { Section } from '@/components/section';
import { durationText, runSecondsLeft } from '@/lib/server/estimates';
import { ownRuns, runPath } from '@/lib/server/runs';
import { requireViewer } from '@/lib/server/viewer';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'My Evals', robots: { index: false, follow: false } };

export default async function MyRunsPage() {
  const viewer = await requireViewer('/runs/mine');
  const runs = await ownRuns(viewer.id);
  const left = await Promise.all(
    runs.map((r) =>
      ACTIVE.includes(r.run.status)
        ? runSecondsLeft({
            evalId: r.run.evalId,
            evalVersionId: r.run.evalVersionId,
            status: r.run.status,
            settings: r.run.settings,
            startedAt: r.startedAt,
            attemptCount: r.run.attemptCount ?? 0,
            sampleCount: r.run.sampleCount ?? null,
          })
        : null,
    ),
  );
  const th = 'px-2 py-1.5 font-medium whitespace-nowrap';
  return (
    <Page>
      <PageHeader
        title="My Evals"
        description="The runs you enqueued, newest first. We email you when each run finishes."
      />
      <AutoRefresh active={runs.some((r) => ACTIVE.includes(r.run.status))} />
      <Section title={`Runs (${runs.length})`}>
        {runs.length === 0 ? (
          <p className="text-sm text-slate-500">You have no runs yet. Enqueue one from a model page.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className={th}>Run</th>
                  <th className={th}>Status</th>
                  <th className={th}>Time left</th>
                  <th className={`${th} text-right`}>Cost</th>
                  <th className={`${th} hidden sm:table-cell`}>Queued</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.map((r, i) => {
                  const active = ACTIVE.includes(r.run.status);
                  const s = left[i];
                  return (
                    <tr key={r.run.id} className="hover:bg-slate-50">
                      <td className="px-2 py-1">
                        <Link href={runPath(r.run)} className="text-sky-800 hover:underline">
                          {r.eval.displayName} on {r.model.displayName}
                        </Link>
                        <OriginTag run={r.run} />
                        <EvalStatusTag status={r.eval.status} className="ml-1.5" />
                        <div className="text-slate-400">{runSettingsText(r.run)}</div>
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        <RunStatusBadge status={r.run.status} />
                        {active && <span className="ml-1.5 text-slate-500 tabular-nums">{progressText(r.run)}</span>}
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap text-slate-600">
                        {!active ? '—' : s === null ? 'No estimate yet' : durationText(s)}
                      </td>
                      <td className="px-2 py-1 text-right text-slate-600 tabular-nums">{costShort(r.run) ?? '—'}</td>
                      <td className="hidden px-2 py-1 whitespace-nowrap text-slate-500 sm:table-cell">
                        <LocalTime value={r.run.createdAt} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </Page>
  );
}
