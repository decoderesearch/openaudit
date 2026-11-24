import { ProdSyncButton } from '@/components/admin/prod-sync-button';
import { Section } from '@/components/catalog/parts';
import Link from '@/components/link';
import { LocalTime } from '@/components/local-time';
import { Page, PageHeader } from '@/components/page';
import {
  prodSyncDiff,
  prodSyncOff,
  SYNC_CARDS,
  SYNC_PANELS,
  SYNC_RUNS,
  type CardDiff,
  type CardState,
  type PanelDiff,
  type PanelState,
  type RunDiff,
  type RunState,
  type SyncDiff,
} from '@/lib/server/prod-sync';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: 'Sync to production', robots: { index: false, follow: false } };

const RUN_LABEL: Record<RunState, string> = {
  new: 'New',
  changed: 'Changed on dev',
  same: 'Same',
  'prod-newer': 'Newer on production',
  unfinished: 'Not finished',
  blocked: 'Cannot sync',
  'prod-only': 'Only on production',
};

const CARD_LABEL: Record<CardState, string> = {
  new: 'New',
  newer: 'New versions',
  same: 'Same',
  'prod-built': 'Built on production',
  busy: 'Building on production',
  blocked: 'Cannot sync',
  'prod-only': 'Only on production',
};

const PANEL_LABEL: Record<PanelState, string> = {
  new: 'New',
  newer: 'New panels',
  same: 'Same',
  'prod-built': 'Made on production',
  blocked: 'Cannot sync',
  'prod-only': 'Only on production',
};

// Admins only, on a local server. Other viewers get 404, so the page does not show that it exists.
export default async function AdminSyncPage() {
  if (!isAdmin(await getViewer())) notFound();
  const off = prodSyncOff();
  let diff: SyncDiff | null = null;
  let error = off;
  if (!off) {
    try {
      diff = await prodSyncDiff();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
  return (
    <Page>
      <PageHeader
        eyebrow={
          <Link href="/admin" className="hover:text-sky-700">
            Admin
          </Link>
        }
        title="Sync to production"
        description="Copies finished eval runs, OpenAudit versions and Deploymeter panels from this database to production. Ids stay the same, so transcripts in R2 stay valid. Seed data does not sync here: use pnpm seed:import."
      />
      {error && <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {diff && <Diff diff={diff} />}
    </Page>
  );
}

function Diff({ diff }: { diff: SyncDiff }) {
  const sync = diff.runs.filter((r) => SYNC_RUNS.includes(r.state));
  const skipped = diff.runs.filter((r) => ['blocked', 'unfinished', 'prod-newer'].includes(r.state));
  const prodOnly = diff.runs.filter((r) => r.state === 'prod-only');
  const same = diff.runs.filter((r) => r.state === 'same').length;
  const cards = diff.cards.filter((c) => c.state !== 'same');
  const versions = diff.cards
    .filter((c) => SYNC_CARDS.includes(c.state))
    .reduce((n, c) => n + c.dev.length - c.prod.length, 0);
  const panelDiffs = diff.panels.filter((p) => p.state !== 'same');
  const panels = diff.panels
    .filter((p) => SYNC_PANELS.includes(p.state))
    .reduce((n, p) => n + p.dev.length - p.prod.length, 0);
  const attempts = sync.reduce((n, r) => n + (r.dev?.attempts ?? 0), 0);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-3 text-sm">
        <div className="text-slate-600">
          <span className="font-mono text-xs text-slate-800">{diff.source}</span> to{' '}
          <span className="font-medium text-slate-800">{diff.target}</span>
          <div className="mt-1 text-xs text-slate-500">
            {sync.length} runs to sync · {versions} card versions to sync · {panels} Deploymeter panels to sync · {same}{' '}
            runs the same · {skipped.length} not synced · {prodOnly.length} only on production
          </div>
        </div>
        {!diff.blockers.length && (
          <ProdSyncButton runs={sync.length} attempts={attempts} versions={versions} panels={panels} />
        )}
      </div>
      {diff.blockers.length > 0 && (
        <ul className="list-disc rounded-md border border-rose-200 bg-rose-50 py-2 pr-3 pl-7 text-sm text-rose-800">
          {diff.blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      <Section title={`Runs to sync (${sync.length})`}>
        <RunTable runs={sync} />
      </Section>
      <Section title={`Cards that differ (${cards.length})`}>
        <CardTable cards={cards} />
      </Section>
      <Section title={`Deploymeters that differ (${panelDiffs.length})`}>
        <PanelTable panels={panelDiffs} />
      </Section>
      <Section title={`Runs not synced (${skipped.length})`}>
        <RunTable runs={skipped} />
      </Section>
      <Section title={`Runs only on production (${prodOnly.length})`}>
        <RunTable runs={prodOnly} />
      </Section>
    </>
  );
}

const th = 'px-2 py-1.5 font-medium whitespace-nowrap';
const td = 'px-2 py-1 align-top';

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            {head.map((h, i) => (
              <th key={i} className={cn(th, /^(Dev|Production)/.test(h) && 'text-right')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

const attemptsOf = (c?: { attempts: number; results: number }) =>
  c ? `${c.attempts.toLocaleString()} / ${c.results}` : '—';

function RunTable({ runs }: { runs: RunDiff[] }) {
  if (!runs.length) return <p className="text-sm text-slate-500">None.</p>;
  return (
    <Table
      head={['Model', 'Eval', 'Status', 'Finished', 'Dev attempts / results', 'Production attempts / results', 'State']}
    >
      {runs.map((r) => (
        <tr key={r.id} className="hover:bg-slate-50">
          <td className={td}>
            <Link href={`/runs/${r.id}`} className="font-medium text-slate-800 hover:underline">
              {r.model}
            </Link>
          </td>
          <td className={cn(td, 'font-mono')}>{r.eval}</td>
          <td className={cn(td, 'whitespace-nowrap text-slate-600')}>
            {r.status}
            {r.visibility !== 'public' && <span className="ml-1 text-slate-400">({r.visibility})</span>}
          </td>
          <td className={cn(td, 'whitespace-nowrap text-slate-500')}>
            {r.finishedAt ? <LocalTime value={r.finishedAt} /> : '—'}
          </td>
          <td className={cn(td, 'text-right tabular-nums')}>{attemptsOf(r.dev)}</td>
          <td className={cn(td, 'text-right tabular-nums')}>{attemptsOf(r.prod)}</td>
          <td className={td}>
            <span className={cn('font-medium', r.state === 'blocked' ? 'text-rose-700' : 'text-slate-700')}>
              {RUN_LABEL[r.state]}
            </span>
            {r.reason && <div className="max-w-72 text-slate-500">{r.reason}</div>}
          </td>
        </tr>
      ))}
    </Table>
  );
}

const versionsOf = (n: number[]) => (n.length ? `v${n[0]}–v${n.at(-1)} (${n.length})` : '—');

function CardTable({ cards }: { cards: CardDiff[] }) {
  if (!cards.length) return <p className="text-sm text-slate-500">None.</p>;
  return (
    <Table head={['Model', 'Dev versions', 'Production versions', 'State']}>
      {cards.map((c) => (
        <tr key={c.model} className="hover:bg-slate-50">
          <td className={cn(td, 'font-medium text-slate-800')}>{c.model}</td>
          <td className={cn(td, 'text-right tabular-nums')}>{versionsOf(c.dev)}</td>
          <td className={cn(td, 'text-right tabular-nums')}>{versionsOf(c.prod)}</td>
          <td className={td}>
            <span className={cn('font-medium', c.state === 'blocked' ? 'text-rose-700' : 'text-slate-700')}>
              {CARD_LABEL[c.state]}
            </span>
            {c.reason && <div className="max-w-72 text-slate-500">{c.reason}</div>}
          </td>
        </tr>
      ))}
    </Table>
  );
}

const panelsOf = (n: number[]) => (n.length ? n.map((x) => `#${x}`).join(', ') : '—');

function PanelTable({ panels }: { panels: PanelDiff[] }) {
  if (!panels.length) return <p className="text-sm text-slate-500">None.</p>;
  return (
    <Table head={['Model', 'Dev panels', 'Production panels', 'State']}>
      {panels.map((p) => (
        <tr key={p.model} className="hover:bg-slate-50">
          <td className={cn(td, 'font-medium text-slate-800')}>{p.model}</td>
          <td className={cn(td, 'text-right tabular-nums')}>{panelsOf(p.dev)}</td>
          <td className={cn(td, 'text-right tabular-nums')}>{panelsOf(p.prod)}</td>
          <td className={td}>
            <span className={cn('font-medium', p.state === 'blocked' ? 'text-rose-700' : 'text-slate-700')}>
              {PANEL_LABEL[p.state]}
            </span>
            {p.reason && <div className="max-w-72 text-slate-500">{p.reason}</div>}
          </td>
        </tr>
      ))}
    </Table>
  );
}
