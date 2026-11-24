import { hiddenText, NotesGate } from '@/components/catalog/known-errors-gate';
import { KnownErrorsTable } from '@/components/catalog/known-errors-table';
import Link from '@/components/link';
import { NavSection } from '@/components/nav/nav-section';
import { Page, PageHeader } from '@/components/page';
import { versionRule } from '@/lib/runs/terms';
import { ISSUE_KINDS, kindLabel } from '@/lib/sample-issues';
import { getEval } from '@/lib/server/catalog';
import { versionIssues, withReadableNotes } from '@/lib/server/sample-issues';
import { sampleAccess } from '@/lib/server/terms';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await getEval((await params).slug);
  return { title: found ? `${found.eval.displayName}: Known Errors` : 'Known Errors' };
}

export default async function KnownErrorsPage({ params }: Props) {
  const { slug } = await params;
  const found = await getEval(slug);
  const version = found?.versions[0];
  if (!found || !version) notFound();
  const { eval: e } = found;
  const [viewer, access] = await Promise.all([getViewer(), sampleAccess(version)]);
  const admin = isAdmin(viewer);
  const rule = versionRule(version);
  // A note can quote the sample: it goes only to readers who can read the samples.
  const readable = admin || access.canRead(rule);
  const issues = withReadableNotes(await versionIssues(version.id, admin), () => readable);
  const confirmed = issues.filter((i) => i.status === 'confirmed');
  const reports = e.links.filter((l) => l.kind === 'error_report');
  const kinds = Object.keys(ISSUE_KINDS)
    .map((k) => [k, confirmed.filter((i) => i.kind === k).length] as const)
    .filter(([, n]) => n > 0);

  return (
    <Page>
      <NavSection method={e.facets.subjects.includes('method')} />
      <PageHeader
        eyebrow="Known Errors"
        title={e.displayName}
        description={
          <span className="flex flex-wrap gap-x-3">
            <Link href={`/evaluations/${e.slug}`} className="text-sky-800 hover:underline">
              Back to the eval · version {version.version}
            </Link>
            <Link href="/evaluations/known-errors" className="text-sky-800 hover:underline">
              Known errors of all evals →
            </Link>
          </span>
        }
      />
      <div className="flex flex-col gap-2 text-sm text-slate-700">
        <p>
          These samples have an error in the dataset: for example a wrong answer key, or a question that lost the text
          it refers to. Many models fail them for that reason, not because of their own mistakes. We find them by review
          of the samples that most models fail, and our staff confirm each one.
        </p>
        <p>
          The eval page does not count the confirmed samples: its{' '}
          <span className="font-medium">Adjusted Pass Rate</span> and Pass / Fail counts leave them out, and the models
          rank by the adjusted pass rate. The headline metric that the eval reports still includes them. If you find
          another error, tell us with the Report button.
        </p>
        {reports.length > 0 && (
          <p>
            We reported dataset errors to the maintainers:{' '}
            {reports.map((l, i) => (
              <span key={l.url}>
                {i > 0 && ', '}
                <a
                  href={l.url}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  className="text-sky-800 hover:underline"
                >
                  {l.title ?? 'our report'}
                </a>
              </span>
            ))}
            .
          </p>
        )}
        <p className="text-slate-500">
          {confirmed.length
            ? `${confirmed.length} confirmed: ${kinds.map(([k, n]) => `${n} ${kindLabel(k).toLowerCase()}`).join(', ')}.`
            : 'No confirmed known errors yet.'}
          {admin && ` ${issues.length - confirmed.length} more proposed or rejected (only admins see them).`}
        </p>
      </div>
      {!readable && confirmed.length > 0 && (
        <NotesGate version={version} access={access} rule={rule} returnTo={`/evaluations/${e.slug}/known-errors`} />
      )}
      <KnownErrorsTable slug={e.slug} issues={issues} hiddenText={hiddenText(access, rule)} admin={admin} />
    </Page>
  );
}
