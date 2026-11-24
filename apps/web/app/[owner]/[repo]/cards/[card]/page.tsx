import { SummaryPage } from '@/components/catalog/summary-page';
import Link from '@/components/link';
import { cardPath, summaryFor, summaryTitle, systemCardPath, systemCardsFor } from '@/lib/server/catalog';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

type Props = { params: Promise<{ owner: string; repo: string; card: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo, card } = await params;
  const found = await summaryFor(owner, repo, card);
  return { title: found ? summaryTitle(found.model, found.card.document) : 'System card' };
}

/** One system card. Summaries of other kinds of document are under /reports. */
export default async function CardPage({ params }: Props) {
  const { owner, repo, card } = await params;
  const found = await summaryFor(owner, repo, card);
  if (!found) notFound();
  const { model, card: c } = found;
  if (c.document.kind !== 'system_card') redirect(cardPath(model, c.document.key, c.document.kind));
  const all = await systemCardsFor(model, { results: false });
  const notice = all.length > 1 && (
    <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
      This is one of the {all.length} system cards for {model.displayName}.{' '}
      <Link href={systemCardPath(model)} className="font-medium underline">
        See the system card that combines them
      </Link>
      .
    </p>
  );
  return <SummaryPage model={model} sources={[c]} notice={notice} />;
}
