import { KnownErrorsTable } from '@/components/catalog/known-errors-table';
import { EvalAccessGate } from '@/components/eval-attestation';
import Link from '@/components/link';
import { Page, PageHeader } from '@/components/page';
import { versionRule } from '@/lib/runs/terms';
import type { KnownErrorItem } from '@/lib/sample-issues';
import { getEval } from '@/lib/server/catalog';
import { hasEvalClearance } from '@/lib/server/eval-clearance';
import { allIssues, withReadableNotes } from '@/lib/server/sample-issues';
import { sampleAccess } from '@/lib/server/terms';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Known Errors' };

/** For each eval version of the issues ("slug version"): the reader can read its samples. */
async function readableVersions(issues: KnownErrorItem[]) {
  const keys = new Map(issues.flatMap((i) => (i.eval ? [[`${i.eval.slug} ${i.eval.version}`, i.eval]] : [])));
  const out = new Map<string, boolean>();
  for (const [key, e] of keys) {
    const version = (await getEval(e.slug))?.versions.find((v) => v.version === e.version);
    out.set(key, !!version && (await sampleAccess(version)).canRead(versionRule(version)));
  }
  return out;
}

export default async function AllKnownErrorsPage() {
  const admin = isAdmin(await getViewer());
  const found = await allIssues(admin);
  const readable = admin ? null : await readableVersions(found);
  const issues = withReadableNotes(found, (i) => !readable || !!readable.get(`${i.eval?.slug} ${i.eval?.version}`));
  const confirmed = issues.filter((i) => i.status === 'confirmed');
  const cleared = admin || (await hasEvalClearance());

  return (
    <Page>
      <PageHeader
        title="Known Errors - All Evaluations"
        description={
          <Link href="/models" className="text-sky-800 hover:underline">
            Back to the model evaluations
          </Link>
        }
      />
      <div className="flex flex-col gap-2 text-sm text-slate-700">
        <p>
          These eval samples have an error in the dataset: for example a wrong answer key, or a question that lost the
          text it refers to. Many models fail them for that reason, not because of their own mistakes. Our staff confirm
          each one, and the eval pages leave the confirmed samples out of their Adjusted Pass Rate and Pass / Fail
          counts.
        </p>
        {admin && (
          <p className="text-slate-500">
            {issues.length - confirmed.length} proposed or rejected (only admins see them).
          </p>
        )}
      </div>
      {!cleared && confirmed.length > 0 && <EvalAccessGate />}
      <KnownErrorsTable
        slug={null}
        issues={issues}
        hiddenText={
          cleared
            ? "Hidden by the dataset terms. Open the eval's known errors to see its terms."
            : 'Confirm the statement above to read the note'
        }
        admin={admin}
      />
    </Page>
  );
}
