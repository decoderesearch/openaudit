import { Prisma } from '#prisma';
import { prisma } from '@/lib/db';
import { DOCUMENT_KINDS } from '@/lib/format';
import { organizationPath } from '@/lib/organizations';
import {
  evalExpansion,
  evalTitle,
  SEARCH_LIMIT,
  searchTokens,
  squash,
  type SearchHit,
  type SearchResults,
} from '@/lib/search';
import { cardPath, cardTitle, modelPath } from '@/lib/server/catalog';
import type { Document } from '@openaudit/spec';

// Each table has at most about a thousand rows, so a scan is fast and needs no index.

const EMPTY: SearchResults = { models: [], documents: [], evals: [], organizations: [] };

const joined = (cols: Prisma.Sql[]) => Prisma.sql`lower(concat_ws(' ', ${Prisma.join(cols)}))`;

/** The columns as words: separators are spaces, and 2+ letters before a digit end a word. */
const words = (cols: Prisma.Sql[]) =>
  Prisma.sql`' ' || regexp_replace(regexp_replace(${joined(cols)}, '([[:alpha:]]{2})([[:digit:]])', '\\1 \\2', 'g'), '[[:space:][:punct:]]+', ' ', 'g')`;

/** The columns with the separators removed. */
const squashed = (cols: Prisma.Sql[]) => Prisma.sql`regexp_replace(${joined(cols)}, '[[:space:][:punct:]]+', '', 'g')`;

/**
 * A row matches when each token starts a word, or when the query without separators is in the
 * text without separators ("deepseekr1" finds "DeepSeek-R1"). Order: exact name, name starts with
 * the query's words, name starts with the query, word match, the rest. Names compare as words, so "qwen 27b" is not "Qwen2-7B".
 */
function match(cols: Prisma.Sql[], names: Prisma.Sql[], tokens: string[], q: string) {
  const byWord = Prisma.sql`${words(cols)} LIKE ALL (${tokens.map((t) => `% ${t}%`)}::text[])`;
  const where = Prisma.sql`(${byWord} OR ${squashed(cols)} LIKE ${`%${q}%`})`;
  const phrase = ` ${tokens.join(' ')}`;
  const name = (col: Prisma.Sql) =>
    Prisma.sql`CASE WHEN ${words([col])} = ${phrase} THEN 0 WHEN ${words([col])} LIKE ${`${phrase} %`} THEN 1
      WHEN ${words([col])} LIKE ${`${phrase}%`} THEN 2 ELSE 3 END`;
  const order = Prisma.sql`LEAST(${Prisma.join(names.map(name))}), (NOT ${byWord})`;
  return { where, order, byWord };
}

export async function searchSite(query: string): Promise<SearchResults> {
  const tokens = searchTokens(query);
  const q = squash(query);
  if (!tokens.length || !q) return EMPTY;

  const m = match(
    [Prisma.sql`m.name`, Prisma.sql`m."displayName"`, Prisma.sql`array_to_string(m.aliases, ' ')`],
    [Prisma.sql`m."displayName"`, Prisma.sql`split_part(m.name, '/', 2)`, Prisma.sql`m.name`],
    tokens,
    q,
  );
  const doc = match([Prisma.sql`doc.title`], [Prisma.sql`doc.title`], tokens, q);
  const e = match(
    [
      Prisma.sql`e.slug`,
      Prisma.sql`e."displayName"`,
      Prisma.sql`e.family`,
      Prisma.sql`array_to_string(e.aliases, ' ')`,
    ],
    [Prisma.sql`e."displayName"`, Prisma.sql`e.slug`],
    tokens,
    q,
  );
  const o = match(
    [
      Prisma.sql`o.slug`,
      Prisma.sql`o."displayName"`,
      Prisma.sql`array_to_string(o.aliases, ' ')`,
      Prisma.sql`array_to_string(o."slugAliases", ' ')`,
    ],
    [Prisma.sql`o."displayName"`, Prisma.sql`o.slug`],
    tokens,
    q,
  );

  const [models, documents, evals, organizations] = await Promise.all([
    prisma.$queryRaw<{ name: string; displayName: string; organization: string }[]>`
      SELECT m.name, m."displayName", o."displayName" AS organization
      FROM model m JOIN organization o ON o.id = m."organizationId"
      WHERE NOT o.hidden AND NOT m.hidden AND ${m.where}
      ORDER BY ${m.order}, (m."parentId" IS NOT NULL), m.facts->'releaseDate'->>'value' DESC NULLS LAST,
               length(m."displayName"), m.name
      LIMIT ${SEARCH_LIMIT}`,
    // A document matches by its title, or by the words of a model it is about. Title matches and cards
    // come first. A card opens under a matched model if one covers it, else under its first model.
    prisma.$queryRaw<
      {
        key: string;
        title: string;
        kind: Document['kind'];
        url: string;
        publishedDate: string | null;
        publisher: string;
        cardModel: string | null;
      }[]
    >`
      WITH hit AS (SELECT m.id FROM model m WHERE NOT m.hidden AND ${m.byWord})
      SELECT h.key, h.title, h.kind, h.url, h."publishedDate", h.publisher, cm.name AS "cardModel"
      FROM (
        SELECT doc.key, doc.title, doc.kind, doc.url, doc."publishedDate", doc.id,
               p."displayName" AS publisher, sc.id AS card, sc."modelIds",
               row_number() OVER (
                 ORDER BY (NOT ${doc.where}), (sc.id IS NULL), ${doc.order}, doc."publishedDate" DESC NULLS LAST,
                          length(doc.title), doc.title
               ) AS rn
        FROM document doc
        JOIN organization p ON p.id = doc."publisherId"
        LEFT JOIN system_card sc ON sc."documentId" = doc.id
        WHERE NOT p.hidden AND NOT EXISTS (
          SELECT 1 FROM model hm WHERE hm.hidden AND (hm.id = ANY (sc."modelIds")
            OR hm.id IN (SELECT md."modelId" FROM model_document md WHERE md."documentId" = doc.id))
        ) AND (
          ${doc.where}
           OR EXISTS (SELECT 1 FROM hit WHERE hit.id = ANY (sc."modelIds"))
           OR EXISTS (SELECT 1 FROM model_document md JOIN hit ON hit.id = md."modelId" WHERE md."documentId" = doc.id)
        )
      ) h
      LEFT JOIN LATERAL (
        SELECT m.name FROM model m
        WHERE NOT m.hidden AND (m.id = ANY (h."modelIds")
           OR m.id IN (SELECT md."modelId" FROM model_document md WHERE md."documentId" = h.id))
        ORDER BY (m.id IN (SELECT id FROM hit)) DESC, (m.id = h."modelIds"[1]) DESC NULLS LAST,
                 (m."parentId" IS NOT NULL), m.name
        LIMIT 1
      ) cm ON h.card IS NOT NULL
      WHERE h.rn <= ${SEARCH_LIMIT}
      ORDER BY h.rn`,
    prisma.$queryRaw<
      { slug: string; displayName: string; family: string | null; aliases: string[]; maintainers: { name: string }[] }[]
    >`
      SELECT e.slug, e."displayName", e.family, e.aliases, e.maintainers
      FROM eval e
      WHERE e.visibility = 'public' AND ${e.where}
      ORDER BY ${e.order}, length(e."displayName"), e."displayName"
      LIMIT ${SEARCH_LIMIT}`,
    prisma.$queryRaw<{ slug: string; displayName: string }[]>`
      SELECT o.slug, o."displayName"
      FROM organization o
      WHERE NOT o.hidden AND ${o.where}
      ORDER BY ${o.order}, length(o."displayName"), o."displayName"
      LIMIT ${SEARCH_LIMIT}`,
  ]);

  return {
    models: models.map((m): SearchHit => ({
      kind: 'model',
      title: m.displayName,
      detail: m.name === m.displayName ? m.organization : `${m.name} · ${m.organization}`,
      path: modelPath(m),
    })),
    documents: documents.map((d): SearchHit => ({
      kind: 'document',
      title: cardTitle(d),
      detail: `${DOCUMENT_KINDS[d.kind]} · ${d.publisher}`,
      ...(d.cardModel ? { path: cardPath({ name: d.cardModel }, d.key, d.kind) } : { path: d.url, external: true }),
    })),
    evals: evals.map((e): SearchHit => {
      const detail = evalExpansion(e.displayName, e.aliases) ?? e.family;
      return {
        kind: 'eval',
        title: evalTitle(e.displayName, e.maintainers),
        ...(detail && { detail }),
        path: `/evaluations/${encodeURIComponent(e.slug)}`,
      };
    }),
    organizations: organizations.map((o): SearchHit => ({
      kind: 'organization',
      title: o.displayName,
      path: organizationPath(o),
    })),
  };
}
