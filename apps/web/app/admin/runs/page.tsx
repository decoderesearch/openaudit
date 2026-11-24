import { Section } from '@/components/catalog/parts';
import Link from '@/components/link';
import { LocalTime } from '@/components/local-time';
import { Page, PageHeader } from '@/components/page';
import { AutoRefresh } from '@/components/runs/auto-refresh';
import { CancelRunButton } from '@/components/runs/cancel-run-button';
import { RunStatusBadge, costShort, progressText, runSettingsText } from '@/components/runs/parts';
import { ApproveButton, DeclineButton } from '@/components/runs/request-buttons';
import { shortDuration } from '@/lib/runs/duration';
import { estimateRequests, type RequestEstimate } from '@/lib/server/run-requests';
import { adminRuns, runPath, type AdminRun, type RequestedRun } from '@/lib/server/runs';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Run queue', robots: { index: false, follow: false } };

// Admins only. Other viewers get 404, so the page does not show that it exists.
export default async function AdminRunsPage() {
  if (!isAdmin(await getViewer())) notFound();
  const { requested, queued, running, failed, cancelled } = await adminRuns();
  const estimates = await estimateRequests(requested.map((r) => r.run));
  const totalUsd = estimates.reduce((sum, e) => sum + (e.costUsd ?? 0), 0);
  const now = new Date();
  return (
    <Page>
      <PageHeader
        eyebrow={
          <Link href="/admin" className="hover:text-sky-700">
            Admin
          </Link>
        }
        title="Run queue"
        description="Requests to approve, runs that wait or run now, and the newest runs that failed or were cancelled."
      />
      <AutoRefresh active={queued.length + running.length > 0} />
      <Section title={`Waiting for approval (${requested.length})`}>
        {requested.length > 1 && (
          <div>
            <ApproveButton
              runIds={requested.map((r) => r.run.id)}
              label={`Approve all ${requested.length} · est. ${usdShort(totalUsd)}`}
              confirm={`Approve and queue all ${requested.length} requests? Our estimated cost is ${usdShort(totalUsd)}.`}
            />
          </div>
        )}
        <RequestTable runs={requested} estimates={estimates} />
      </Section>
      <Section title={`Running (${running.length})`}>
        <QueueTable runs={running} now={now} cancel />
      </Section>
      <Section title={`Queued (${queued.length})`}>
        <QueueTable runs={queued} now={now} cancel />
      </Section>
      <Section title={`Failed, newest ${failed.length}`}>
        <QueueTable runs={failed} now={now} />
      </Section>
      <Section title={`Cancelled, newest ${cancelled.length}`}>
        <QueueTable runs={cancelled} now={now} />
      </Section>
    </Page>
  );
}

const shardText = (shards: Record<string, number>) =>
  Object.entries(shards)
    .map(([status, n]) => `${n} ${status}`)
    .join(', ');

const usdShort = (dollars: number) => `$${dollars.toFixed(2)}`;

function QueueTable({ runs, now, cancel }: { runs: AdminRun[]; now: Date; cancel?: boolean }) {
  if (!runs.length) return <p className="text-sm text-slate-500">None.</p>;
  const th = 'px-2 py-1.5 font-medium whitespace-nowrap';
  const td = 'px-2 py-1 align-top';
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className={th}>Run</th>
            <th className={th}>Owner</th>
            <th className={th}>Status</th>
            <th className={th}>Created</th>
            <th className={th}>Started</th>
            <th className={th}>Lease</th>
            <th className={cn(th, 'text-right')}>Tries</th>
            <th className={th}>Shards</th>
            <th className={cn(th, 'text-right')}>Cost</th>
            <th className={th}>Error</th>
            {cancel && <th className={th} />}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {runs.map((r) => {
            const stale = !!r.leaseExpiresAt && r.leaseExpiresAt < now && r.run.status !== 'queued';
            return (
              <tr key={r.run.id} className="hover:bg-slate-50">
                <td className={td}>
                  <Link href={runPath(r.run)} className="text-sky-800 hover:underline">
                    {r.eval.displayName} ({r.version})
                  </Link>
                  <div className="text-slate-600">{r.model.name}</div>
                  <div className="text-slate-400">{runSettingsText(r.run)}</div>
                </td>
                <td className={cn(td, 'text-slate-600')}>{r.ownerEmail ?? '—'}</td>
                <td className={cn(td, 'whitespace-nowrap')}>
                  <RunStatusBadge status={r.run.status} />
                  <span className="ml-1.5 text-slate-500 tabular-nums">{progressText(r.run)}</span>
                </td>
                <td className={cn(td, 'whitespace-nowrap text-slate-500')}>
                  <LocalTime value={r.run.createdAt} />
                </td>
                <td className={cn(td, 'whitespace-nowrap text-slate-500')}>
                  {r.startedAt ? <LocalTime value={r.startedAt} /> : '—'}
                </td>
                <td className={cn(td, 'whitespace-nowrap')}>
                  {r.leaseOwner ? (
                    <>
                      <div className="font-mono text-slate-600">{r.leaseOwner}</div>
                      {r.leaseExpiresAt && (
                        <div className={stale ? 'font-medium text-rose-700' : 'text-slate-500'}>
                          {stale ? 'Expired ' : 'Until '}
                          <LocalTime value={r.leaseExpiresAt} />
                        </div>
                      )}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className={cn(td, 'text-right text-slate-600 tabular-nums')}>{r.tries}</td>
                <td className={cn(td, 'whitespace-nowrap text-slate-600')}>{shardText(r.shards) || '—'}</td>
                <td className={cn(td, 'text-right text-slate-600 tabular-nums')}>{costShort(r.run) ?? '—'}</td>
                <td className={cn(td, 'max-w-72 font-mono break-words text-rose-800')}>{r.run.error}</td>
                {cancel && (
                  <td className={td}>
                    <CancelRunButton runId={r.run.id} label={`${r.eval.displayName} on ${r.model.name}`} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Requests from users: who asked, our estimated cost, and Approve or Decline. */
function RequestTable({ runs, estimates }: { runs: RequestedRun[]; estimates: RequestEstimate[] }) {
  if (!runs.length) return <p className="text-sm text-slate-500">None.</p>;
  const th = 'px-2 py-1.5 font-medium whitespace-nowrap';
  const td = 'px-2 py-1 align-top';
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className={th}>Run</th>
            <th className={th}>Requested by</th>
            <th className={th}>Requested</th>
            <th className={cn(th, 'text-right')}>Est. cost</th>
            <th className={th}>Est. time</th>
            <th className={th} />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {runs.map((r, i) => {
            const e = estimates[i];
            const label = `${r.eval.displayName} on ${r.model.name}`;
            const u = r.owner;
            return (
              <tr key={r.run.id} className="hover:bg-slate-50">
                <td className={td}>
                  <Link href={runPath(r.run)} className="text-sky-800 hover:underline">
                    {r.eval.displayName} ({r.version})
                  </Link>
                  <div className="text-slate-600">{r.model.name}</div>
                  <div className="text-slate-400">{runSettingsText(r.run)}</div>
                </td>
                <td className={cn(td, 'text-slate-600')}>
                  {u ? (
                    <>
                      <div className="font-medium text-slate-800">
                        {u.name}
                        {u.username && <span className="ml-1 font-normal text-slate-500">@{u.username}</span>}
                      </div>
                      <div>{u.email}</div>
                      {u.affiliation && <div>{u.affiliation}</div>}
                      {u.website && /^https?:\/\//.test(u.website) && (
                        <a href={u.website} target="_blank" rel="noreferrer" className="text-sky-800 hover:underline">
                          {u.website}
                        </a>
                      )}
                      <div className="text-slate-400">
                        Joined <LocalTime value={u.createdAt} mode="date" />, {u._count.runs} finished{' '}
                        {u._count.runs === 1 ? 'run' : 'runs'}
                      </div>
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className={cn(td, 'whitespace-nowrap text-slate-500')}>
                  <LocalTime value={r.run.createdAt} />
                </td>
                <td className={cn(td, 'text-right whitespace-nowrap text-slate-600 tabular-nums')}>
                  {e.costUsd !== null ? usdShort(e.costUsd) : <span className="text-rose-700">{e.error}</span>}
                </td>
                <td className={cn(td, 'whitespace-nowrap text-slate-600')}>
                  {e.seconds !== null ? shortDuration(e.seconds) : '—'}
                </td>
                <td className={cn(td, 'whitespace-nowrap')}>
                  <div className="flex gap-1.5">
                    <ApproveButton runIds={[r.run.id]} label="Approve" />
                    <DeclineButton runId={r.run.id} label={label} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
