import Link from '@/components/link';
import { Page, PageHeader } from '@/components/page';
import { adminSummary } from '@/lib/server/admin-summary';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// Admins only. Other viewers get 404, so the page does not show that it exists.
export default async function AdminPage() {
  if (!isAdmin(await getViewer())) notFound();
  const s = await adminSummary();
  const tiles = [
    {
      href: '/admin/runs',
      title: 'Run queue',
      text: 'Approve requests, and watch runs that wait, run or failed.',
      stat: `${plural(s.requested, 'request')} to approve · ${s.active} active`,
      alert: s.requested > 0,
    },
    {
      href: '/admin/cards',
      title: 'OpenAudits',
      text: 'See the state of each OpenAudit, and rebuild them.',
      stat: `${plural(s.cardDrafts, 'draft')} to review · ${s.failedCards ? `${plural(s.failedCards, 'card')} with an error` : 'No card errors'}`,
      alert: s.cardDrafts > 0 || s.failedCards > 0,
    },
    {
      href: '/admin/deploymeter',
      title: 'Deploymeter',
      text: 'Publish or discard the AI judge panels.',
      stat: `${plural(s.panelDrafts, 'draft')} to review · ${s.panels} published`,
      alert: s.panelDrafts > 0,
    },
    {
      href: '/admin/submissions',
      title: 'Submissions',
      text: 'Read what people sent with the Submit form, and set its status.',
      stat: `${plural(s.newSubmissions, 'new submission')} · ${s.openSubmissions} open`,
      alert: s.newSubmissions > 0,
    },
    {
      href: '/admin/known-errors',
      title: 'Known errors',
      text: 'Confirm or reject the dataset errors that reviews found in eval samples.',
      stat: `${plural(s.proposedIssues, 'issue')} to review · ${s.confirmedIssues} confirmed`,
      alert: s.proposedIssues > 0,
    },
    {
      href: '/admin/organizations',
      title: 'Organizations',
      text: 'Hide an organization and its models from the public, or show them again.',
      stat: `${plural(s.orgs, 'organization')} · ${s.hiddenOrgs} hidden`,
      alert: false,
    },
    {
      href: '/admin/users',
      title: 'Users',
      text: 'Set the role of a user: none, moderator or admin.',
      stat: `${plural(s.users, 'user')} · ${s.staff} with a role`,
      alert: false,
    },
    {
      href: '/admin/sync',
      title: 'Sync to production',
      text: 'Local only. See which eval runs and cards production lacks, and copy them.',
      stat: 'Shows the difference first',
      alert: false,
    },
  ];
  return (
    <Page>
      <PageHeader title="Admin" description="Pages for site admins only." />
      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4 hover:border-sky-300 hover:bg-sky-50/40"
          >
            <span className="text-sm font-semibold text-slate-800">{t.title}</span>
            <span className="text-xs text-slate-500">{t.text}</span>
            <span className={cn('mt-2 text-xs font-medium', t.alert ? 'text-amber-700' : 'text-slate-600')}>
              {t.stat}
            </span>
          </Link>
        ))}
      </div>
    </Page>
  );
}
