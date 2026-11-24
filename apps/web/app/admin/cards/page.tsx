import { unpublishCardAction } from '@/app/admin/cards/actions';
import { ConfirmActionButton } from '@/components/admin/confirm-action-button';
import { RebuildCardButtons } from '@/components/cards/rebuild-card-button';
import { ReviewCardButtons } from '@/components/cards/review-card-buttons';
import { Section } from '@/components/catalog/parts';
import Link from '@/components/link';
import { LocalTime } from '@/components/local-time';
import { Page, PageHeader } from '@/components/page';
import { AutoRefresh } from '@/components/runs/auto-refresh';
import { adminCards, type AdminCard } from '@/lib/server/card-admin';
import { openAuditPath } from '@/lib/server/openaudit-cards';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'OpenAudits', robots: { index: false, follow: false } };

// Admins only. Other viewers get 404, so the page does not show that it exists.
export default async function AdminCardsPage() {
  if (!isAdmin(await getViewer())) notFound();
  const cards = await adminCards();
  const now = new Date();
  const busy = cards.some((c) => c.card?.rebuildAt || building(c, now));
  return (
    <Page>
      <PageHeader
        eyebrow={
          <Link href="/admin" className="hover:text-sky-700">
            Admin
          </Link>
        }
        title="OpenAudits"
        description="OpenAudits of models with public finished runs. An OpenAudit builds by itself a few minutes after its runs end; Rebuild builds it now. Each build saves a draft and emails the admins. Only admins see a draft until one publishes it."
      />
      <AutoRefresh active={busy} />
      <Section title={`Models (${cards.length})`}>
        <CardTable cards={cards} now={now} />
      </Section>
    </Page>
  );
}

const building = (c: AdminCard, now: Date) =>
  !!c.card?.leaseOwner && !!c.card.leaseExpiresAt && c.card.leaseExpiresAt > now;

/** What the cards worker does with the card now, or next. */
function State({ c, now }: { c: AdminCard; now: Date }) {
  const card = c.card;
  if (!card) return <span className="text-slate-400">No card</span>;
  if (building(c, now)) return <span className="font-medium text-sky-800">Building</span>;
  if (card.rebuildAt)
    return (
      <span className="text-amber-800">
        {card.rebuildForce ? 'Force requested' : 'Requested'} <LocalTime value={card.rebuildAt} />
      </span>
    );
  if (card.leaseExpiresAt && card.leaseExpiresAt > now)
    return (
      <span className="text-rose-700">
        Failed; tries again <LocalTime value={card.leaseExpiresAt} />
      </span>
    );
  if (card.staleSince)
    return (
      <span className="text-amber-800">
        New runs since <LocalTime value={card.staleSince} />
      </span>
    );
  return <span className="text-slate-500">Up to date</span>;
}

type CardVersion = NonNullable<NonNullable<AdminCard['card']>['latest']>;

function VersionCell({ model, v, label }: { model: AdminCard['model']; v: CardVersion; label?: string }) {
  return (
    <>
      <Link href={openAuditPath(model, v.number)} className="text-sky-800 hover:underline">
        v{v.number}
        {label ? ` · ${label}` : ''}
      </Link>
      <span className="ml-1.5 text-slate-500">
        {v._count.runs} runs · ${v.costUsd.toFixed(2)}
      </span>
      <div className="text-slate-400">
        <LocalTime value={v.createdAt} />
      </div>
    </>
  );
}

function CardTable({ cards, now }: { cards: AdminCard[]; now: Date }) {
  if (!cards.length) return <p className="text-sm text-slate-500">None.</p>;
  const th = 'px-2 py-1.5 font-medium whitespace-nowrap';
  const td = 'px-2 py-1 align-top';
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className={th}>Model</th>
            <th className={cn(th, 'text-right')}>Runs</th>
            <th className={th}>Published</th>
            <th className={th}>Draft</th>
            <th className={th}>Last build</th>
            <th className={th}>State</th>
            <th className={th}>Error</th>
            <th className={th} />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {cards.map((c) => {
            const v = c.card?.latest;
            const draft = c.card?.draft;
            return (
              <tr key={c.model.id} className="hover:bg-slate-50">
                <td className={td}>
                  <div className="font-medium text-slate-800">{c.model.displayName}</div>
                  <div className="text-slate-500">{c.model.name}</div>
                </td>
                <td className={cn(td, 'text-right text-slate-600 tabular-nums')}>{c.runs}</td>
                <td className={cn(td, 'whitespace-nowrap')}>
                  {v ? (
                    <div className="flex flex-col items-start gap-1">
                      <div>
                        <VersionCell model={c.model} v={v} />
                      </div>
                      <ConfirmActionButton
                        action={unpublishCardAction.bind(null, c.model.id)}
                        label="Unpublish"
                        confirm={`Unpublish the OpenAudit of ${c.model.displayName}? The public then sees no OpenAudit of this model. ${draft ? 'The draft stays, and older published versions are discarded.' : `v${v.number} goes back to draft, so you can publish it again.`}`}
                        done="Unpublished."
                      />
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
                <td className={cn(td, 'whitespace-nowrap')}>
                  {draft ? (
                    <div className="flex flex-col gap-1">
                      <VersionCell model={c.model} v={draft} label="Preview" />
                      <ReviewCardButtons versionId={draft.id} label={`${c.model.displayName} v${draft.number}`} />
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
                <td className={cn(td, 'whitespace-nowrap text-slate-500')}>
                  {c.card?.builtAt ? <LocalTime value={c.card.builtAt} /> : '—'}
                </td>
                <td className={cn(td, 'whitespace-nowrap')}>
                  <State c={c} now={now} />
                </td>
                <td className={cn(td, 'max-w-72 font-mono break-words text-rose-800')}>{c.card?.error}</td>
                <td className={td}>
                  <RebuildCardButtons modelId={c.model.id} label={c.model.displayName} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
