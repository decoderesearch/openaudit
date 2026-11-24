import { Page, PageHeader } from '@/components/page';
import { readConfirmToken } from '@/lib/server/updates';
import { UPDATE_LISTS } from '@/lib/updates';
import type { Metadata } from 'next';
import ConfirmForm from './confirm-form';

export const metadata: Metadata = { title: 'Confirm updates', robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ t?: string }> };

/** The page that a confirm email links to. Nothing changes until the person presses Confirm. */
export default async function ConfirmUpdatesPage({ searchParams }: Props) {
  const { t = '' } = await searchParams;
  const req = await readConfirmToken(t);
  return (
    <Page width="narrow">
      <PageHeader title="Confirm email updates" />
      {req ? (
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-700">
          <p>
            Send updates to <span className="font-medium text-slate-900">{req.email}</span>, at most one email per week:
          </p>
          <ul className="flex flex-col gap-2">
            {UPDATE_LISTS.filter((l) => req.lists.includes(l.id)).map((l) => (
              <li key={l.id}>
                <span className="font-medium text-slate-900">{l.label}</span>
                <span className="text-slate-500"> · {l.description}</span>
              </li>
            ))}
          </ul>
          <ConfirmForm token={t} />
        </div>
      ) : (
        <p className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-700">
          This link is not valid or it expired. Use Updates in the menu bar to get a new link.
        </p>
      )}
    </Page>
  );
}
