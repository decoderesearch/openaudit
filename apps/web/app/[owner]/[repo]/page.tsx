import { hideModelAction } from '@/app/admin/organizations/actions';
import { ConfirmActionButton } from '@/components/admin/confirm-action-button';
import { ModelActions, ModelInfo, type CardFact, type DocumentLink } from '@/components/catalog/model-actions';
import { ModelIncidents } from '@/components/catalog/model-incidents';
import {
  CardVersionHistory,
  CardVersionNotice,
  ModelOpenAudit,
  snippetViews,
} from '@/components/catalog/openaudit-card';
import { Tag } from '@/components/catalog/parts';
import { QuantizedNotice } from '@/components/catalog/quantized-notice';
import { NoAuditNotice } from '@/components/catalog/sponsor-audit';
import { SystemCardView } from '@/components/catalog/system-card-view';
import { ThirdPartyAudits, thirdPartyCards } from '@/components/catalog/third-party-audits';
import { CompareButton } from '@/components/compare/compare-button';
import { Deploymeter } from '@/components/deploymeter/deploymeter';
import Link from '@/components/link';
import { Eyebrow, Page, PageTitle } from '@/components/page';
import { ModelRuns, ModelRunsView } from '@/components/runs/model-runs';
import { NewEvalProvider } from '@/components/runs/new-eval-context';
import { Button } from '@/components/ui/button';
import { compareHref } from '@/lib/compare';
import { DOCUMENT_KINDS } from '@/lib/format';
import { modelMode, modelModePath } from '@/lib/model-mode';
import { countList, shareMetadata } from '@/lib/og/meta';
import { formatDate } from '@/lib/org-research';
import { organizationPath } from '@/lib/organizations';
import { modelReleased } from '@/lib/release-dates';
import { cardPath, cardsForModel, findModel, getModel, modelPath } from '@/lib/server/catalog';
import { getDeploymeter } from '@/lib/server/deploymeter';
import { evalStandings } from '@/lib/server/eval-ranks';
import { modelIncidents } from '@/lib/server/model-feed';
import { modelOg } from '@/lib/server/og';
import { getOpenAuditCard } from '@/lib/server/openaudit-cards';
import { isModelHiddenFlag } from '@/lib/server/org-admin';
import { runMode } from '@/lib/server/run-mode';
import { listRuns } from '@/lib/server/runs';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import type { Model } from '@openaudit/spec';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';

type Props = {
  params: Promise<{ owner: string; repo: string }>;
  searchParams: Promise<{ v?: string; tab?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { owner, repo } = await params;
  const og = await modelOg(owner, repo);
  if (!og) return { title: 'Model' };
  const { model, organization } = og;
  const systemCard = modelMode((await searchParams).tab) === 'system-card';
  const title = `${model.displayName}${systemCard ? ' System Card' : ''}`;
  const released = formatDate(model.facts.releaseDate?.value);
  const counts = countList([
    [og.openAudit, 'OpenAudit eval', 'OpenAudit evals'],
    [og.systemCard, 'system card eval', 'system card evals'],
    [og.flagged.high + og.flagged.medium, 'flagged chat', 'flagged chats'],
    [og.incidentCount, 'safety incident', 'safety incidents'],
  ]);
  const description = `Independent evaluations of ${model.displayName} (${model.name}) by ${organization.displayName}${released ? `, released ${released}` : ''}: ${counts}.`;
  const url = modelPath(model);
  return { title, description, ...shareMetadata(title, description, url, `${url}/opengraph-image`) };
}

/** A model and its OpenAudit. `?v=<n>` shows an older OpenAudit version. `?tab=` sets the mode:
 * `system-card` shows only the system card. */
export default async function ModelPage({ params, searchParams }: Props) {
  const { owner, repo } = await params;
  const { v, tab } = await searchParams;
  const mode = modelMode(tab);
  const number = v && /^\d+$/.test(v) ? Number(v) : undefined;
  // The database is far from most edge locations, so read the rest in parallel.
  const row = await findModel(owner, repo);
  if (!row) notFound();
  if (mode === 'system-card') {
    const found = await getModel(owner, repo);
    if (!found) notFound();
    return (
      <SystemCardView
        model={found.model}
        organization={found.organization}
        corner={<ModelActions path={modelPath(row)} mode={mode} />}
        banner={<SystemCardNotice model={found.model} developer={found.organization.displayName} />}
      />
    );
  }
  const viewerRead = getViewer();
  const cardRead = viewerRead.then((u) => getOpenAuditCard(row.id, number, { drafts: isAdmin(u) }));
  // An older OpenAudit version shows only the panels on it.
  const meterRead = viewerRead.then(async (u) => {
    const c = number ? await cardRead : null;
    const old = c && c.version.number !== c.latest ? c.version.number : undefined;
    return getDeploymeter(row.id, u, { drafts: isAdmin(u), cardVersion: old });
  });
  const [found, cards, viewer, runs, card, incidents, meter, standings] = await Promise.all([
    getModel(owner, repo),
    cardsForModel(row, { results: false }),
    viewerRead,
    listRuns({ modelId: row.id }),
    cardRead,
    modelIncidents(row.id),
    meterRead,
    evalStandings(),
  ]);
  const places = Object.fromEntries(
    Object.entries(standings).flatMap(([evalId, s]) => (s.places[row.id] ? [[evalId, s.places[row.id]]] : [])),
  );
  const oldVersion = !!number && !!card && card.version.number !== card.latest;
  if (!found || (v && !card)) notFound();
  const admin = isAdmin(viewer);
  const hidden = admin && (await isModelHiddenFlag(row.id));
  const { model, organization, parent } = found;
  const thirdParty = thirdPartyCards(cards, [model.organizationId, ...(parent ? [parent.organizationId] : [])]);
  const documents: DocumentLink[] = cards
    .filter((c) => c.document.kind !== 'system_card' && !thirdParty.includes(c))
    .map((c) => ({
      id: c.id,
      title: c.document.title,
      detail: `${DOCUMENT_KINDS[c.document.kind]} · ${c.document.publishedDate ?? 'Undated'}`,
      href: cardPath(model, c.document.key, c.document.kind),
    }));
  const onHub = model.source === 'hf' && !model.removedFromHub;
  const snippets = card ? snippetViews(card) : [];
  const jlensNames = [model.name, ...model.aliases];
  const systemCards = cards.filter((c) => c.document.kind === 'system_card');
  const incidentRow = incidents.length > 0 && <ModelIncidents incidents={incidents} />;
  // The queue controls wait for OpenRouter. The page and the results do not.
  const evaluations = (topics?: ReactNode, summary?: ReactNode) => (
    <Suspense
      fallback={
        <ModelRunsView
          runs={runs}
          cardRuns={card?.runs ?? []}
          places={places}
          snippets={snippets}
          jlensNames={jlensNames}
          topics={topics}
          summary={summary}
        />
      }
    >
      <ModelRuns
        cardRuns={card?.runs ?? []}
        places={places}
        snippets={snippets}
        jlensNames={jlensNames}
        model={{
          name: model.name,
          displayName: model.displayName,
          source: model.source,
          organization: organization.slug,
        }}
        modelId={model.id}
        runs={runs}
        mode={runMode(viewer)}
        signedIn={!!viewer}
        topics={topics}
        summary={summary}
      />
    </Suspense>
  );
  const showMeter = !!(oldVersion ? meter?.panel : card?.latest || meter);
  // With an executive summary in columns, the Deploymeter is its first column.
  const meterInSummary = !!card?.version.summary && typeof card.version.summary !== 'string';
  const meterProps = {
    view: meter,
    model: { id: model.id, displayName: model.displayName, path: modelPath(model) },
    signedIn: !!viewer,
    admin,
  };
  const facts: CardFact[] = card
    ? [
        {
          label: 'Aggregator',
          value: card.version.builtBy,
          about: 'The model that read the eval results and snippets, and wrote this card.',
          model: card.version.aggregator,
        },
        ...(card.version.flaggedBy
          ? [
              {
                label: 'Chat Flaggers',
                value: card.version.flaggedBy,
                about:
                  'The models that read the eval transcripts and found the excerpts that this card cites. The first read all attempts; the others read the attempts that its safety filter blocked.',
                model: card.version.flagger,
              },
            ]
          : []),
      ]
    : [];

  return (
    <Page>
      <div className="-mb-2 flex flex-col gap-x-4 gap-y-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Eyebrow>
            <Link href={organizationPath(organization)} className="text-slate-400 hover:text-sky-800 hover:underline">
              {organization.displayName}
            </Link>
          </Eyebrow>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <PageTitle>{model.displayName}</PageTitle>
            <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
              <span className="font-mono">{model.name}</span>
              {model.removedFromHub && <Tag>Removed from the Hub</Tag>}
              {hidden && <Tag>Hidden</Tag>}
              {admin && (
                <ConfirmActionButton
                  action={hideModelAction.bind(null, model.id, !hidden)}
                  label={hidden ? 'Show Model' : 'Hide Model'}
                  confirm={
                    hidden
                      ? `Show ${model.displayName}, its page and its runs to the public again?`
                      : `Hide ${model.displayName}, its page and its runs from the public? Admins still see its page.`
                  }
                  done={hidden ? 'Shown.' : 'Hidden.'}
                />
              )}
            </p>
          </div>
        </div>
        <ModelActions
          path={modelPath(model)}
          mode={mode}
          systemCard={systemCards.length > 0}
          compare={card?.latest && <CompareButton href={compareHref([model.name])} className="px-3 py-1 text-xs" />}
          info={
            (facts.length > 0 || documents.length > 0 || onHub) && (
              <ModelInfo facts={facts} documents={documents} hub={onHub ? model.name : undefined} />
            )
          }
          history={card && <CardVersionHistory model={model} card={card} />}
        />
      </div>

      {parent && model.parentRelation === 'quantized' && (
        <QuantizedNotice
          model={model}
          parent={{ displayName: parent.displayName, href: modelPath(parent) }}
          systemCards={systemCards}
          audited={!!card}
        />
      )}

      {!card && !systemCards.length && incidentRow}

      {card && <CardVersionNotice model={model} card={card} />}

      {showMeter && !meterInSummary && <Deploymeter {...meterProps} />}

      <ThirdPartyAudits cards={thirdParty} model={model} />

      <NewEvalProvider>
        <ModelOpenAudit
          model={model}
          card={card}
          developer={organization.displayName}
          systemCards={systemCards}
          incidents={incidentRow}
          deploymeter={showMeter && meterInSummary ? <Deploymeter {...meterProps} column /> : undefined}
          evaluations={evaluations}
          places={places}
          notice={
            !card && (
              <NoAuditNotice
                model={{
                  id: model.id,
                  name: model.name,
                  source: model.source,
                  organization: organization.slug,
                  displayName: model.displayName,
                  path: modelPath(model),
                  released: modelReleased(model.facts),
                }}
                systemCard={systemCards.length > 0}
              />
            )
          }
        />
      </NewEvalProvider>
    </Page>
  );
}

/** The notice in System Card mode: the developer wrote this, and OpenAudit is the other mode. */
function SystemCardNotice({ model, developer }: { model: Model; developer: string }) {
  return (
    <div className="flex flex-col items-start gap-y-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p>
        You&apos;re viewing the system card for {model.displayName}, which is published by its developer, {developer}.
        Switch modes to view the public OpenAudit.
      </p>
      <Button size="sm" asChild className="bg-sky-700 text-white hover:bg-sky-800">
        <Link href={modelModePath(modelPath(model), 'openaudit')}>Switch to OpenAudit</Link>
      </Button>
    </div>
  );
}
