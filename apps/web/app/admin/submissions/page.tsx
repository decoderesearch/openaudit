import { SubmissionControl } from '@/components/admin/submission-control';
import { Section } from '@/components/catalog/parts';
import Link from '@/components/link';
import { Page, PageHeader } from '@/components/page';
import {
  isSubmissionStatus,
  reportLabel,
  shownFields,
  SUBMISSION_STATUSES,
  submissionRef,
  type ReportType,
} from '@/lib/report';
import { adminSubmissions } from '@/lib/server/submissions-admin';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Submissions', robots: { index: false, follow: false } };

const DATE = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });

// Admins only. Other viewers get 404, so the page does not show that it exists.
export default async function AdminSubmissionsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  if (!isAdmin(await getViewer())) notFound();
  const q = (await searchParams).status;
  const status = isSubmissionStatus(q) ? q : null;
  const { rows, byStatus } = await adminSubmissions(status);
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const tab = (href: string, label: string, n: number, on: boolean) => (
    <Link
      key={href}
      href={href}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium',
        on ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50',
      )}
    >
      {label} <span className="text-slate-400 tabular-nums">{n}</span>
    </Link>
  );
  return (
    <Page>
      <PageHeader
        eyebrow={
          <Link href="/admin" className="hover:text-sky-700">
            Admin
          </Link>
        }
        title="Submissions"
        description="What people sent with the Submit form. Reply by email from the support inbox, then set the status. Senders do not see the status or the note."
      />
      <div className="flex flex-wrap gap-1.5">
        {tab('/admin/submissions', 'All', total, !status)}
        {SUBMISSION_STATUSES.map((s) =>
          tab(`/admin/submissions?status=${s.id}`, s.label, byStatus[s.id], status === s.id),
        )}
      </div>
      <Section title={`${status ? SUBMISSION_STATUSES.find((s) => s.id === status)!.label : 'All'} (${rows.length})`}>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">No submissions.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((r) => {
              const ref = submissionRef(r.number);
              const fields = shownFields(r.type as ReportType, r.fields);
              return (
                <li
                  key={r.id}
                  id={ref}
                  className="grid scroll-mt-20 gap-4 rounded-md border border-slate-200 bg-white p-3 target:border-sky-400 md:grid-cols-[minmax(0,1fr)_14rem]"
                >
                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-800">{ref}</span>
                      <span className="font-medium text-slate-700">{reportLabel(r.type as ReportType)}</span>
                      <span>{DATE.format(r.createdAt)} UTC</span>
                      {r.email ? (
                        <a
                          href={`mailto:${r.email}?subject=${encodeURIComponent(`Re: ${ref}`)}`}
                          className="text-sky-800 hover:underline"
                        >
                          {r.email}
                        </a>
                      ) : (
                        <span>Anonymous</span>
                      )}
                      {r.page && (
                        <Link href={r.page} hover={false} className="truncate text-sky-800 hover:underline">
                          {r.page}
                        </Link>
                      )}
                    </div>
                    {fields.length > 0 && (
                      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-xs">
                        {fields.map((f) => (
                          <div key={f.label} className="contents">
                            <dt className="text-slate-500">{f.label}</dt>
                            <dd className="break-words whitespace-pre-wrap text-slate-800">{f.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    <p className="max-h-72 overflow-y-auto text-sm break-words whitespace-pre-wrap text-slate-800">
                      {r.body}
                    </p>
                  </div>
                  <SubmissionControl id={r.id} status={r.status} note={r.note ?? ''} />
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </Page>
  );
}
