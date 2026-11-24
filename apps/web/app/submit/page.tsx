import { SubmitPageForm } from '@/components/nav/report-dialog';
import { Page, PageTitle } from '@/components/page';
import { submitPreset } from '@/lib/report';
import { navMethods } from '@/lib/server/nav-methods';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Submit' };

/** The submission form on its own page. `#<type>` or `?type=<type>` picks the type, and the other
 * query values fill in the type's text fields. */
export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === 'string') q.set(k, v);
  const methods = await navMethods().catch(() => null);
  return (
    <Page className="flex-1 gap-y-6 pb-4">
      <PageTitle className="text-center">New Submission</PageTitle>
      <SubmitPageForm start={submitPreset('', q.toString())} methods={methods?.methods} />
    </Page>
  );
}
