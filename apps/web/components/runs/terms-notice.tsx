import Link from '@/components/link';
import { AcceptTerms } from '@/components/runs/accept-terms';
import { SIGN_IN_ENABLED } from '@/lib/env';
import type { SampleAccess } from '@/lib/server/terms';
import type { DisplayRule, EvalVersion } from '@openaudit/spec';

/** The dataset's terms on showing samples, and what this viewer can read. */
export function TermsNotice({
  version,
  access,
  rule,
  returnTo,
}: {
  version: Pick<EvalVersion, 'id' | 'sampleTerms'>;
  access: SampleAccess;
  rule: DisplayRule;
  returnTo: string;
}) {
  const terms = version.sampleTerms;
  if (!terms || rule === 'open') return null;
  const quotes = [
    ...(terms.quote ? [{ label: undefined, quote: terms.quote, source: terms.source }] : []),
    ...(terms.subsets ?? []).flatMap((s) =>
      s.quote ? [{ label: `For samples from ${s.value}`, quote: s.quote, source: s.source }] : [],
    ),
  ];

  return (
    <div className="flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm text-slate-700">
      <p className="font-medium text-slate-800">Dataset terms</p>
      {quotes.map((q, i) => (
        <figure key={i} className="flex flex-col gap-0.5">
          {q.label && <figcaption className="text-xs text-slate-500">{q.label}:</figcaption>}
          <blockquote className="border-l-2 border-amber-300 pl-2 text-slate-700 italic">{q.quote}</blockquote>
          <a href={q.source} className="text-xs text-sky-800 hover:underline" rel="noreferrer" target="_blank">
            Source
          </a>
        </figure>
      ))}
      {terms.note && <p className="text-xs text-slate-600">{terms.note}</p>}
      <p className="text-xs text-slate-600">
        {access.allows(rule) ? (
          'You accepted these terms. Do not post these samples online.'
        ) : rule === 'scores_only' ? (
          'These terms do not let us show the samples. This page shows only scores.'
        ) : !SIGN_IN_ENABLED ? (
          'Sign-in is off on this site, so the samples are hidden.'
        ) : !access.signedIn ? (
          <>
            <Link href={`/signin?returnTo=${encodeURIComponent(returnTo)}`} className="text-sky-800 hover:underline">
              Sign in
            </Link>{' '}
            and accept these terms to read the samples.
          </>
        ) : (
          'Accept these terms to read the samples.'
        )}
      </p>
      {rule === 'sign_in' && access.signedIn && !access.accepted && access.termsSha256 && (
        <AcceptTerms versionId={version.id} termsSha256={access.termsSha256} />
      )}
    </div>
  );
}
