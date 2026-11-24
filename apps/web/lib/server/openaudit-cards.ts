import type { PdfTarget } from '@/components/pdf-viewer';
import { prisma } from '@/lib/db';
import { NEXT_PUBLIC_URL } from '@/lib/env';
import { jlensTokens } from '@/lib/jlens';
import { CANARY, NO_TRAINING } from '@/lib/legal';
import type {
  CardFinding,
  CardSummary,
  CoverageGap,
  RiskVerdict,
  SnippetExcerpt,
  SnippetResponse,
  TopicSummary,
} from '@/lib/openaudit-card';
import { attemptRule } from '@/lib/runs/terms';
import { modelPath, savedCopyUrl } from '@/lib/server/catalog';
import { excludedAttempts } from '@/lib/server/excluded-attempts';
import { attemptHazards, lockedAttempts } from '@/lib/server/hazard';
import { cardVersionRuns } from '@/lib/server/latest-runs';
import { replySummary } from '@/lib/server/runs';
import { sampleRefs } from '@/lib/server/sample-refs';
import { sampleAccess } from '@/lib/server/terms';
import { evalVersionFromRow } from '@/lib/spec/rows';
import type { DisplayRule, Hazard, Model, TokenUsage } from '@openaudit/spec';

/** A model's OpenAudit is on its model page. `version`: an older or draft version. */
export function openAuditPath(m: Pick<Model, 'name'>, version?: number) {
  return `${modelPath(m)}${version ? `?v=${version}` : ''}`;
}

export type CardVersionStatus = 'draft' | 'published' | 'discarded';

/** The snippets of a version, without their excerpts: the page loads one when the reader opens it.
 * `tokens`: the `jlensTokens` of its attempt. */
async function snippetsOf(versionId: string) {
  const rows = await prisma.openAuditSnippet.findMany({
    where: { versions: { some: { versionId } } },
    omit: { excerpt: true },
    include: { run: { select: { id: true, eval: { select: { slug: true, displayName: true, topics: true } } } } },
    orderBy: [{ runId: 'asc' }, { ordinal: 'asc' }, { id: 'asc' }],
  });
  const ids = rows.map((s) => s.attemptId);
  const [sample, locked, excluded, usage] = await Promise.all([
    sampleRefs(ids),
    lockedAttempts(ids),
    excludedAttempts(ids),
    prisma.evalAttempt.findMany({ where: { id: { in: ids } }, select: { id: true, tokens: true } }),
  ]);
  const tokens = new Map(usage.map((a) => [a.id, jlensTokens(a.tokens as TokenUsage)]));
  return rows
    .filter((s) => !excluded.has(s.attemptId))
    .map((s) => ({
      id: s.id,
      runId: s.runId,
      ordinal: s.ordinal,
      sample: sample(s.attemptId),
      eval: s.run.eval,
      category: s.category,
      severity: s.severity,
      title: s.title,
      reason: s.reason,
      flagger: s.flagger,
      locked: locked.has(s.attemptId),
      tokens: tokens.get(s.attemptId) ?? null,
    }));
}

/** A snippet in a published version (with `drafts`, in any version), its attempt's display rule
 * and hazard level, and the viewer's access. Null if none. */
async function snippetAccess(id: string, drafts: boolean) {
  const row = await prisma.openAuditSnippet.findFirst({
    where: { id, versions: { some: drafts ? {} : { version: { status: 'published' } } } },
    select: {
      excerpt: true,
      attemptId: true,
      run: { select: { evalVersion: true, eval: { select: { canary: true } } } },
    },
  });
  if (!row) return null;
  const attempt = await prisma.evalAttempt.findUnique({
    where: { id: row.attemptId },
    select: { display: true, hazard: true },
  });
  const version = evalVersionFromRow(row.run.evalVersion);
  const display = (attempt?.display ?? undefined) as DisplayRule | undefined;
  const access = await sampleAccess(version);
  const level =
    (await attemptHazards([{ id: row.attemptId, hazard: attempt?.hazard as Hazard | null }])).get(row.attemptId) ??
    null;
  return { row, version, display, access, level };
}

/** A withheld reply: its hazard level and its summary (null: none yet). */
export type Withheld = { withheld: Hazard; summary: string | null };

const withheldOf = async (attemptId: string, level: Hazard): Promise<Withheld> => ({
  withheld: level,
  summary: await replySummary({ id: attemptId, hazard: level }),
});

/** The snippet's `Withheld` if the viewer cannot read its reply even with the statement, else
 * null. It shows no content, so the API sends it before it asks for the statement. */
export async function snippetWithheld(id: string, { drafts = false } = {}): Promise<Withheld | null> {
  const found = await snippetAccess(id, drafts);
  return found?.level && !found.access.hazardAllows(found.level) ? withheldOf(found.row.attemptId, found.level) : null;
}

/**
 * The excerpt of a snippet in a published version (with `drafts`, in any version), with the
 * training notice and the canaries. Null if none; `hidden` if the dataset's terms forbid the viewer;
 * a hazard level if the viewer cannot read the reply (`lib/runs/hazard.ts`).
 */
export async function snippetExcerpt(
  id: string,
  { drafts = false } = {},
): Promise<SnippetResponse | 'hidden' | Withheld | null> {
  const found = await snippetAccess(id, drafts);
  if (!found) return null;
  const { row, version, display, access, level } = found;
  if (!access.canRead(attemptRule(version, { display }))) return 'hidden';
  if (level && !access.canReadReply(level)) return withheldOf(row.attemptId, level);
  return {
    ...(row.excerpt as SnippetExcerpt),
    notice: `${NO_TRAINING} Terms: ${NEXT_PUBLIC_URL}/terms#ai-training`,
    canary: CANARY,
    evalCanary: row.run.eval.canary,
  };
}

/** The PDF targets of a summary's system card cites, by cite id. A cite without a saved PDF has none. */
async function citeTargets(summary: CardSummary | null): Promise<Record<string, PdfTarget>> {
  const cites = typeof summary === 'object' && summary?.cites ? Object.entries(summary.cites) : [];
  if (!cites.length) return {};
  const docs = await prisma.document.findMany({
    where: { id: { in: [...new Set(cites.map(([, c]) => c.documentId))] }, fileType: 'pdf' },
    select: { id: true, title: true, url: true, fileKey: true },
  });
  const byId = new Map(docs.map((d) => [d.id, d]));
  return Object.fromEntries(
    cites.flatMap(([key, c]) => {
      const d = byId.get(c.documentId);
      const url = d?.fileKey && savedCopyUrl({ fileKey: d.fileKey });
      if (!d || !url) return [];
      const target: PdfTarget = {
        url,
        title: d.title,
        originalUrl: d.url,
        ...(c.page && { page: c.page }),
        ...(c.pageLabel && { pageLabel: c.pageLabel }),
        ...(c.quote && { quote: c.quote }),
      };
      return [[key, target]];
    }),
  );
}

/**
 * A card version of the model (the newest published when `number` is not given), with the list
 * of versions, the runs it used and its snippets. Only published versions, but with `drafts` (an
 * admin) also drafts in the list, and any version by number. Null when there is no such version.
 */
export async function getOpenAuditCard(modelId: string, number?: number, { drafts = false } = {}) {
  const card = await prisma.openAuditCard.findUnique({
    where: { modelId },
    include: {
      versions: {
        where: drafts ? undefined : { status: 'published' },
        orderBy: { number: 'desc' },
        select: {
          id: true,
          number: true,
          status: true,
          createdAt: true,
          aggregator: true,
          _count: { select: { runs: true } },
        },
      },
    },
  });
  if (!card) return null;
  const published = card.versions.filter((v) => v.status === 'published');
  const entry = number
    ? card.versions.find((v) => v.number === number)
    : (published[0] ?? card.versions.find((v) => v.status === 'draft'));
  if (!entry) return null;
  const listed = card.versions.filter((v) => v.status !== 'discarded' || v.id === entry.id);
  const [version, runs, snippets] = await Promise.all([
    prisma.openAuditCardVersion.findUniqueOrThrow({ where: { id: entry.id } }),
    cardVersionRuns(entry.id),
    snippetsOf(entry.id),
  ]);
  const flagger = version.flagger ?? snippets[0]?.flagger ?? null;
  // The flaggers that read attempts which the first flagger's safety filter blocked.
  const checks = (version.tokens as { flagger?: { byFlagger?: Record<string, number> } } | null)?.flagger;
  const fallbacks = [...new Set([...Object.keys(checks?.byFlagger ?? {}), ...snippets.map((s) => s.flagger)])].filter(
    (f) => f !== flagger,
  );
  const [cites, reviewers] = await Promise.all([
    citeTargets(version.summary as CardSummary | null),
    prisma.model.findMany({
      where: { name: { in: [version.aggregator, ...(flagger ? [flagger] : []), ...fallbacks] } },
      select: { name: true, displayName: true },
    }),
  ]);
  const shown = (id: string) => reviewers.find((m) => m.name === id)?.displayName ?? id;
  return {
    versions: listed.map((v) => ({
      number: v.number,
      status: v.status as CardVersionStatus,
      createdAt: v.createdAt,
      aggregator: v.aggregator,
      runCount: v._count.runs,
    })),
    version: {
      id: version.id,
      number: version.number,
      status: version.status as CardVersionStatus,
      createdAt: version.createdAt,
      aggregator: version.aggregator,
      flagger,
      // Display names of the aggregator and the flagger, or their OpenRouter ids.
      builtBy: shown(version.aggregator),
      // The first flagger, then the fallbacks.
      flaggedBy: flagger ? [flagger, ...fallbacks].map(shown).join(', ') : null,
      promptVersion: version.promptVersion,
      costUsd: version.costUsd,
      summary: version.summary as CardSummary | null,
      findings: version.findings as CardFinding[],
      verdicts: version.verdicts as RiskVerdict[],
      topics: version.topics as TopicSummary[],
      gaps: version.gaps as CoverageGap[],
    },
    // The newest published number; null before the first publish.
    latest: published[0]?.number ?? null,
    runs,
    snippets,
    cites,
  };
}

export type OpenAuditCardView = NonNullable<Awaited<ReturnType<typeof getOpenAuditCard>>>;
