import { SendDigestButton } from '@/app/admin/updates/send-button';
import { Section } from '@/components/catalog/parts';
import Link from '@/components/link';
import { LocalTime } from '@/components/local-time';
import { Page, PageHeader } from '@/components/page';
import { recentDigests, runDigest, updatesSendOn } from '@/lib/server/update-digest';
import { segmentSizes, updatesOff } from '@/lib/server/updates';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Email updates', robots: { index: false, follow: false } };

// Admins only. Other viewers get 404, so the page does not show that it exists.
export default async function AdminUpdatesPage() {
  if (!isAdmin(await getViewer())) notFound();
  const off = updatesOff();
  const [preview, history, sizes] = await Promise.all([
    runDigest({ send: false }),
    recentDigests(),
    off ? Promise.resolve(null) : segmentSizes().catch((e: Error) => e),
  ]);
  const sendOn = updatesSendOn();
  return (
    <Page>
      <PageHeader
        eyebrow={
          <Link href="/admin" className="hover:text-sky-700">
            Admin
          </Link>
        }
        title="Email updates"
        description="Each day at 15:00 UTC, subscribers get one email with what we added since the last email. Each list with nothing new is left out. A person with no news gets no email."
      />
      <Section title="Subscribers">
        {off ? (
          <p className="text-sm text-rose-700">{off}</p>
        ) : sizes instanceof Error ? (
          <p className="text-sm text-rose-700">{sizes.message}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {sizes?.map((s) => (
              <li key={s.segment}>
                <span className="font-medium">{s.segment}</span>: {s.contacts}
                {s.more ? '+' : ''}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section
        title="Next email"
        actions={sendOn ? <SendDigestButton /> : <span className="text-xs text-slate-500">Sending is off here</span>}
      >
        <p className="mb-3 text-sm text-slate-600">
          Covers <LocalTime value={preview.since} /> to now.{' '}
          {Object.entries(preview.counts)
            .map(([k, n]) => `${k}: ${n}`)
            .join(' · ')}
        </p>
        {preview.emails.length ? (
          <div className="space-y-6">
            {preview.emails.map((e) => (
              <div key={e.segment}>
                <p className="text-sm font-medium">{e.segment}</p>
                <p className="mb-2 text-xs text-slate-500">Subject: {e.email.subject}</p>
                <iframe
                  title={e.segment}
                  srcDoc={e.email.html}
                  sandbox=""
                  className="h-[480px] w-full rounded-md border border-slate-200 bg-white"
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Nothing new. No email goes out.</p>
        )}
      </Section>
      <Section title="Sent">
        {history.length ? (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-1 pr-4 font-medium">Day</th>
                <th className="py-1 pr-4 font-medium">Broadcasts</th>
                <th className="py-1 pr-4 font-medium">Items</th>
                <th className="py-1 font-medium">State</th>
              </tr>
            </thead>
            <tbody>
              {history.map((d) => {
                const broadcasts = Object.keys((d.broadcasts ?? {}) as Record<string, string>);
                const items = Object.values((d.counts ?? {}) as Record<string, number>).reduce((a, b) => a + b, 0);
                return (
                  <tr key={d.id} className="border-t border-slate-100 align-top">
                    <td className="py-1.5 pr-4 tabular-nums">{d.day}</td>
                    <td className="py-1.5 pr-4">{broadcasts.join(', ') || 'None'}</td>
                    <td className="py-1.5 pr-4 tabular-nums">{items}</td>
                    <td className="py-1.5">
                      {d.error ? (
                        <span className="text-rose-700">Failed: {d.error}</span>
                      ) : d.sentAt ? (
                        <LocalTime value={d.sentAt} />
                      ) : (
                        <span className="text-amber-800">Sending</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-500">No email sent yet.</p>
        )}
      </Section>
    </Page>
  );
}
