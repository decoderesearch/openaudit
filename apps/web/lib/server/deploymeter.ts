import { Prisma } from '#prisma';
import { prisma } from '@/lib/db';
import {
  abstains,
  counts,
  deploymeter,
  evidencePacket,
  HUMAN_REVIEWS_ENABLED,
  median,
  MIN_HUMANS,
  reviewPath,
  titleOf,
  type Evidence,
} from '@/lib/deploymeter';
import { LADDERS, roleModels } from '@/lib/model-ladders';
import { modelPath } from '@/lib/server/catalog';
import type { Viewer } from '@/lib/server/viewer';
import type { DeployGuess, DeployPanelSummary, DeployReviewSample } from '@openaudit/spec';

export type PanelStatus = 'draft' | 'published' | 'discarded';

/** Display names of OpenRouter ids, from the catalog (any case), else the id. */
async function judgeNames(ids: string[]): Promise<Map<string, string>> {
  const rows = ids.length
    ? await prisma.model.findMany({
        where: { name: { in: ids, mode: 'insensitive' } },
        select: { name: true, displayName: true },
      })
    : [];
  const byLower = new Map(rows.map((r) => [r.name.toLowerCase(), r.displayName]));
  return new Map(ids.map((id) => [id, byLower.get(id.toLowerCase()) ?? titleOf(id)]));
}

export const PANEL_JUDGES = roleModels('deploy_judge');
const OPEN = new Set(LADDERS.openWeights ?? []);
export const isOpenWeights = (judge: string) => OPEN.has(judge);

/**
 * The model's Deploymeter: the newest published AI panel with its reviews (for admins, a newer
 * draft first), and the human reviews. `cardVersion`: only panels on that OpenAudit version.
 * Null when the model has no panel and no human review.
 */
export async function getDeploymeter(
  modelId: string,
  viewer: Viewer | null,
  { drafts = false, cardVersion }: { drafts?: boolean; cardVersion?: number } = {},
) {
  const [panels, humans] = await Promise.all([
    prisma.deployPanel.findMany({
      where: {
        modelId,
        status: drafts ? { in: ['draft', 'published'] } : 'published',
        ...(cardVersion !== undefined && { cardVersion: { number: cardVersion } }),
      },
      orderBy: { number: 'desc' },
      take: 2,
      include: { reviews: true, cardVersion: { select: { number: true } } },
    }),
    prisma.deployHumanReview.findMany({
      where: HUMAN_REVIEWS_ENABLED ? { modelId } : { id: { in: [] } },
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { name: true, username: true, affiliation: true } },
        cardVersion: { select: { number: true } },
      },
    }),
  ]);
  const panel = panels[0] ?? null;
  const published = panels.find((p) => p.status === 'published') ?? null;
  const names = await judgeNames(panel?.reviews.map((r) => r.judge) ?? []);
  const order = new Map((panel?.judges ?? []).map((j, i) => [j, i]));
  const reviews = (panel?.reviews ?? [])
    .map((r) => ({
      id: r.id,
      judge: r.judge,
      judgeName: names.get(r.judge) ?? r.judge,
      openWeights: r.openWeights,
      sameLab: r.sameLab,
      self: r.self,
      score: r.score,
      abstain: r.abstain,
      enoughEvidence: r.enoughEvidence,
      headline: r.headline,
      summary: r.summary,
      reasonsFor: r.reasonsFor,
      reasonsAgainst: r.reasonsAgainst,
      samples: (r.samples as { score: number }[]).map((s) => s.score),
      guess: r.guess as DeployGuess | null,
      error: r.error,
      evidence: r.evidence as Evidence,
      href: reviewPath(r.judge, r.id),
    }))
    .sort(
      (a, b) =>
        Number(counts(b)) - Number(counts(a)) ||
        Number(abstains(b)) - Number(abstains(a)) ||
        (order.get(a.judge) ?? 0) - (order.get(b.judge) ?? 0),
    );
  const humanScores = humans.map((h) => h.score);
  const ai = panel?.meter ?? null;
  if (!panel && !humans.length) return null;
  return {
    panel: panel && {
      id: panel.id,
      number: panel.number,
      status: panel.status as PanelStatus,
      createdAt: panel.createdAt,
      cardVersion: panel.cardVersion.number,
      promptVersion: panel.promptVersion,
      prompts: panel.prompts as { judge?: string; guess?: string } | null,
      summary: panel.summary as DeployPanelSummary | null,
      costUsd: panel.costUsd,
    },
    /** The published panel's number, when the shown panel is a newer draft. */
    publishedNumber: published && published.id !== panel?.id ? published.number : null,
    ai,
    reviews,
    counted: reviews.filter(counts).length,
    abstained: reviews.filter(abstains).length,
    approvals: reviews.filter((r) => counts(r) && r.score! >= 70).length,
    withLimits: reviews.filter((r) => counts(r) && r.score! >= 50 && r.score! < 70).length,
    /** How many judges named the developer, of the judges that guessed. */
    guesses: {
      right: reviews.filter((r) => r.guess?.rightDeveloper).length,
      total: reviews.filter((r) => r.guess).length,
    },
    humans: humans.map((h) => ({
      id: h.id,
      score: h.score,
      text: h.text,
      name: h.user.username ? `@${h.user.username}` : h.user.name,
      affiliation: h.user.affiliation,
      cardVersion: h.cardVersion?.number ?? null,
      updatedAt: h.updatedAt,
      mine: viewer?.id === h.userId,
    })),
    human: humans.length >= MIN_HUMANS ? median(humanScores) : null,
    meter: deploymeter(ai, humanScores),
  };
}

export type DeploymeterView = NonNullable<Awaited<ReturnType<typeof getDeploymeter>>>;
export type DeployReviewView = DeploymeterView['reviews'][number];

/** Admins only: publishes a draft panel (the model's older published panels stay in history), or
 * discards it. False when it is not a draft now. */
export async function reviewPanel(panelId: string, publish: boolean): Promise<boolean> {
  const { count } = await prisma.deployPanel.updateMany({
    where: { id: panelId, status: 'draft' },
    data: { status: publish ? 'published' : 'discarded', reviewedAt: new Date() },
  });
  return count === 1;
}

/** Saves the viewer's review of the model (one for each user and model; an edit replaces it), on
 * the model's newest published card version. */
export async function saveHumanReview(viewer: Viewer, modelId: string, score: number, text: string) {
  const version = await prisma.openAuditCardVersion.findFirst({
    where: { card: { modelId }, status: 'published' },
    orderBy: { number: 'desc' },
    select: { id: true },
  });
  const data = { score, text, cardVersionId: version?.id ?? null };
  return prisma.deployHumanReview.upsert({
    where: { userId_modelId: { userId: viewer.id, modelId } },
    create: { ...data, userId: viewer.id, modelId },
    update: data,
  });
}

export async function deleteHumanReview(viewer: Viewer, modelId: string) {
  const { count } = await prisma.deployHumanReview.deleteMany({ where: { userId: viewer.id, modelId } });
  return count === 1;
}

/** Each judge with published reviews, and the judges of the panel now: its review count, average
 * score, how far it is from each panel's median (on average), and how often it guessed the developer. */
export async function judgeList() {
  const reviews = await prisma.deployReview.findMany({
    where: { panel: { status: 'published' } },
    select: { judge: true, score: true, sameLab: true, self: true, guess: true, panel: { select: { meter: true } } },
  });
  const ids = [...new Set([...PANEL_JUDGES, ...reviews.map((r) => r.judge)])];
  const names = await judgeNames(ids);
  return ids.map((judge) => {
    const own = reviews.filter((r) => r.judge === judge && r.score !== null);
    const scored = own.map((r) => r.score!);
    const gaps = own.flatMap((r) => (r.panel.meter === null ? [] : [Math.abs(r.score! - r.panel.meter)]));
    const guesses = own.flatMap((r) => (r.guess ? [(r.guess as unknown as DeployGuess).rightDeveloper] : []));
    return {
      judge,
      name: names.get(judge) ?? judge,
      onPanel: PANEL_JUDGES.includes(judge),
      openWeights: isOpenWeights(judge),
      reviews: own.length,
      average: scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null,
      distance: gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null,
      guessRate: guesses.length ? guesses.filter(Boolean).length / guesses.length : null,
    };
  });
}

/** Each prompt version of the published panels, newest first: its system prompts (from its newest
 * panel), its panel count and its dates. Not the evidence: each review page shows it. */
export async function judgePrompts() {
  const where = { status: 'published', prompts: { not: Prisma.DbNull } };
  const [newest, groups] = await Promise.all([
    prisma.deployPanel.findMany({
      where,
      distinct: ['promptVersion'],
      orderBy: { createdAt: 'desc' },
      select: { promptVersion: true, prompts: true },
    }),
    prisma.deployPanel.groupBy({
      by: ['promptVersion'],
      where,
      _count: true,
      _min: { createdAt: true },
      _max: { createdAt: true },
    }),
  ]);
  const by = new Map(groups.map((c) => [c.promptVersion, c]));
  return newest
    .map((p) => {
      const c = by.get(p.promptVersion);
      const prompts = p.prompts as { judge?: string; guess?: string };
      return {
        version: p.promptVersion,
        judge: prompts.judge ?? null,
        guess: prompts.guess ?? null,
        panels: c?._count ?? 0,
        first: c?._min.createdAt ?? null,
        last: c?._max.createdAt ?? null,
      };
    })
    .sort((a, b) => (b.last?.getTime() ?? 0) - (a.last?.getTime() ?? 0));
}

export type JudgePromptVersion = Awaited<ReturnType<typeof judgePrompts>>[number];

/** One judge's reviews in published panels, newest panel first, with the model each is about. */
export async function judgeReviews(judge: string) {
  const rows = await prisma.deployReview.findMany({
    where: { judge, panel: { status: 'published' } },
    orderBy: { createdAt: 'desc' },
    include: {
      panel: {
        select: {
          number: true,
          meter: true,
          createdAt: true,
          model: { select: { name: true, displayName: true, organization: { select: { displayName: true } } } },
        },
      },
    },
  });
  if (!rows.length && !PANEL_JUDGES.includes(judge)) return null;
  const name = (await judgeNames([judge])).get(judge) ?? judge;
  return {
    judge,
    name,
    onPanel: PANEL_JUDGES.includes(judge),
    openWeights: isOpenWeights(judge),
    reviews: rows.map((r) => ({
      id: r.id,
      model: r.panel.model.displayName,
      developer: r.panel.model.organization.displayName,
      modelHref: `${modelPath(r.panel.model)}#deploymeter`,
      href: reviewPath(judge, r.id),
      panel: r.panel.number,
      panelScore: r.panel.meter,
      date: r.panel.createdAt,
      score: r.score,
      abstain: r.abstain,
      sameLab: r.sameLab,
      self: r.self,
      headline: r.headline,
      summary: r.summary,
      reasonsFor: r.reasonsFor,
      reasonsAgainst: r.reasonsAgainst,
      guess: r.guess as DeployGuess | null,
      error: r.error,
      evidence: r.evidence as Evidence,
    })),
  };
}

/** One review in full: each answer with its reasoning, the guess, the prompts and the packet that
 * the judge read. A draft or discarded panel's review is for admins only. */
export async function judgeReview(judge: string, reviewId: string, { drafts = false } = {}) {
  const r = await prisma.deployReview.findFirst({
    where: {
      id: reviewId,
      judge,
      panel: { status: drafts ? { in: ['draft', 'published', 'discarded'] } : 'published' },
    },
    include: {
      panel: {
        select: {
          id: true,
          number: true,
          status: true,
          meter: true,
          createdAt: true,
          promptVersion: true,
          prompts: true,
          cardVersion: { select: { number: true } },
          packet: { select: { content: true, scrubVersion: true, scrubber: true } },
          model: { select: { name: true, displayName: true, organization: { select: { displayName: true } } } },
        },
      },
    },
  });
  if (!r) return null;
  const name = (await judgeNames([judge])).get(judge) ?? judge;
  const prompts = r.panel.prompts as { judge?: string; guess?: string } | null;
  return {
    id: r.id,
    judge,
    name,
    openWeights: r.openWeights,
    sameLab: r.sameLab,
    self: r.self,
    score: r.score,
    abstain: r.abstain,
    enoughEvidence: r.enoughEvidence,
    error: r.error,
    evidence: r.evidence as Evidence,
    costUsd: r.costUsd,
    tokens: r.tokens as { input?: number; output?: number; calls?: number } | null,
    answers: r.samples as unknown as DeployReviewSample[],
    shownHeadline: r.headline,
    guess: r.guess as DeployGuess | null,
    panel: {
      id: r.panel.id,
      number: r.panel.number,
      status: r.panel.status as PanelStatus,
      meter: r.panel.meter,
      date: r.panel.createdAt,
      promptVersion: r.panel.promptVersion,
      cardVersion: r.panel.cardVersion.number,
      judgePrompt: prompts?.judge ?? null,
      guessPrompt: prompts?.guess ?? null,
      packet: evidencePacket(r.panel.packet.content, r.evidence as Evidence),
      scrub: `${r.panel.packet.scrubVersion}${r.panel.packet.scrubber ? `, ${r.panel.packet.scrubber}` : ''}`,
    },
    model: {
      name: r.panel.model.displayName,
      developer: r.panel.model.organization.displayName,
      href: `${modelPath(r.panel.model)}#deploymeter`,
    },
  };
}

/** Admins only: each model's newest panels (draft first), for the admin page. */
export async function adminPanels() {
  const rows = await prisma.deployPanel.findMany({
    where: { status: { in: ['draft', 'published'] } },
    orderBy: [{ createdAt: 'desc' }],
    include: {
      model: { select: { id: true, name: true, displayName: true, organization: { select: { displayName: true } } } },
      cardVersion: { select: { number: true } },
      reviews: { select: { score: true, abstain: true, sameLab: true, self: true, guess: true, error: true } },
    },
  });
  return rows.map((p) => ({
    id: p.id,
    number: p.number,
    status: p.status as PanelStatus,
    createdAt: p.createdAt,
    meter: p.meter,
    costUsd: p.costUsd,
    cardVersion: p.cardVersion.number,
    model: { ...p.model, href: `${modelPath(p.model)}#deploymeter` },
    judges: p.reviews.length,
    counted: p.reviews.filter(counts).length,
    abstained: p.reviews.filter(abstains).length,
    failed: p.reviews.filter((r) => r.score === null && !r.abstain).length,
    guessed: p.reviews.filter((r) => (r.guess as DeployGuess | null)?.rightDeveloper).length,
    guesses: p.reviews.filter((r) => r.guess).length,
  }));
}

export type AdminPanel = Awaited<ReturnType<typeof adminPanels>>[number];
