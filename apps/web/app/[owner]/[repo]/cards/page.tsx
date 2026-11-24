import { CardHashRedirect } from '@/components/catalog/card-hash-redirect';
import { CardList } from '@/components/catalog/card-list';
import { Page, PageHeader } from '@/components/page';
import { Section } from '@/components/section';
import { cardPath, cardsForModel, getModel } from '@/lib/server/catalog';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

type Props = { params: Promise<{ owner: string; repo: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo } = await params;
  const found = await getModel(owner, repo);
  return { title: found ? `${found.model.displayName}: summaries` : 'Summaries' };
}

export default async function CardsPage({ params }: Props) {
  const { owner, repo } = await params;
  const found = await getModel(owner, repo);
  if (!found) notFound();
  const { model } = found;
  const cards = await cardsForModel(model, { results: false });

  return (
    <Page>
      <PageHeader title={`${model.displayName}: summaries`} />
      <Section title={`Summaries (${cards.length})`}>
        <CardList cards={cards} model={model} />
      </Section>
      <CardHashRedirect
        hrefs={Object.fromEntries(cards.map((c) => [c.id, cardPath(model, c.document.key, c.document.kind)]))}
      />
    </Page>
  );
}
