import { KnownErrorsTable } from '@/components/catalog/known-errors-table';
import Link from '@/components/link';
import { Page, PageHeader } from '@/components/page';
import { allIssues } from '@/lib/server/sample-issues';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Known errors', robots: { index: false, follow: false } };

// Admins only. Other viewers get 404, so the page does not show that it exists.
export default async function AdminKnownErrorsPage() {
  if (!isAdmin(await getViewer())) notFound();
  const issues = await allIssues(true);
  return (
    <Page>
      <PageHeader
        eyebrow={
          <Link href="/admin" className="hover:text-sky-700">
            Admin
          </Link>
        }
        title="Known errors"
        description="Dataset errors in the samples of all evals. Confirm the true ones: the eval pages then leave them out of the adjusted pass rate. See EVAL_KNOWN_ERRORS.md."
      />
      <KnownErrorsTable slug={null} issues={issues} admin />
    </Page>
  );
}
