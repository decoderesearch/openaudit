import { Page, PageHeader } from '@/components/page';
import { readUnsubscribeToken } from '@/lib/server/updates';
import type { Metadata } from 'next';
import UnsubscribeForm from './unsubscribe-form';

export const metadata: Metadata = { title: 'Unsubscribe', robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ t?: string }> };

/** The page that an email's unsubscribe link opens. Nothing changes until the person presses
 * Unsubscribe, as mail scanners open links. */
export default async function UnsubscribePage({ searchParams }: Props) {
  const { t = '' } = await searchParams;
  const email = await readUnsubscribeToken(t);
  return (
    <Page width="narrow">
      <PageHeader title="Unsubscribe from email updates" />
      {email ? (
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-700">
          <p>
            Send no more update emails to <span className="font-medium text-slate-900">{email}</span>.
          </p>
          <UnsubscribeForm token={t} />
        </div>
      ) : (
        <p className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-700">
          This link is not valid. Use the unsubscribe link in one of our emails.
        </p>
      )}
    </Page>
  );
}
