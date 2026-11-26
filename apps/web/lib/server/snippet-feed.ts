import { Prisma } from '#prisma';
import type { Score } from '@/components/catalog/score';
import type { SnippetRef } from '@/components/evidence-hover';
import { prisma } from '@/lib/db';
import type { MeterJudge } from '@/lib/deploymeter';
import { CHAT_GROUPS, chatGroup, firstOfEachGroup, inTurns, type ChatGroup } from '@/lib/feed';
import { newest } from '@/lib/home-sorts';
import type { Place } from '@/lib/leaders';
import { isCounted, type SnippetSeverity } from '@/lib/openaudit-card';
import { organizationPath } from '@/lib/organizations';
import { sampleRef } from '@/lib/sample-label';
import {
  getOrganization,
  isListed,
  meterJudges,
  modelPath,
  PUBLISHED_METERS,
  type PublishedJudge,
} from '@/lib/server/catalog';
import { evalStandings } from '@/lib/server/eval-ranks';
import { excludedAttempt } from '@/lib/server/excluded-attempts';
import { attemptHazard, lockedForPublic } from '@/lib/server/hazard';
import { modelCardFlags } from '@/lib/server/model-cards';
import { attemptPath, evalRunLinksByModel } from '@/lib/server/runs';
import { ttlCache, ttlCacheBy } from '@/lib/server/ttl-cache';
import { snippetTopics } from '@/lib/snippet-topics';
import { HIDDEN_TOPICS } from '@/lib/topics';
import type { Hazard, SampleTerms } from '@openaudit/spec';
import { cache } from 'react';

/** The flagged chats in one model's newest published OpenAudit card: by severity group, the chats
 * that a reader can open first, then the most severe.
 * `date`: the day the version was published. `counts`: the chats in each group; a page can send
 * fewer. `topics`: the flagged chats of each topic. `evals`: the evals with a finished public run of
 * the model, each as `FeedEval`. `meter` and `judges`: as
 * `PUBLISHED_METERS`. `summary`: the text summary of the newest published panel. `snippets`: in
 * the feed, the first chats of each group (`firstOfEachGroup`); `snippetFeedChats` gives all. */
export type SnippetFeedEntry = {
  key: string;
  label: string;
  href: string;
  org: { label: string; href: string };
  date: string;
  version: number;
  evals: FeedEval[];
  meter: number | null;
  judges: MeterJudge[] | null;
  summary: string | null;
  counts: Record<ChatGroup, number>;
  topics: FeedTopic[];
  snippets: SnippetRef[];
};

/** An eval of the model: its slug and name, a run, and the run's headline result. `place`: the
 * model's rank of all models on the eval (1 is the safest), from the run. With no `place`, the
 * run is the newest. `flags`: the card's high and medium flagged chats from the eval. */
export type FeedEval = {
  slug: string;
  label: string;
  href: string;
  result: Score | null;
  place: Place | null;
  flags: EvalFlags;
};

/** Flagged chats by group; a critical chat counts as high. */
export type EvalFlags = { high: number; medium: number };

/** A topic's flagged chats: `counted`, those of high or medium severity; `low`, the rest. */
export type FeedTopic = { topic: string; counted: number; low: number };

const ORDER: SnippetSeverity[] = ['critical', 'high', 'medium', 'low'];

/** The models whose chats the feed reads at the same time. */
const MODELS_AT_ONCE = 4;

/** All entries, the newest model release first; models with no release date go last. A model
 * with no flagged chat is left out. The callers in one request share one load. */
export const snippetFeed = cache(ttlCache(() => loadFeed(), 300_000, 'snippet-feed'));

/** The entries of the organization with slug `org` only. */
export const snippetFeedFor = ttlCacheBy((org: string) => loadFeed(org), 300_000);

/** For the organization with slug `org`: its models in the feed, their mean Deploymeter score
 * (rounded), and the day of the newest card. `average` and `latest` are null when there are none. */
export const auditSummary = cache(async (org: string) => {
  const versions = await feedVersions(org);
  const scores = versions.map((v) => (v.meter === null ? null : Number(v.meter)));
  const scored = scores.filter((s) => s !== null);
  const days = versions.map((v) => v.reviewedAt.toISOString().slice(0, 10)).sort();
  return {
    models: scores.length,
    average: scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null,
    latest: days.at(-1) ?? null,
  };
});

/** For the organization with slug `org`: its models in the feed, in the Models feed's order, with
 * the Deploymeter score and the day of the card. */
export const auditedModels = cache(async (org: string) =>
  (await feedVersions(org))
    .map((v) => ({
      label: v.modelLabel,
      href: modelPath({ name: v.modelName }),
      meter: v.meter === null ? null : Math.round(Number(v.meter)),
      date: v.reviewedAt.toISOString().slice(0, 10),
      released: v.released,
    }))
    .sort(feedSort),
);

/** The listed models of the organization with slug `org` that are not in the feed. */
export const unauditedModels = cache(async (org: string) => {
  const found = await getOrganization(org);
  if (!found) return [];
  const [versions, cards] = await Promise.all([feedVersions(org), modelCardFlags(found.models)]);
  const audited = new Set(versions.map((v) => v.modelId));
  return found.models.filter((m) => isListed(m, !!cards.get(m.id)?.openAuditCard) && !audited.has(m.id));
});

// For each model in turn, the small fields of its chats give the order, counts and topics. Then
// one read gets the text of only the chats that the feed shows. All chats of all models do not
// fit in a Worker's memory.
async function loadFeed(org?: string): Promise<SnippetFeedEntry[]> {
  const versions = await feedVersions(org);
  if (!versions.length) return [];
  const ids = [...new Set(versions.map((v) => v.modelId))];
  const links = Promise.all([evalRunLinksByModel(ids), panelSummaries(ids), evalStandings()]);
  const chats = new Map<
    string,
    { counts: Record<ChatGroup, number>; topics: FeedTopic[]; shown: ChatKey[]; byEval: Map<string, EvalFlags> }
  >();
  for (let i = 0; i < versions.length; i += MODELS_AT_ONCE)
    await Promise.all(
      versions.slice(i, i + MODELS_AT_ONCE).map(async (v) => {
        const all = await chatKeys(v.id);
        chats.set(v.id, {
          counts: Object.fromEntries(
            CHAT_GROUPS.map((g) => [g, all.filter((k) => chatGroup(k.severity) === g).length]),
          ) as Record<ChatGroup, number>,
          topics: feedTopics(all),
          shown: firstOfEachGroup(feedOrder(all)),
          byEval: evalFlags(all),
        });
      }),
    );
  const [[evals, summaries, standings], texts] = await Promise.all([
    links,
    chatTexts([...chats.values()].flatMap((c) => c.shown.map((k) => k.id))),
  ]);
  const released = new Map(versions.map((v) => [v.id, v.released]));
  return versions
    .map((v): SnippetFeedEntry => {
      const { counts, topics, shown, byEval } = chats.get(v.id)!;
      return {
        key: v.id,
        label: v.modelLabel,
        href: modelPath({ name: v.modelName }),
        org: { label: v.orgLabel, href: organizationPath({ slug: v.orgSlug }) },
        date: v.reviewedAt.toISOString().slice(0, 10),
        version: v.number,
        evals: (evals.get(v.modelId) ?? []).map(({ evalId, slug, label, href, result }) => {
          const p = standings[evalId]?.places[v.modelId];
          const flags = byEval.get(slug) ?? { high: 0, medium: 0 };
          return p
            ? { slug, label, href: p.href, result: p.result, place: { rank: p.rank, of: p.of }, flags }
            : { slug, label, href, result, place: null, flags };
        }),
        meter: v.meter,
        judges: v.judges && meterJudges(v.judges),
        summary: summaries.get(v.modelId) ?? null,
        counts,
        topics,
        snippets: chatRefs(shown, texts),
      };
    })
    .sort((a, b) => feedSort({ ...a, released: released.get(a.key)! }, { ...b, released: released.get(b.key)! }));
}

/** The feed's order: the newest release first, then the newest card, then by name. */
type Ordered = { date: string; released: string; label: string };
const feedSort = (a: Ordered, b: Ordered) =>
  b.released.localeCompare(a.released) || b.date.localeCompare(a.date) || a.label.localeCompare(b.label);

/** The paths of an organization's models in the feed, in the order of the Models feed's default
 * sort. `organizationId`: the organization's id. */
export const feedModelOrder = cache(async (organizationId: string) =>
  (await feedVersions({ id: organizationId }))
    .map((v) => ({
      href: modelPath({ name: v.modelName }),
      date: v.reviewedAt.toISOString().slice(0, 10),
      released: v.released,
      label: v.modelLabel,
    }))
    .sort(feedSort)
    .sort(newest)
    .map((v) => v.href),
);

/** The text summary of each model's newest published panel, as `PUBLISHED_METERS` picks it. */
async function panelSummaries(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const rows = await prisma.$queryRaw<{ id: string; summary: string | null }[]>`
    SELECT DISTINCT ON ("modelId") "modelId" AS id, summary ->> 'summary' AS summary
    FROM deploy_panel
    WHERE status = 'published' AND meter IS NOT NULL AND "modelId" = ANY(${ids}::uuid[])
    ORDER BY "modelId", number DESC`;
  return new Map(rows.flatMap((r) => (r.summary ? [[r.id, r.summary] as const] : [])));
}

/** The high and medium chats of each eval, by eval slug. */
function evalFlags(chats: ChatKey[]): Map<string, EvalFlags> {
  const out = new Map<string, EvalFlags>();
  for (const c of chats) {
    const g = chatGroup(c.severity);
    if (g === 'low') continue;
    const f = out.get(c.evalSlug) ?? { high: 0, medium: 0 };
    f[g]++;
    out.set(c.evalSlug, f);
  }
  return out;
}

/** Each shown topic's flagged chats, the most high and medium severity chats first. */
function feedTopics(snippets: { severity: SnippetSeverity; topics: string[] }[]): FeedTopic[] {
  const topics = new Map<string, FeedTopic>();
  for (const s of snippets)
    for (const topic of s.topics) {
      if (HIDDEN_TOPICS.includes(topic)) continue;
      const t = topics.get(topic) ?? { topic, counted: 0, low: 0 };
      if (isCounted(s)) t.counted++;
      else t.low++;
      topics.set(topic, t);
    }
  return [...topics.values()].sort((a, b) => b.counted - a.counted || b.low - a.low || a.topic.localeCompare(b.topic));
}

/** A version of `feedVersions`. `meter` and `judges`: as `PUBLISHED_METERS`. */
type FeedVersion = {
  id: string;
  number: number;
  reviewedAt: Date;
  modelId: string;
  modelName: string;
  modelLabel: string;
  released: string;
  orgSlug: string;
  orgLabel: string;
  meter: number | null;
  judges: PublishedJudge[] | null;
};

/** The newest published version of each model's card, if it has flagged chats. Like `SHOWN_MODEL`,
 * it leaves out hidden models and organizations. `org`: only the organization with this slug or id. */
function feedVersions(org?: string | { id: string }) {
  return prisma.$queryRaw<FeedVersion[]>`
    SELECT v.id, v.number, v."reviewedAt",
      m.id AS "modelId", m.name AS "modelName", m."displayName" AS "modelLabel",
      CASE WHEN jsonb_typeof(m.facts #> '{releaseDate,value}') = 'string'
        THEN m.facts #>> '{releaseDate,value}' ELSE '' END AS released,
      o.slug AS "orgSlug", o."displayName" AS "orgLabel", dp.meter, dp.judges
    FROM (
      SELECT DISTINCT ON ("cardId") id, "cardId", number, "reviewedAt" FROM openaudit_card_version
      WHERE status = 'published' AND "reviewedAt" IS NOT NULL
      ORDER BY "cardId", number DESC
    ) v
    JOIN openaudit_card c ON c.id = v."cardId"
    JOIN model m ON m.id = c."modelId" AND NOT m.hidden
    JOIN organization o ON o.id = m."organizationId" AND NOT o.hidden
      ${
        org === undefined
          ? Prisma.empty
          : typeof org === 'string'
            ? Prisma.sql`AND o.slug = ${org}`
            : Prisma.sql`AND o.id = ${org.id}::uuid`
      }
    LEFT JOIN (${PUBLISHED_METERS}) dp ON dp.id = m.id
    WHERE EXISTS (SELECT 1 FROM openaudit_card_snippet cs JOIN openaudit_snippet sn ON sn.id = cs."snippetId"
      WHERE cs."versionId" = v.id AND NOT ${excludedAttempt(Prisma.sql`sn."attemptId"`)})`;
}

/** The fields of one flagged chat that give its place in the feed, its counts and its topics.
 * `locked`: a reader with no staff role can never read the reply. */
type ChatKey = {
  id: string;
  category: string;
  severity: SnippetSeverity;
  evalName: string;
  evalSlug: string;
  topics: string[];
  createdAt: Date;
  locked: boolean;
};

/** `sampled`: the attempt is there and has a sample. `judged`: a reply summary judged the
 * attempt. `attemptSnippets`: all flagged snippets of the attempt, from any card. */
type ChatKeyRow = Omit<ChatKey, 'topics' | 'locked'> & {
  evalTopics: string[];
  sampled: boolean;
  hazard: Hazard | null;
  display: string | null;
  sampleTerms: SampleTerms | null;
  judged: boolean;
  judgedHazard: Hazard | null;
  attemptSnippets: { category: string; severity: string }[];
};

// Raw SQL, because Prisma sends the same 10,000 attempt ids again for each relation.
/** The chats of the version with this id, with no text. */
async function chatKeys(versionId: string): Promise<ChatKey[]> {
  const rows = await prisma.$queryRaw<ChatKeyRow[]>`
    SELECT sn.id, sn.category, sn.severity, sn."createdAt",
      e."displayName" AS "evalName", e.slug AS "evalSlug", e.topics AS "evalTopics",
      a."sampleId" IS NOT NULL AS sampled, a.hazard, a.display, ev."sampleTerms",
      rs."attemptId" IS NOT NULL AS judged, rs.hazard AS "judgedHazard",
      (SELECT coalesce(json_agg(json_build_object('category', x.category, 'severity', x.severity)), '[]')
        FROM openaudit_snippet x WHERE x."attemptId" = sn."attemptId") AS "attemptSnippets"
    FROM openaudit_card_snippet cs
    JOIN openaudit_snippet sn ON sn.id = cs."snippetId"
    JOIN eval_run r ON r.id = sn."runId"
    JOIN eval e ON e.id = r."evalId"
    LEFT JOIN eval_attempt a ON a.id = sn."attemptId"
    LEFT JOIN eval_run ar ON ar.id = a."runId"
    LEFT JOIN eval_version ev ON ev.id = ar."evalVersionId"
    LEFT JOIN reply_summary rs ON rs."attemptId" = a.id AND rs.uplift IS NOT NULL
    WHERE cs."versionId" = ${versionId}::uuid AND NOT ${excludedAttempt(Prisma.sql`sn."attemptId"`)}`;
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    severity: r.severity,
    evalName: r.evalName,
    evalSlug: r.evalSlug,
    topics: snippetTopics(r.category, r.evalTopics),
    createdAt: r.createdAt,
    locked:
      r.sampled &&
      lockedForPublic(
        attemptHazard(r.hazard, r.judged ? r.judgedHazard : undefined, r.attemptSnippets),
        r.sampleTerms,
        r.display,
      ),
  }));
}

/** The chats in feed order: by severity group, the chats that a reader can open first, then the
 * most severe. In each group, severity and readable block, the evals take turns: newest first. */
function feedOrder(chats: ChatKey[]): ChatKey[] {
  return inTurns(
    [...chats].sort(
      (a, b) =>
        CHAT_GROUPS.indexOf(chatGroup(a.severity)) - CHAT_GROUPS.indexOf(chatGroup(b.severity)) ||
        Number(a.locked) - Number(b.locked) ||
        ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity) ||
        b.createdAt.getTime() - a.createdAt.getTime() ||
        a.id.localeCompare(b.id),
    ),
    (s) => s.evalName,
    (s) => `${s.severity}:${s.locked}`,
  );
}

/** The text and links of one chat. The attempt fields are null if the attempt is gone. */
type ChatText = {
  id: string;
  runId: string;
  ordinal: number;
  title: string;
  reason: string;
  sampleId: string | null;
  epoch: number | null;
  epochs: unknown;
};

/** The text and links of the chats with these ids. */
async function chatTexts(ids: string[]): Promise<Map<string, ChatText>> {
  const rows = await prisma.$queryRaw<ChatText[]>`
    SELECT sn.id, sn."runId", sn.ordinal, sn.title, sn.reason, a."sampleId", a.epoch,
      ar.settings -> 'epochs' AS epochs
    FROM openaudit_snippet sn
    LEFT JOIN eval_attempt a ON a.id = sn."attemptId"
    LEFT JOIN eval_run ar ON ar.id = a."runId"
    WHERE sn.id = ANY(${ids}::uuid[])`;
  return new Map(rows.map((r) => [r.id, r]));
}

/** The chats as the feed sends them, in the order given. */
function chatRefs(chats: ChatKey[], texts: Map<string, ChatText>): SnippetRef[] {
  return chats.flatMap((k) => {
    const t = texts.get(k.id);
    if (!t) return [];
    return [
      {
        id: k.id,
        href: attemptPath({ id: t.runId }, t.ordinal),
        evalName: k.evalName,
        ordinal: t.ordinal,
        sample: t.sampleId === null ? { id: '?' } : sampleRef({ sampleId: t.sampleId, epoch: t.epoch! }, t.epochs),
        category: k.category,
        topics: k.topics,
        severity: k.severity,
        title: t.title,
        reason: t.reason,
        locked: k.locked,
      },
    ];
  });
}

/** All chats of the entry with this `key`, or null if no entry has it. */
export async function snippetFeedChats(key: string): Promise<SnippetRef[] | null> {
  if (!(await snippetFeed()).some((e) => e.key === key)) return null;
  const chats = feedOrder(await chatKeys(key));
  return chatRefs(chats, await chatTexts(chats.map((k) => k.id)));
}
