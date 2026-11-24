import { SponsorDialog } from '@/components/catalog/sponsor-dialog';
import Link from '@/components/link';
import { Button } from '@/components/ui/button';
import type { RouteModel } from '@/lib/runs/model-routes';
import { auditEstimate, roundUsd, type AuditEstimate } from '@/lib/server/audit-estimate';
import { systemCardPath } from '@/lib/server/catalog';
import { evalsTooOld } from '@/lib/server/eval-age';
import { Suspense } from 'react';

type NoticeModel = { name: string; displayName: string; path: string };

const usd = (n: number) => `$${n < 10 ? n.toFixed(2) : Math.round(n).toLocaleString('en-US')}`;

type EstimatedModel = RouteModel & NoticeModel & { id: string; released: string | null };

/** For a model with no OpenAudit: what a full audit would cost and how to sponsor it, then a link
 * to the system card (`systemCard`). Until the estimate loads, and when the model has no
 * OpenRouter route, only the link. */
export function NoAuditNotice({ model, systemCard }: { model: EstimatedModel; systemCard: boolean }) {
  return (
    <Suspense fallback={<AuditNotice model={model} systemCard={systemCard} estimate={null} />}>
      <EstimatedNotice model={model} systemCard={systemCard} />
    </Suspense>
  );
}

async function EstimatedNotice({ model, systemCard }: { model: EstimatedModel; systemCard: boolean }) {
  const estimate = await auditEstimate(model).catch((e) => {
    console.error('[sponsor] estimate failed', e);
    return null;
  });
  return <AuditNotice model={model} systemCard={systemCard} estimate={estimate} />;
}

export function AuditNotice({
  model,
  systemCard,
  estimate: e,
}: {
  model: NoticeModel;
  systemCard: boolean;
  estimate: AuditEstimate | null;
}) {
  if (!e && !systemCard) return null;
  const none = `We don't have any confirmed evaluations for ${model.displayName} yet.`;
  const cardHref = systemCardPath(model);
  if (!e)
    return (
      <section className={BOX}>
        <p>{none} You can view our annotated version of their self-reported safety report (system card).</p>
        <Button size="sm" asChild className="bg-sky-700 text-white hover:bg-sky-800">
          <Link href={cardHref}>View System Card</Link>
        </Button>
      </section>
    );
  const total = roundUsd(e.totalUsd);
  const stale = evalsTooOld(e);
  const parts = [
    { label: `Evaluations (${e.evals} evals, ${e.samples.toLocaleString('en-US')} samples)`, usd: e.evalsUsd },
    { label: 'OpenAudit card', usd: e.cardUsd },
    { label: 'Deploymeter', usd: e.meterUsd },
  ];
  return (
    <section aria-label="Sponsor This Audit" className={BOX}>
      {stale && (
        <div
          role="alert"
          className="flex max-w-[81ch] flex-col gap-y-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
        >
          <p className="font-bold">Evaluations Underpowered</p>
          <p>
            {model.displayName} was released after {e.older} of these {e.evals} evaluations.
          </p>
          <p>
            The evaluations use public datasets, so their data is very likely in the model&apos;s training data,
            rendering any evaluation result unreliable. Therefore, we do not accept sponsorships for an audit of this
            model.
          </p>
          <p>
            We look forward to new{' '}
            <Link href="/contribute#model-evaluations" className="font-medium underline hover:text-red-950">
              model evaluation contributions
            </Link>{' '}
            and{' '}
            <Link href="/contribute#embedded-evaluations" className="font-medium underline hover:text-red-950">
              embedded evaluations
            </Link>
            .
          </p>
          <p>
            FAQ:{' '}
            <Link href="/faqs#newest-models" className="font-medium underline hover:text-red-950">
              Why don&apos;t we have evaluations for the newest models?
            </Link>
          </p>
        </div>
      )}
      <p>
        {none}
        <br />A full audit would cost about <span className="font-semibold">${total.toLocaleString('en-US')}</span> in
        model usage.{!stale && ' You can sponsor it with a donation.'}
      </p>
      <ul className="flex w-full max-w-md flex-col gap-y-0.5 text-xs text-sky-800">
        {parts.map((p) => (
          <li key={p.label} className="flex justify-between gap-x-4">
            <span>{p.label}</span>
            <span className="text-sky-950 tabular-nums">{usd(p.usd)}</span>
          </li>
        ))}
      </ul>
      <SponsorDialog model={model} usd={total} disabled={stale} />
      {systemCard && (
        <p className="mt-1">
          Alternatively, you can{' '}
          <Link href={cardHref} className="font-medium underline hover:text-sky-950">
            view the system card
          </Link>
          , our annotated version of their self-reported safety report.
        </p>
      )}
    </section>
  );
}

const BOX =
  'flex flex-col items-start gap-y-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900';
