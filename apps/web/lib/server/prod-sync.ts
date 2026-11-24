import { IS_WORKERS } from '@/lib/platform';
import { databaseLabel, productionDatabase, sameDatabase } from '@/lib/server/neon';
import pg from 'pg';

// Local admin only: copies finished eval runs, OpenAudits and Deploymeter panels from this
// database (dev) to production. Run, attempt, snippet, card and panel ids stay the same, so R2 keys
// stay valid. Model, eval, version, sample and user ids differ between the databases; they map by
// natural key; a linked sample that production does not have is copied. Dev card versions and
// panels sync over production's own only with higher numbers. Human Deploymeter reviews do not sync.

const BATCH = 2000;
const UNFINISHED = new Set(['requested', 'queued', 'running', 'importing']);

export type Counts = { shards: number; attempts: number; results: number; snippets: number };

export type RunRow = Counts & {
  id: string;
  status: string;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
  finishedAt: Date | null;
  sourceRunId: string | null;
  modelKey: string;
  modelLabel: string;
  versionKey: string;
  ownerEmail: string | null;
  approverEmail: string | null;
  documents: number;
  // Attempts graded unsafe that have no hazard level, so their replies would show to all.
  unlabeled: number;
};

export type RunState = 'new' | 'changed' | 'same' | 'prod-newer' | 'unfinished' | 'blocked' | 'prod-only';

export type RunDiff = {
  id: string;
  model: string;
  eval: string;
  status: string;
  visibility: string;
  finishedAt: Date | null;
  state: RunState;
  reason?: string;
  dev?: Counts;
  prod?: Counts;
};

export type CardRow = {
  id: string;
  modelKey: string;
  modelLabel: string;
  builtAt: Date | null;
  createdAt: Date;
  busy: boolean;
  // Each version, with the runs that its card runs and snippets use.
  versions: { id: string; number: number; runIds: string[] }[];
};

export type CardState = 'new' | 'newer' | 'same' | 'prod-built' | 'busy' | 'blocked' | 'prod-only';

export type CardDiff = { model: string; state: CardState; reason?: string; dev: number[]; prod: number[] };

/** A Deploymeter panel, with the card versions that it and its packet use. */
export type PanelRow = {
  id: string;
  number: number;
  modelKey: string;
  modelLabel: string;
  versionIds: string[];
};

export type PanelState = 'new' | 'newer' | 'same' | 'prod-built' | 'blocked' | 'prod-only';

export type PanelDiff = { model: string; state: PanelState; reason?: string; dev: number[]; prod: number[] };

export const SYNC_RUNS: RunState[] = ['new', 'changed'];
export const SYNC_CARDS: CardState[] = ['new', 'newer'];
export const SYNC_PANELS: PanelState[] = ['new', 'newer'];

export type SyncDiff = {
  source: string;
  target: string;
  // Problems that stop all of the sync, for example a schema that differs.
  blockers: string[];
  runs: RunDiff[];
  cards: CardDiff[];
  panels: PanelDiff[];
};

const COUNTS = ['shards', 'attempts', 'results', 'snippets'] as const;
const counts = (r: RunRow): Counts => ({
  shards: r.shards,
  attempts: r.attempts,
  results: r.results,
  snippets: r.snippets,
});

/** Why a finished dev run cannot sync, or undefined. `prod` has the keys that production has. */
export function runBlock(
  r: RunRow,
  prod: { models: Set<string>; versions: Set<string>; emails: Set<string>; runs: Set<string> },
): string | undefined {
  if (!prod.models.has(r.modelKey)) return `Model ${r.modelKey} is not on production. Import the seed first.`;
  if (!prod.versions.has(r.versionKey)) return `Eval ${r.versionKey} is not on production. Import the seed first.`;
  for (const email of [r.ownerEmail, r.approverEmail])
    if (email && !prod.emails.has(email)) return `User ${email} is not on production.`;
  if (r.documents) return `${r.documents} results link documents.`;
  if (r.unlabeled)
    return `${r.unlabeled} replies graded unsafe have no hazard level. Run \`openaudit-runner apply-hazards\`.`;
  if (r.sourceRunId && !prod.runs.has(r.sourceRunId)) return 'Its source run does not sync.';
  return undefined;
}

/** The state of one run. `block` is the reason from `runBlock`. */
export function compareRun(dev: RunRow | undefined, prod: RunRow | undefined, block?: string): RunDiff {
  const r = (dev ?? prod)!;
  const base = {
    id: r.id,
    model: r.modelLabel,
    eval: r.versionKey.replace('|', '@'),
    status: r.status,
    visibility: r.visibility,
    finishedAt: r.finishedAt,
    dev: dev && counts(dev),
    prod: prod && counts(prod),
  };
  if (!dev) return { ...base, state: 'prod-only' };
  if (UNFINISHED.has(dev.status)) return { ...base, state: 'unfinished', reason: 'Not finished on dev.' };
  if (block) return { ...base, state: 'blocked', reason: block };
  if (!prod) return { ...base, state: 'new' };
  const sameCounts = COUNTS.every((k) => dev[k] === prod[k]);
  const d = dev.updatedAt.getTime();
  const p = prod.updatedAt.getTime();
  if (sameCounts && d === p) return { ...base, state: 'same' };
  if (p > d) return { ...base, state: 'prod-newer', reason: 'Production changed it after dev.' };
  return { ...base, state: 'changed' };
}

/** The state of one card. `onProd`: the run is on production, or syncs now. */
export function compareCard(
  dev: CardRow | undefined,
  prod: CardRow | undefined,
  onProd: (runId: string) => boolean,
): CardDiff {
  const devIds = new Set(dev?.versions.map((v) => v.id));
  const base = {
    model: (dev ?? prod)!.modelLabel,
    dev: dev?.versions.map((v) => v.number) ?? [],
    prod: prod?.versions.map((v) => v.number) ?? [],
  };
  if (!dev) return { ...base, state: 'prod-only' };
  const prodIds = new Set(prod?.versions.map((v) => v.id));
  const missing = dev.versions.filter((v) => !prodIds.has(v.id));
  // Dev versions go on top of the versions that production built, so they need higher numbers.
  const top = Math.max(0, ...(prod?.versions ?? []).filter((v) => !devIds.has(v.id)).map((v) => v.number));
  if (top && (!missing.length || missing.some((v) => v.number <= top)))
    return { ...base, state: 'prod-built', reason: 'Production built its own versions.' };
  if (!missing.length) return { ...base, state: 'same' };
  if (prod?.busy) return { ...base, state: 'busy', reason: 'Production builds this card now.' };
  const bad = missing.find((v) => v.runIds.some((id) => !onProd(id)));
  if (bad) return { ...base, state: 'blocked', reason: `v${bad.number} uses a run that does not sync.` };
  return { ...base, state: prod?.versions.length ? 'newer' : 'new' };
}

/** The state of one model's Deploymeter panels. `onProd`: the card version is on production, or
 * syncs now. `block`: a reason that stops all of them. */
export function comparePanels(
  dev: PanelRow[],
  prod: PanelRow[],
  onProd: (versionId: string) => boolean,
  block?: string,
): PanelDiff {
  const devIds = new Set(dev.map((p) => p.id));
  const base = {
    model: (dev[0] ?? prod[0]).modelLabel,
    dev: dev.map((p) => p.number),
    prod: prod.map((p) => p.number),
  };
  if (!dev.length) return { ...base, state: 'prod-only' };
  const prodIds = new Set(prod.map((p) => p.id));
  const missing = dev.filter((p) => !prodIds.has(p.id));
  // As for cards: dev panels go on top of production's own, with higher numbers.
  const top = Math.max(0, ...prod.filter((p) => !devIds.has(p.id)).map((p) => p.number));
  if (top && (!missing.length || missing.some((p) => p.number <= top)))
    return { ...base, state: 'prod-built', reason: 'Production made its own panels.' };
  if (!missing.length) return { ...base, state: 'same' };
  if (block) return { ...base, state: 'blocked', reason: block };
  const bad = missing.find((p) => p.versionIds.some((id) => !onProd(id)));
  if (bad) return { ...base, state: 'blocked', reason: `Panel ${bad.number} uses a card version that does not sync.` };
  return { ...base, state: prod.length ? 'newer' : 'new' };
}

/** Why the sync is off here, or null. */
export function prodSyncOff(): string | null {
  if (IS_WORKERS) return 'The sync runs only on a local server.';
  if (!process.env.NEON_API_KEY || !process.env.NEON_PROJECT_ID)
    return 'Set NEON_API_KEY and NEON_PROJECT_ID in .env.local.';
  if (!process.env.DATABASE_URL) return 'DATABASE_URL is not set.';
  return null;
}

// ---------------------------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------------------------

type Db = pg.Client;

const TABLES = [
  'eval_run',
  'eval_run_shard',
  'eval_sample',
  'eval_attempt',
  'eval_result',
  'openaudit_card',
  'openaudit_card_version',
  'openaudit_card_run',
  'openaudit_snippet',
  'openaudit_card_snippet',
  'openaudit_flag_check',
  'reply_summary',
  'deploy_packet',
  'deploy_panel',
  'deploy_review',
];

const RUNS_SQL = `
SELECT r.id, r.status, r.visibility, r."createdAt", r."updatedAt", r."finishedAt", r."sourceRunId",
  m.source || '|' || m.name AS "modelKey", m."displayName" AS "modelLabel",
  e.slug || '|' || v.version AS "versionKey", o.email AS "ownerEmail", ap.email AS "approverEmail",
  coalesce(s.n, 0)::int AS shards, coalesce(a.n, 0)::int AS attempts, coalesce(x.n, 0)::int AS results,
  coalesce(x.docs, 0)::int AS documents, coalesce(sn.n, 0)::int AS snippets, coalesce(u.n, 0)::int AS unlabeled
FROM eval_run r
JOIN model m ON m.id = r."modelId"
JOIN eval e ON e.id = r."evalId"
JOIN eval_version v ON v.id = r."evalVersionId"
LEFT JOIN "user" o ON o.id = r."ownerUserId"
LEFT JOIN "user" ap ON ap.id = r."approvedById"
LEFT JOIN (SELECT "runId", count(*) n FROM eval_run_shard GROUP BY 1) s ON s."runId" = r.id
LEFT JOIN (SELECT "runId", count(*) n FROM eval_attempt GROUP BY 1) a ON a."runId" = r.id
LEFT JOIN (SELECT "evalRunId", count(*) n, count("sourceDocumentId") docs FROM eval_result
           WHERE "evalRunId" IS NOT NULL GROUP BY 1) x ON x."evalRunId" = r.id
LEFT JOIN (SELECT "runId", count(*) n FROM openaudit_snippet GROUP BY 1) sn ON sn."runId" = r.id
-- The evals with a hazard rule (\`RULES\` in \`hazard.py\`): a score above 0 is an unsafe grade.
LEFT JOIN (SELECT a."runId", count(*) n FROM eval_attempt a
           JOIN eval_run ur ON ur.id = a."runId" JOIN eval ue ON ue.id = ur."evalId"
           WHERE ue.slug IN ('fortress') AND a.hazard IS NULL AND EXISTS (
             SELECT 1 FROM jsonb_each(a.scores) s
             WHERE jsonb_typeof(s.value->'value') = 'number' AND (s.value->>'value')::numeric > 0)
           GROUP BY 1) u ON u."runId" = r.id
ORDER BY r.id`;

// Dev gives only published versions: a draft stays on dev. Production gives all, so its own
// drafts count as versions that production built.
const cardsSql = (published: boolean) => `
SELECT c.id, m.source || '|' || m.name AS "modelKey", m."displayName" AS "modelLabel", c."builtAt",
  c."createdAt", (c."leaseOwner" IS NOT NULL AND c."leaseExpiresAt" > now()) AS busy,
  coalesce((SELECT json_agg(json_build_object('id', v.id, 'number', v.number, 'runIds',
      (SELECT coalesce(json_agg(DISTINCT u.id), '[]') FROM (
         SELECT cr."runId" AS id FROM openaudit_card_run cr WHERE cr."versionId" = v.id
         UNION SELECT sn."runId" FROM openaudit_card_snippet cs
         JOIN openaudit_snippet sn ON sn.id = cs."snippetId" WHERE cs."versionId" = v.id) u))
    ORDER BY v.number) FROM openaudit_card_version v
    WHERE v."cardId" = c.id ${published ? `AND v.status = 'published'` : ''}), '[]') AS versions
FROM openaudit_card c JOIN model m ON m.id = c."modelId"`;

// Dev gives only published panels, as for cards.
const panelsSql = (published: boolean) => `
SELECT p.id, p.number, m.source || '|' || m.name AS "modelKey", m."displayName" AS "modelLabel",
  ARRAY[p."cardVersionId", k."cardVersionId"]::text[] AS "versionIds"
FROM deploy_panel p JOIN deploy_packet k ON k.id = p."packetId" JOIN model m ON m.id = p."modelId"
${published ? `WHERE p.status = 'published'` : ''}
ORDER BY m."displayName", p.number`;

// Natural keys of the rows that differ in id between the databases.
const KEYS: Record<string, string> = {
  model: `SELECT id, source || '|' || name AS k FROM model`,
  eval: `SELECT id, slug AS k FROM eval`,
  eval_version: `SELECT v.id, e.slug || '|' || v.version AS k FROM eval_version v JOIN eval e ON e.id = v."evalId"`,
  eval_sample: `SELECT s.id, e.slug || '|' || v.version || '|' || s.split || '|' || s."sourceId" AS k
    FROM eval_sample s JOIN eval_version v ON v.id = s."evalVersionId" JOIN eval e ON e.id = v."evalId"`,
  user: `SELECT id, email AS k FROM "user"`,
};

async function keys(db: Db, name: string): Promise<Map<string, string>> {
  const { rows } = await db.query<{ id: string; k: string }>(KEYS[name]);
  return new Map(rows.map((r) => [r.id, r.k]));
}

/** dev id -> prod id, for each row that production has by the same key. */
async function idMap(dev: Db, prod: Db, name: string): Promise<Map<string, string>> {
  const [d, p] = await Promise.all([keys(dev, name), keys(prod, name)]);
  const byKey = new Map([...p].map(([id, k]) => [k, id]));
  const out = new Map<string, string>();
  for (const [id, k] of d) {
    const to = byKey.get(k);
    if (to) out.set(id, to);
  }
  return out;
}

async function columns(db: Db, table: string): Promise<string[]> {
  const { rows } = await db.query<{ c: string }>(
    `SELECT column_name AS c FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [table],
  );
  return rows.map((r) => r.c);
}

const scrub = (s: string) => s.replace(/postgres(ql)?:\/\/\S+/g, '<url>');

/**
 * Adds the settings of the synced runs (`metadata.settings[runId]`) to the production copies of
 * their samples. The settings of other runs stay out, as production may not have those runs:
 * in a sample copied now (`fresh`), they replace the dev settings. `keep: false`: no settings
 * are added, and a fresh sample gets none.
 */
async function copySampleSettings(
  dev: Db,
  prod: Db,
  runIds: string[],
  keep: boolean,
  sample: Map<string, string>,
  fresh: Set<string>,
) {
  const { rows } = await dev.query<{ id: string; s: unknown }>(
    `SELECT s.id, (SELECT jsonb_object_agg(k, v) FROM jsonb_each(s.metadata -> 'settings') e(k, v)
                   WHERE $2 AND k::uuid = ANY($1::uuid[])) AS s
     FROM eval_sample s
     WHERE s.metadata ? 'settings'
       AND s.id IN (SELECT "evalSampleId" FROM eval_attempt WHERE "runId" = ANY($1::uuid[]))`,
    [runIds, keep],
  );
  const items = rows.flatMap((r) =>
    (r.s || fresh.has(r.id)) && sample.has(r.id)
      ? [{ id: sample.get(r.id), s: r.s ?? {}, fresh: fresh.has(r.id) }]
      : [],
  );
  for (let i = 0; i < items.length; i += BATCH) {
    await prod.query(
      `UPDATE eval_sample p SET metadata = jsonb_set(coalesce(p.metadata, '{}'), '{settings}',
         CASE WHEN x.fresh THEN x.s ELSE coalesce(p.metadata -> 'settings', '{}') || x.s END)
       FROM json_to_recordset($1::json) AS x(id uuid, s jsonb, fresh boolean) WHERE p.id = x.id`,
      [JSON.stringify(items.slice(i, i + BATCH))],
    );
  }
}

async function connect<T>(work: (dev: Db, prod: Db, labels: { source: string; target: string }) => Promise<T>) {
  const off = prodSyncOff();
  if (off) throw new Error(off);
  const devUrl = process.env.DATABASE_URL!;
  const target = await productionDatabase();
  if (sameDatabase(devUrl, target.url)) throw new Error('DATABASE_URL is the production database.');
  const dev = new pg.Client({ connectionString: devUrl });
  const prod = new pg.Client({ connectionString: target.url });
  try {
    await Promise.all([dev.connect(), prod.connect()]);
    return await work(dev, prod, { source: databaseLabel(devUrl), target: target.label });
  } catch (e) {
    throw new Error(scrub(e instanceof Error ? e.message : String(e)));
  } finally {
    await Promise.allSettled([dev.end(), prod.end()]);
  }
}

type Plan = SyncDiff & {
  syncRuns: string[];
  // Each card to sync, its production card (if any), and the version ids that production lacks.
  syncCards: { c: CardRow; prodCard?: CardRow; missing: string[] }[];
  // The dev panels that production lacks, of the models that sync.
  syncPanels: string[];
};

const byModel = (rows: PanelRow[]) => {
  const out = new Map<string, PanelRow[]>();
  for (const r of rows) out.set(r.modelKey, [...(out.get(r.modelKey) ?? []), r]);
  return out;
};

async function plan(dev: Db, prod: Db, labels: { source: string; target: string }): Promise<Plan> {
  const blockers: string[] = [];
  for (const t of TABLES) {
    const [d, p] = await Promise.all([columns(dev, t), columns(prod, t)]);
    const only = (a: string[], b: string[]) => a.filter((c) => !b.includes(c));
    if (only(d, p).length || only(p, d).length)
      blockers.push(
        `${t}: columns differ (dev only: ${only(d, p).join(', ') || '—'}; production only: ${only(p, d).join(', ') || '—'}). Migrate first.`,
      );
  }
  // One query at a time on each client; the two clients work in parallel.
  const [d, p] = await Promise.all([
    (async () => ({
      runs: (await dev.query<RunRow>(RUNS_SQL)).rows,
      cards: (await dev.query<CardRow>(cardsSql(true))).rows,
      panels: (await dev.query<PanelRow>(panelsSql(true))).rows,
    }))(),
    (async () => ({
      runs: (await prod.query<RunRow>(RUNS_SQL)).rows,
      cards: (await prod.query<CardRow>(cardsSql(false))).rows,
      panels: (await prod.query<PanelRow>(panelsSql(false))).rows,
      models: new Set((await keys(prod, 'model')).values()),
      versions: new Set((await keys(prod, 'eval_version')).values()),
      emails: new Set((await keys(prod, 'user')).values()),
    }))(),
  ]);
  const devRuns = new Map(d.runs.map((r) => [r.id, r]));
  const prodRuns = new Map(p.runs.map((r) => [r.id, r]));
  const { models, versions, emails } = p;
  // In id order (uuid7: by time), so a source run comes before its rescores.
  const runs: RunDiff[] = [];
  const onProd = new Set(prodRuns.keys());
  for (const r of devRuns.values()) {
    const block = runBlock(r, { models, versions, emails, runs: onProd });
    const run = compareRun(r, prodRuns.get(r.id), block);
    if (SYNC_RUNS.includes(run.state)) onProd.add(r.id);
    runs.push(run);
  }
  for (const r of prodRuns.values()) if (!devRuns.has(r.id)) runs.push(compareRun(undefined, r));

  const prodCards = new Map(p.cards.map((c) => [c.modelKey, c]));
  const devCards = d.cards.filter((c) => c.versions.length);
  const cards: CardDiff[] = [];
  const syncCards: Plan['syncCards'] = [];
  for (const c of devCards) {
    const prodCard = prodCards.get(c.modelKey);
    const card = compareCard(c, prodCard, (id) => onProd.has(id));
    cards.push(card);
    if (!SYNC_CARDS.includes(card.state)) continue;
    const have = new Set(prodCard?.versions.map((v) => v.id));
    syncCards.push({ c, prodCard, missing: c.versions.filter((v) => !have.has(v.id)).map((v) => v.id) });
  }
  const devKeys = new Set(devCards.map((c) => c.modelKey));
  for (const c of prodCards.values())
    if (!devKeys.has(c.modelKey) && c.versions.length) cards.push(compareCard(undefined, c, () => true));

  const versionsOnProd = new Set([
    ...p.cards.flatMap((c) => c.versions.map((v) => v.id)),
    ...syncCards.flatMap((x) => x.missing),
  ]);
  const devPanels = byModel(d.panels);
  const prodPanels = byModel(p.panels);
  const panels: PanelDiff[] = [];
  const syncPanels: string[] = [];
  for (const [key, rows] of devPanels) {
    const have = prodPanels.get(key) ?? [];
    const block = models.has(key) ? undefined : `Model ${key} is not on production. Import the seed first.`;
    const panel = comparePanels(rows, have, (id) => versionsOnProd.has(id), block);
    panels.push(panel);
    if (!SYNC_PANELS.includes(panel.state)) continue;
    const prodIds = new Set(have.map((r) => r.id));
    syncPanels.push(...rows.filter((r) => !prodIds.has(r.id)).map((r) => r.id));
  }
  for (const [key, rows] of prodPanels) if (!devPanels.has(key)) panels.push(comparePanels([], rows, () => true));

  const syncRuns = runs.filter((r) => SYNC_RUNS.includes(r.state)).map((r) => r.id);
  return { ...labels, blockers, runs, cards, panels, syncRuns, syncCards, syncPanels };
}

/** What a sync would do now. Reads both databases; writes nothing. */
export async function prodSyncDiff(): Promise<SyncDiff> {
  return connect(async (dev, prod, labels) => {
    const { blockers, runs, cards, panels, source, target } = await plan(dev, prod, labels);
    return { source, target, blockers, runs, cards, panels };
  });
}

type CopySpec = {
  table: string;
  // The primary key: for keyset pages, and for the upsert.
  key: string[];
  // A filter on dev, with $1 (and $2) as `params`.
  filter: string;
  params: unknown[];
  remap?: Record<string, Map<string, string>>;
  upsert?: boolean;
};

const q = (c: string) => `"${c}"`;

/**
 * Copies the dev rows that match the filter, in pages. Returns the rows written. Rows go as
 * Postgres JSON text: a parse in JS would change numbers in JSON columns (1.0 to 1).
 */
async function copy(dev: Db, prod: Db, spec: CopySpec): Promise<number> {
  const cols = await columns(prod, spec.table);
  const list = cols.map(q).join(', ');
  const keyList = spec.key.map(q).join(', ');
  const update = cols.filter((c) => !spec.key.includes(c)).map((c) => `${q(c)} = EXCLUDED.${q(c)}`);
  const conflict = spec.upsert ? `(${keyList}) DO UPDATE SET ${update.join(', ')}` : 'DO NOTHING';
  let after: unknown[] | null = null;
  let written = 0;
  for (;;) {
    const params = [...spec.params];
    let where = `(${spec.filter})`;
    if (after) {
      where += ` AND (${keyList}) > (${after.map((_, i) => `$${params.length + i + 1}`).join(', ')})`;
      params.push(...after);
    }
    const { rows } = await dev.query<{ j: string }>(
      `SELECT row_to_json(t)::text AS j FROM "${spec.table}" t WHERE ${where} ORDER BY ${keyList} LIMIT ${BATCH}`,
      params,
    );
    if (!rows.length) break;
    const parsed = rows.map((r) => JSON.parse(r.j) as Record<string, string | null>);
    after = spec.key.map((k) => parsed.at(-1)![k]);
    // Each mapped column gets a dev -> prod object of the ids in this page.
    const insert: unknown[] = [`[${rows.map((r) => r.j).join(',')}]`];
    const select = cols.map((c) => {
      const map = spec.remap?.[c];
      if (!map) return `s.${q(c)}`;
      const page: Record<string, string> = {};
      for (const j of parsed) {
        const from = j[c];
        if (from == null) continue;
        const to = map.get(from);
        if (!to) throw new Error(`${spec.table}.${c}: ${from} has no production row.`);
        page[from] = to;
      }
      insert.push(JSON.stringify(page));
      return `($${insert.length}::jsonb ->> s.${q(c)}::text)::uuid`;
    });
    const res = await prod.query(
      `INSERT INTO "${spec.table}" (${list})
       SELECT ${select.join(', ')} FROM json_populate_recordset(NULL::"${spec.table}", $1::json) s
       ON CONFLICT ${conflict}`,
      insert,
    );
    written += res.rowCount ?? 0;
    if (rows.length < BATCH) break;
  }
  return written;
}

export type SyncResult = {
  runs: number;
  shards: number;
  samples: number;
  attempts: number;
  results: number;
  snippets: number;
  flagChecks: number;
  summaries: number;
  cards: number;
  versions: number;
  panels: number;
  packets: number;
  reviews: number;
  issues: number;
};

/**
 * Writes the sync that `prodSyncDiff` shows: new and changed runs, new card versions and panels. One
 * transaction on production; dev is read in one snapshot. A changed run's shards, attempts and
 * results are replaced. `only`: sync just these runs, with no cards, panels or sample issues.
 * `skip`: runs not to sync now. `sampleSettings: false`: do not copy the runs' sample settings.
 */
export async function syncToProd(
  only?: string[],
  skip: string[] = [],
  { sampleSettings = true }: { sampleSettings?: boolean } = {},
): Promise<SyncResult> {
  return connect(async (dev, prod, labels) => {
    await dev.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await prod.query('BEGIN');
    try {
      const { rows: lock } = await prod.query<{ ok: boolean }>(
        `SELECT pg_try_advisory_xact_lock(hashtext('openaudit:prod-sync')) AS ok`,
      );
      if (!lock[0].ok) throw new Error('Another sync runs now.');
      const all = await plan(dev, prod, labels);
      if (all.blockers.length) throw new Error(all.blockers.join(' '));
      const todo = only ? justRuns(all, only) : withoutRuns(all, skip);
      const result = await write(dev, prod, todo, !only, sampleSettings);
      await prod.query('COMMIT');
      return result;
    } catch (e) {
      await prod.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      await dev.query('ROLLBACK').catch(() => {});
    }
  });
}

/** Sets the fail counts of the samples of the runs' eval versions again on production, as the
 * runner does after an import. Nothing when production has no `refresh_sample_stats` yet. */
async function refreshSampleStats(dev: Db, prod: Db, runIds: string[], version: Map<string, string>) {
  const { rows: fn } = await prod.query<{ ok: boolean }>(
    `SELECT to_regprocedure('refresh_sample_stats(uuid)') IS NOT NULL AS ok`,
  );
  if (!fn[0].ok) return;
  const { rows } = await dev.query<{ id: string }>(
    `SELECT DISTINCT "evalVersionId" AS id FROM eval_run WHERE id = ANY($1::uuid[])`,
    [runIds],
  );
  const ids = rows.flatMap((r) => version.get(r.id) ?? []);
  if (ids.length) await prod.query(`SELECT refresh_sample_stats(v) FROM unnest($1::uuid[]) v`, [ids]);
}

/** The plan with only the runs in `ids` that it syncs. A run it does not sync is an error. */
export function justRuns(p: Plan, ids: string[]): Plan {
  const skip = ids.filter((id) => !p.syncRuns.includes(id));
  if (skip.length) throw new Error(`Not new or changed on dev: ${skip.join(', ')}.`);
  return { ...p, runs: p.runs.filter((r) => ids.includes(r.id)), syncRuns: ids, syncCards: [], syncPanels: [] };
}

/** The plan with no sync of the runs in `ids`. Its cards and panels stay. */
export function withoutRuns(p: Plan, ids: string[]): Plan {
  return {
    ...p,
    runs: p.runs.filter((r) => !ids.includes(r.id)),
    syncRuns: p.syncRuns.filter((id) => !ids.includes(id)),
  };
}

async function write(dev: Db, prod: Db, p: Plan, issues = true, sampleSettings = true): Promise<SyncResult> {
  const [model, evalMap, version, sample, user] = [
    await idMap(dev, prod, 'model'),
    await idMap(dev, prod, 'eval'),
    await idMap(dev, prod, 'eval_version'),
    await idMap(dev, prod, 'eval_sample'),
    await idMap(dev, prod, 'user'),
  ];
  const runIds = p.syncRuns;
  const changed = p.runs.filter((r) => r.state === 'changed').map((r) => r.id);
  const out: SyncResult = {
    runs: 0,
    shards: 0,
    samples: 0,
    attempts: 0,
    results: 0,
    snippets: 0,
    flagChecks: 0,
    summaries: 0,
    cards: 0,
    versions: 0,
    panels: 0,
    packets: 0,
    reviews: 0,
    issues: 0,
  };

  if (runIds.length) {
    out.runs = await copy(dev, prod, {
      table: 'eval_run',
      key: ['id'],
      filter: 'id = ANY($1::uuid[])',
      params: [runIds],
      remap: { evalId: evalMap, evalVersionId: version, modelId: model, ownerUserId: user, approvedById: user },
      upsert: true,
    });
    if (changed.length) {
      await prod.query(`DELETE FROM eval_run_shard WHERE "runId" = ANY($1::uuid[])`, [changed]);
      await prod.query(`DELETE FROM eval_attempt WHERE "runId" = ANY($1::uuid[])`, [changed]);
      await prod.query(`DELETE FROM eval_result WHERE "evalRunId" = ANY($1::uuid[])`, [changed]);
    }
    const byRun = { filter: '"runId" = ANY($1::uuid[])', params: [runIds] };
    // The samples that the attempts link and production does not have. They keep their ids.
    const { rows: linked } = await dev.query<{ id: string }>(
      `SELECT DISTINCT "evalSampleId" AS id FROM eval_attempt WHERE "runId" = ANY($1::uuid[]) AND "evalSampleId" IS NOT NULL`,
      [runIds],
    );
    const missing = linked.map((r) => r.id).filter((id) => !sample.has(id));
    if (missing.length) {
      out.samples = await copy(dev, prod, {
        table: 'eval_sample',
        key: ['id'],
        filter: 'id = ANY($1::uuid[])',
        params: [missing],
        remap: { evalVersionId: version },
      });
      for (const id of missing) sample.set(id, id);
    }
    out.shards = await copy(dev, prod, { table: 'eval_run_shard', key: ['id'], ...byRun });
    out.attempts = await copy(dev, prod, {
      table: 'eval_attempt',
      key: ['id'],
      ...byRun,
      remap: { evalSampleId: sample },
    });
    await copySampleSettings(dev, prod, runIds, sampleSettings, sample, new Set(missing));
    out.results = await copy(dev, prod, {
      table: 'eval_result',
      key: ['id'],
      filter: '"evalRunId" = ANY($1::uuid[])',
      params: [runIds],
      remap: { evalId: evalMap, evalVersionId: version, modelId: model },
    });
    out.flagChecks = await copy(dev, prod, {
      table: 'openaudit_flag_check',
      key: ['attemptId', 'flagger', 'promptVersion'],
      filter: '"attemptId" IN (SELECT id FROM eval_attempt WHERE "runId" = ANY($1::uuid[]))',
      params: [runIds],
    });
    await refreshSampleStats(dev, prod, runIds, version);
  }

  const cards = p.syncCards;
  const versionIds = cards.flatMap((x) => x.missing);

  out.snippets = await copy(dev, prod, {
    table: 'openaudit_snippet',
    key: ['id'],
    filter: `"runId" = ANY($1::uuid[]) OR id IN (SELECT "snippetId" FROM openaudit_card_snippet WHERE "versionId" = ANY($2::uuid[]))`,
    params: [runIds, versionIds],
  });
  // A hidden reply shows its summary; with none, it stays hidden.
  out.summaries = await copy(dev, prod, {
    table: 'reply_summary',
    key: ['attemptId'],
    filter: `"attemptId" IN (SELECT id FROM eval_attempt WHERE "runId" = ANY($1::uuid[]))
      OR "attemptId" IN (SELECT sn."attemptId" FROM openaudit_card_snippet cs
        JOIN openaudit_snippet sn ON sn.id = cs."snippetId" WHERE cs."versionId" = ANY($2::uuid[]))`,
    params: [runIds, versionIds],
    upsert: true,
  });

  const cardMap = new Map<string, string>();
  for (const { c, prodCard } of cards) {
    if (prodCard) {
      // A copied version makes the card up to date for runs up to the dev build.
      const res = await prod.query(
        `UPDATE openaudit_card SET "builtAt" = greatest("builtAt", $2), "staleSince" = NULL, "staleAt" = NULL,
           error = NULL, "leaseExpiresAt" = CASE WHEN "leaseOwner" IS NULL THEN NULL ELSE "leaseExpiresAt" END,
           "updatedAt" = now()
         WHERE id = $1 AND NOT ("leaseOwner" IS NOT NULL AND "leaseExpiresAt" > now())`,
        [prodCard.id, c.builtAt],
      );
      if (res.rowCount !== 1) throw new Error(`Production builds the card of ${c.modelLabel} now.`);
      cardMap.set(c.id, prodCard.id);
    } else {
      await prod.query(
        `INSERT INTO openaudit_card (id, "modelId", "builtAt", "createdAt", "updatedAt")
         VALUES ($1, (SELECT id FROM model WHERE source || '|' || name = $2), $3, $4, now())`,
        [c.id, c.modelKey, c.builtAt, c.createdAt],
      );
      cardMap.set(c.id, c.id);
    }
    out.cards += 1;
  }
  if (versionIds.length) {
    const byVersion = { filter: '"versionId" = ANY($1::uuid[])', params: [versionIds] };
    out.versions = await copy(dev, prod, {
      table: 'openaudit_card_version',
      key: ['id'],
      filter: 'id = ANY($1::uuid[])',
      params: [versionIds],
      remap: { cardId: cardMap },
    });
    await copy(dev, prod, {
      table: 'openaudit_card_run',
      key: ['versionId', 'runId'],
      ...byVersion,
      remap: { evalVersionId: version },
    });
    await copy(dev, prod, { table: 'openaudit_card_snippet', key: ['versionId', 'snippetId'], ...byVersion });
  }
  // A synced run's snippets also join the older card versions that dev links them to.
  if (runIds.length) {
    const { rows: onProd } = await prod.query<{ id: string }>(`SELECT id FROM openaudit_card_version`);
    await copy(dev, prod, {
      table: 'openaudit_card_snippet',
      key: ['versionId', 'snippetId'],
      filter: `"snippetId" IN (SELECT id FROM openaudit_snippet WHERE "runId" = ANY($1::uuid[])) AND "versionId" = ANY($2::uuid[])`,
      params: [runIds, onProd.map((r) => r.id)],
    });
  }

  if (p.syncPanels.length) {
    const panels = [p.syncPanels];
    out.packets = await copy(dev, prod, {
      table: 'deploy_packet',
      key: ['id'],
      filter: 'id IN (SELECT "packetId" FROM deploy_panel WHERE id = ANY($1::uuid[]))',
      params: panels,
      remap: { modelId: model },
    });
    out.panels = await copy(dev, prod, {
      table: 'deploy_panel',
      key: ['id'],
      filter: 'id = ANY($1::uuid[])',
      params: panels,
      remap: { modelId: model },
    });
    out.reviews = await copy(dev, prod, {
      table: 'deploy_review',
      key: ['id'],
      filter: '"panelId" = ANY($1::uuid[])',
      params: panels,
    });
  }
  if (issues) out.issues = await syncIssues(dev, prod, sample);
  return out;
}

/**
 * Copies the known errors of samples that production has (EVAL_KNOWN_ERRORS.md). A row on both
 * sides keeps the newer review: staff can confirm on either side. Then the fail counts of the
 * changed versions are set again. Nothing when production has no `eval_sample_issue` yet.
 */
async function syncIssues(dev: Db, prod: Db, sample: Map<string, string>): Promise<number> {
  const { rows: has } = await prod.query<{ ok: boolean }>(
    `SELECT to_regclass('public.eval_sample_issue') IS NOT NULL AS ok`,
  );
  if (!has[0].ok) return 0;
  const { rows } = await dev.query<{ j: string; sid: string }>(
    `SELECT row_to_json(t)::text AS j, t."evalSampleId"::text AS sid FROM eval_sample_issue t`,
  );
  const shown = rows.filter((r) => sample.has(r.sid));
  if (!shown.length) return 0;
  const cols = await columns(prod, 'eval_sample_issue');
  const update = cols.filter((c) => !['id', 'evalSampleId', 'createdAt'].includes(c));
  const ids = Object.fromEntries(shown.map((r) => [r.sid, sample.get(r.sid)!]));
  const select = cols.map((c) => (c === 'evalSampleId' ? `($2::jsonb ->> s.${q(c)}::text)::uuid` : `s.${q(c)}`));
  const res = await prod.query<{ version: string }>(
    `INSERT INTO eval_sample_issue AS i (${cols.map(q).join(', ')})
     SELECT ${select.join(', ')} FROM json_populate_recordset(NULL::eval_sample_issue, $1::json) s
     ON CONFLICT ("evalSampleId") DO UPDATE SET ${update.map((c) => `${q(c)} = EXCLUDED.${q(c)}`).join(', ')}
       WHERE i."updatedAt" < EXCLUDED."updatedAt"
     RETURNING (SELECT "evalVersionId"::text FROM eval_sample WHERE id = i."evalSampleId") AS version`,
    [`[${shown.map((r) => r.j).join(',')}]`, JSON.stringify(ids)],
  );
  const versions = [...new Set(res.rows.map((r) => r.version))];
  if (versions.length) await prod.query(`SELECT refresh_sample_stats(v) FROM unnest($1::uuid[]) v`, [versions]);
  return res.rowCount ?? 0;
}
