import { Section } from '@/components/catalog/parts';
import { PanelReviewButtons } from '@/components/deploymeter/panel-review-buttons';
import { ScoreRing, VerdictChip } from '@/components/deploymeter/score-ring';
import Link from '@/components/link';
import { LocalTime } from '@/components/local-time';
import { Page, PageHeader } from '@/components/page';
import { adminPanels, type AdminPanel } from '@/lib/server/deploymeter';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Deploymeter', robots: { index: false, follow: false } };

// Admins only. Other viewers get 404, so the page does not show that it exists.
export default async function AdminDeploymeterPage() {
  if (!isAdmin(await getViewer())) notFound();
  const panels = await adminPanels();
  const drafts = panels.filter((p) => p.status === 'draft');
  const published = panels.filter((p) => p.status === 'published');
  return (
    <Page>
      <PageHeader
        eyebrow={
          <Link href="/admin" className="hover:text-sky-700">
            Admin
          </Link>
        }
        title="Deploymeter"
        description="AI judge panels. The runner saves each panel as a draft. Only admins see a draft until one publishes it. Publish replaces the model's published panel; the older one stays in the judge history."
      />
      <Section title={`Drafts (${drafts.length})`}>
        <PanelTable panels={drafts} />
      </Section>
      <Section title={`Published (${published.length})`}>
        <PanelTable panels={published} />
      </Section>
    </Page>
  );
}

function PanelTable({ panels }: { panels: AdminPanel[] }) {
  if (!panels.length) return <p className="text-sm text-slate-500">None.</p>;
  const th = 'px-2 py-1.5 font-medium whitespace-nowrap';
  const td = 'px-2 py-1 align-middle';
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className={th}>Model</th>
            <th className={th}>Score</th>
            <th className={th}>Panel</th>
            <th className={cn(th, 'text-right')}>Judges</th>
            <th className={cn(th, 'text-right')}>Guessed</th>
            <th className={cn(th, 'text-right')}>Cost</th>
            <th className={th}>Made</th>
            <th className={th} />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {panels.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50">
              <td className={td}>
                <Link href={p.model.href} className="font-medium text-slate-800 hover:text-sky-800 hover:underline">
                  {p.model.displayName}
                </Link>
                <div className="text-slate-500">{p.model.organization.displayName}</div>
              </td>
              <td className={td}>
                <span className="flex items-center gap-x-2">
                  <ScoreRing score={p.meter} size="sm" />
                  {p.meter !== null && <VerdictChip score={p.meter} />}
                </span>
              </td>
              <td className={cn(td, 'whitespace-nowrap text-slate-600')}>
                {p.number} · OpenAudit V{p.cardVersion}
              </td>
              <td className={cn(td, 'text-right whitespace-nowrap text-slate-600 tabular-nums')}>
                {p.counted} of {p.judges} count
                {p.abstained > 0 && <div className="text-slate-500">{p.abstained} abstained</div>}
                {p.failed > 0 && <div className="text-rose-700">{p.failed} failed</div>}
              </td>
              <td className={cn(td, 'text-right whitespace-nowrap text-slate-600 tabular-nums')}>
                {p.guesses ? `${p.guessed} of ${p.guesses}` : '—'}
              </td>
              <td className={cn(td, 'text-right text-slate-600 tabular-nums')}>${p.costUsd.toFixed(2)}</td>
              <td className={cn(td, 'whitespace-nowrap text-slate-500')}>
                <LocalTime value={p.createdAt} />
              </td>
              <td className={td}>
                {p.status === 'draft' && (
                  <PanelReviewButtons panelId={p.id} label={`${p.model.displayName} panel ${p.number}`} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
