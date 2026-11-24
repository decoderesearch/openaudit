import { prisma } from '@/lib/db';
import { inboxKey } from '@/lib/email/address';
import { adminAlertEmail } from '@/lib/email/templates';
import { NEXT_PUBLIC_URL } from '@/lib/env';
import { adminEmails } from '@/lib/server/admins';
import { openAuditPath } from '@/lib/server/openaudit-cards';
import { deliver } from '@/lib/server/run-emails';

// The admin view of OpenAudits: each model with public finished runs, and its card state.
// A rebuild request sets `rebuildAt`; the cards worker builds it with no debounce. Each build
// saves a draft; the public sees it only after an admin publishes it.

const FINISHED = { status: 'succeeded', visibility: 'public' } as const;

const VERSION = { number: true, status: true, createdAt: true, costUsd: true, _count: { select: { runs: true } } };

export type AdminCard = Awaited<ReturnType<typeof adminCards>>[number];

export async function adminCards() {
  const models = await prisma.model.findMany({
    where: { runs: { some: FINISHED } },
    select: {
      id: true,
      name: true,
      displayName: true,
      _count: { select: { runs: { where: FINISHED } } },
      openAuditCard: {
        select: {
          staleSince: true,
          builtAt: true,
          rebuildAt: true,
          rebuildForce: true,
          error: true,
          leaseOwner: true,
          leaseExpiresAt: true,
          versions: {
            where: { status: { in: ['draft', 'published'] } },
            orderBy: { number: 'desc' },
            take: 5,
            select: { id: true, ...VERSION },
          },
        },
      },
    },
  });
  return models
    .map(({ openAuditCard: card, _count, ...model }) => ({
      model,
      runs: _count.runs,
      card: card && {
        ...card,
        latest: card.versions.find((v) => v.status === 'published') ?? null,
        draft: card.versions.find((v) => v.status === 'draft') ?? null,
      },
    }))
    .sort((a, b) => a.model.displayName.localeCompare(b.model.displayName));
}

/**
 * Asks for a build of the model's card. `force`: a new version also when the input did not
 * change. A force request that waits stays a force request. A failed build's retry wait ends;
 * a build that runs now keeps its lease. False: the model has no public finished run.
 */
export async function requestCardRebuild(modelId: string, force: boolean): Promise<boolean> {
  const model = await prisma.model.findFirst({
    where: { id: modelId, runs: { some: FINISHED } },
    select: { id: true },
  });
  if (!model) return false;
  const card = await prisma.openAuditCard.findUnique({
    where: { modelId },
    select: { rebuildAt: true, rebuildForce: true, leaseOwner: true },
  });
  const now = new Date();
  await prisma.openAuditCard.upsert({
    where: { modelId },
    create: { modelId, rebuildAt: now, rebuildForce: force },
    update: {
      rebuildAt: now,
      rebuildForce: force || (!!card?.rebuildAt && card.rebuildForce),
      ...(card?.leaseOwner ? {} : { leaseExpiresAt: null }),
    },
  });
  return true;
}

/** Sets a draft to `status`. False: the version is not a draft (an admin did it first). */
async function review(versionId: string, status: 'published' | 'discarded'): Promise<boolean> {
  const { count } = await prisma.openAuditCardVersion.updateMany({
    where: { id: versionId, status: 'draft' },
    data: { status, reviewedAt: new Date() },
  });
  return count > 0;
}

export const publishCardVersion = (versionId: string) => review(versionId, 'published');
export const discardCardVersion = (versionId: string) => review(versionId, 'discarded');

/**
 * Removes the model's OpenAudit from the public site. With no draft, the newest published version
 * goes back to draft, so an admin can publish it again. Other published versions are discarded.
 * False: the model has no published version.
 */
export async function unpublishCard(modelId: string): Promise<boolean> {
  const versions = await prisma.openAuditCardVersion.findMany({
    where: { card: { modelId }, status: { in: ['draft', 'published'] } },
    orderBy: { number: 'desc' },
    select: { id: true, status: true },
  });
  const published = versions.filter((v) => v.status === 'published');
  if (!published.length) return false;
  const back = versions.some((v) => v.status === 'draft') ? null : published[0];
  const discard = published.filter((v) => v !== back).map((v) => v.id);
  await prisma.$transaction([
    prisma.openAuditCardVersion.updateMany({
      where: { id: { in: discard }, status: 'published' },
      data: { status: 'discarded', reviewedAt: new Date() },
    }),
    ...(back
      ? [
          prisma.openAuditCardVersion.updateMany({
            where: { id: back.id, status: 'published' },
            data: { status: 'draft', reviewedAt: null },
          }),
        ]
      : []),
  ]);
  return true;
}

export type DraftEmailResult = 'sent' | 'failed' | 'already_sent' | 'not_draft' | 'no_admins';

/**
 * Emails the admins that a card draft is ready, with a preview link. The runner calls it after a
 * build, and again each hour until the email goes. Null: no such version.
 */
export async function cardDraftReady(versionId: string): Promise<DraftEmailResult | null> {
  const version = await prisma.openAuditCardVersion.findUnique({
    where: { id: versionId },
    select: {
      ...VERSION,
      emailedAt: true,
      _count: { select: { runs: true, snippets: true } },
      card: {
        select: {
          model: { select: { name: true, displayName: true } },
          versions: { where: { status: 'published' }, orderBy: { number: 'desc' }, take: 1, select: { number: true } },
        },
      },
    },
  });
  if (!version) return null;
  if (version.status !== 'draft') return 'not_draft';
  if (version.emailedAt) return 'already_sent';
  const to = await adminEmails();
  if (!to.length) {
    console.error(`[email] card draft ${versionId} is ready, but no admin address is set`);
    return 'no_admins';
  }
  // The claim stops a second email when two calls come at the same time.
  const claim = await prisma.openAuditCardVersion.updateMany({
    where: { id: versionId, status: 'draft', emailedAt: null },
    data: { emailedAt: new Date() },
  });
  if (!claim.count) return 'already_sent';
  const { model, versions } = version.card;
  const published = versions[0]?.number;
  const content = adminAlertEmail({
    subject: `Card draft ready: ${model.displayName} v${version.number}`,
    lines: [
      `A new OpenAudit draft of ${model.displayName} (${model.name}) is ready: version ${version.number}, from ${version._count.runs} runs and ${version._count.snippets} snippets. It cost $${version.costUsd.toFixed(2)}.`,
      published
        ? `Until you publish it, the public sees version ${published}.`
        : 'The model has no published card yet. The public sees no card until you publish it.',
      `Preview: ${NEXT_PUBLIC_URL}${openAuditPath(model, version.number)}`,
      `Publish or discard it: ${NEXT_PUBLIC_URL}/admin/cards`,
    ],
  });
  const sent = await deliver(to, 'card_draft', content).catch((e) => ({
    providerMessageId: null,
    error: e instanceof Error ? e.message : String(e),
  }));
  await prisma.emailLog
    .create({
      data: { to: to.join(', '), toKey: inboxKey(to[0]), type: 'card_draft', subject: content.subject, ...sent },
    })
    .catch((e) => console.error(`[email] card draft ${versionId}: no email log`, e));
  if (!sent.error) return 'sent';
  console.error(`[email] card draft ${versionId} failed: ${sent.error}`);
  await prisma.openAuditCardVersion.updateMany({ where: { id: versionId }, data: { emailedAt: null } });
  return 'failed';
}
