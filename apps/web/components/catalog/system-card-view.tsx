import { CardList } from '@/components/catalog/card-list';
import { PANEL, SummaryPage, SystemCardTitle } from '@/components/catalog/summary-page';
import { InfoPopover } from '@/components/info-popover';
import Link from '@/components/link';
import { Page, PageTitle } from '@/components/page';
import { TogglePanels } from '@/components/toggle-panel';
import { aboutDocument } from '@/lib/card-heading';
import { cardsForModel, modelPath } from '@/lib/server/catalog';
import type { Model, Organization } from '@openaudit/spec';
import type { ReactNode } from 'react';

/** The model page in System Card mode: all its system cards as one page, or a note that it has
 * none. `corner`: the mode switch, when there is no card. `banner`: the notice below the heading,
 * when there is a card. */
export async function SystemCardView({
  model,
  organization,
  corner,
  banner,
}: {
  model: Model;
  organization: Pick<Organization, 'displayName'>;
  corner?: ReactNode;
  banner?: ReactNode;
}) {
  const cards = await cardsForModel(model);
  const sources = cards.filter((c) => c.document.kind === 'system_card');
  if (sources.length) return <SummaryPage model={model} sources={sources} systemCard banner={banner} />;

  return (
    <Page>
      <TogglePanels
        corner={corner}
        lead={
          <PageTitle>
            <SystemCardTitle model={model}>
              <InfoPopover label="System Card">{aboutDocument('system_card', 'System Card')}</InfoPopover>
            </SystemCardTitle>
          </PageTitle>
        }
        panels={[]}
      />
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
        <p className="font-medium">No System Card</p>
        <p className="mt-1 text-rose-800">
          We know of no system card from {organization.displayName} for {model.displayName}.
        </p>
      </div>
      <section className={PANEL}>
        <h2 className="mb-2 text-lg text-slate-800">Other Documents We Summarized</h2>
        {cards.length ? (
          <CardList cards={cards} model={model} />
        ) : (
          <p className="text-sm text-slate-500">
            None yet. The{' '}
            <Link href={modelPath(model)} className="text-sky-800 hover:underline">
              model page
            </Link>{' '}
            lists its documents.
          </p>
        )}
      </section>
    </Page>
  );
}
