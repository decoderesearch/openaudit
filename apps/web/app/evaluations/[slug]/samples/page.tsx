import { Tag } from '@/components/catalog/parts';
import { EvalAccessGate } from '@/components/eval-attestation';
import Link from '@/components/link';
import { NavSection } from '@/components/nav/nav-section';
import { Page, PageHeader } from '@/components/page';
import { TermsNotice } from '@/components/runs/terms-notice';
import { Section } from '@/components/section';
import { SAMPLES_PER_PAGE, getEval, getSamples } from '@/lib/server/catalog';
import { sampleAccess } from '@/lib/server/terms';
import { cn } from '@/lib/utils';
import type { EvalSample } from '@openaudit/spec';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ version?: string; split?: string; page?: string }>;
};

// Samples are eval data: keep them out of search and training crawls.
export const metadata: Metadata = { title: 'Samples', robots: { index: false, follow: false } };

const label = (v: string) => v.replaceAll('_', ' ');

export default async function SamplesPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const found = await getEval(slug);
  if (!found) notFound();
  const { eval: e, versions } = found;
  const version = versions.find((v) => v.version === sp.version) ?? versions[0];
  const splits = (version?.dataset?.splits ?? []).filter((s) => s.storage === 'stored' && s.sampleCount > 0);
  if (!version || !splits.length) notFound();
  const split = splits.find((s) => s.name === sp.split) ?? splits[0];
  const page = Math.max(1, Number(sp.page) || 1);
  const href = (patch: { split?: string; page?: number }) => {
    const q = new URLSearchParams({ version: version.version, split: patch.split ?? split.name });
    if (patch.page && patch.page > 1) q.set('page', String(patch.page));
    return `/evaluations/${e.slug}/samples?${q}`;
  };
  const access = await sampleAccess(version);
  const rule = version.sampleTerms?.display ?? 'open';
  const { samples, total } = access.canRead(rule)
    ? await getSamples(version, split.name, page)
    : { samples: [], total: 0 };
  const pages = Math.max(1, Math.ceil(total / SAMPLES_PER_PAGE));

  return (
    <Page>
      <NavSection method={e.facets.subjects.includes('method')} />
      <PageHeader
        title={`${e.displayName} samples`}
        description={
          <Link href={`/evaluations/${e.slug}`} className="text-sky-800 hover:underline">
            Version {version.version}
          </Link>
        }
      />
      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        These are evaluation samples. Do not use them to train models.
        {e.canary && <span className="mt-1 block font-mono text-[10px] break-all text-slate-400">{e.canary}</span>}
      </p>
      <TermsNotice version={version} access={access} rule={rule} returnTo={href({ page })} />
      {!access.cleared && <EvalAccessGate />}
      <Section title="Split">
        <div className="flex flex-wrap gap-1.5">
          {splits.map((s) => (
            <Link
              key={s.name}
              href={href({ split: s.name })}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs',
                s.name === split.name
                  ? 'border-sky-700 bg-sky-50 text-sky-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {label(s.name)} <span className="text-slate-400">{s.sampleCount}</span>
            </Link>
          ))}
        </div>
      </Section>
      <ol className="flex flex-col gap-3">
        {samples.map((s) => (
          <SampleCard key={s.id} sample={s} />
        ))}
      </ol>
      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-center gap-x-3 text-sm">
          {page > 1 && (
            <Link href={href({ page: page - 1 })} className="text-sky-800 hover:underline">
              Previous
            </Link>
          )}
          <span className="text-slate-500">
            Page {page} of {pages}
          </span>
          {page < pages && (
            <Link href={href({ page: page + 1 })} className="text-sky-800 hover:underline">
              Next
            </Link>
          )}
        </nav>
      )}
    </Page>
  );
}

function SampleCard({ sample: s }: { sample: EvalSample }) {
  const messages = typeof s.input === 'string' ? [{ role: 'user', content: s.input }] : (s.input ?? []);
  // `settings` has a key for each run, also the runs that the reader cannot see.
  const { settings: _settings, ...metadata } = s.metadata as Record<string, unknown>;
  return (
    <li className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-slate-600">{s.sourceId}</span>
        <span className="font-mono text-[10px] text-slate-400" title={s.sha256}>
          {s.sha256.slice(0, 12)}
        </span>
      </div>
      {messages.length ? (
        <div className="flex flex-col gap-1.5">
          {messages.map((m, i) => (
            <div key={i} className="text-sm">
              <Tag className="mr-1.5 align-middle">{m.role}</Tag>
              <span className="whitespace-pre-wrap text-slate-800">{m.content}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Held out: only the hash is kept.</p>
      )}
      {s.choices && (
        <ol className="list-[upper-alpha] pl-6 text-sm text-slate-700">
          {s.choices.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ol>
      )}
      {s.target !== undefined && (
        <p className="text-sm">
          <span className="text-slate-500">Target: </span>
          <span className="text-slate-800">{Array.isArray(s.target) ? s.target.join(' | ') : s.target}</span>
        </p>
      )}
      {Object.keys(metadata).length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-slate-500">Metadata</summary>
          <pre className="mt-1 max-h-80 overflow-auto rounded bg-slate-50 p-2 text-[11px] whitespace-pre-wrap text-slate-700">
            {JSON.stringify(metadata, null, 2)}
          </pre>
        </details>
      )}
    </li>
  );
}
