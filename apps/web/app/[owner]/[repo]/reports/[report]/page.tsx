import { SummaryPage } from '@/components/catalog/summary-page';
import { cardPath, summaryFor, summaryTitle } from '@/lib/server/catalog';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

type Props = { params: Promise<{ owner: string; repo: string; report: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo, report } = await params;
  const found = await summaryFor(owner, repo, report);
  return { title: found ? summaryTitle(found.model, found.card.document) : 'Report' };
}

/** Our summary of a document that is not a system card: a technical or safety report, or a model page. */
export default async function ReportPage({ params }: Props) {
  const { owner, repo, report } = await params;
  const found = await summaryFor(owner, repo, report);
  if (!found) notFound();
  const { model, card } = found;
  if (card.document.kind === 'system_card') redirect(cardPath(model, card.document.key, card.document.kind));
  return <SummaryPage model={model} sources={[card]} />;
}
