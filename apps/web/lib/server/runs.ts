import { Prisma } from '#prisma';
import { metricRange, type Score } from '@/components/catalog/score';
import { prisma } from '@/lib/db';
import { chatGroup, type ChatGroup } from '@/lib/feed';
import { toUrlId } from '@/lib/ids';
import { newestVersionFirst } from '@/lib/latest-runs';
import { SEVERITIES, type SnippetSeverity } from '@/lib/openaudit-card';
import { evalReleased } from '@/lib/release-dates';
import { pickMin } from '@/lib/runs/attempt-scores';
import type { AttemptSettings } from '@/lib/runs/attempt-settings';
import { BLOCK_403, BLOCK_PATTERN, attemptBlock, runBlock, type AttemptBlock } from '@/lib/runs/blocks';
import { BY_HONEST, BY_LIES, BY_TOTAL, BY_TOTAL_ASC, fewestOf, isShareScore } from '@/lib/runs/detectors';
import { withholdReply } from '@/lib/runs/hazard';
import { mainScore } from '@/lib/runs/main-score';
import { canRun } from '@/lib/runs/routes';
import { attemptRule, redactAttempt, strictest, versionRule } from '@/lib/runs/terms';
import { excludedAttempt } from '@/lib/server/excluded-attempts';
import { attemptHazards, publicLocked, runHazard } from '@/lib/server/hazard';
import { r2Get } from '@/lib/server/r2';
import { runRules, sampleAccess, type SampleAccess } from '@/lib/server/terms';
import { getViewer } from '@/lib/server/viewer';
import {
  MODEL_INCLUDE,
  evalAttemptFromRow,
  evalFromRow,
  evalResultFromRow,
  evalRunFromRow,
  evalVersionFromRow,
  modelFromRow,
} from '@/lib/spec/rows';
import type {
  Direction,
  DisplayRule,
  EvalAttempt,
  EvalResult,
  EvalRun,
  EvalStatus,
  EvalVersion,
  Hazard,
  MetricDef,
  ScoreDef,
  Topic,
  Transcript,
} from '@openaudit/spec';
import { cache } from 'react';

// Eval runs: what the model page can queue, and the run and attempt pages. The runner
// (apps/runner) claims queued runs, runs them with Inspect and imports the log.
// Public and unlisted runs show to all; lists show only public ones, but a method eval's page lists
// its unlisted runs. Sample text shows only
// when the dataset's terms allow it for this viewer (`lib/runs/terms.ts`).

const SHOWN = ['public', 'unlisted'];
/** The runs of a hidden model show to no one. In SQL, `r` is the run. */
const NOT_HIDDEN = { model: { hidden: false } } satisfies Prisma.EvalRunWhereInput;
const notHidden = Prisma.sql`NOT EXISTS (SELECT 1 FROM model hm WHERE hm.id = r."modelId" AND hm.hidden)`;

export function runPath(run: Pick<EvalRun, 'id'>) {
  return `/runs/${toUrlId(run.id)}`;
}

export function attemptPath(run: Pick<EvalRun, 'id'>, ordinal: number) {
  return `${runPath(run)}/attempts/${ordinal}`;
}

/** A sample by its own id: its attempts in all runs, or (with `run`) in that run only. */
export function samplePath(sample: { id: string }, run?: Pick<EvalRun, 'id'>) {
  return `${run ? runPath(run) : ''}/samples/${toUrlId(sample.id)}`;
}

/** A link to an attempt by its own id, which does not change. It sends the reader to `attemptPath`. */
export function permanentAttemptPath(attempt: { id: string }) {
  return `/attempts/${toUrlId(attempt.id)}`;
}

/** The `attemptPath` of the attempt with this id. Null if there is none, or its run is not shown. */
export async function attemptPathById(id: string): Promise<string | null> {
  const a = await prisma.evalAttempt.findUnique({
    where: { id },
    select: { ordinal: true, run: { select: { id: true, visibility: true, model: { select: { hidden: true } } } } },
  });
  return a && SHOWN.includes(a.run.visibility) && !a.run.model.hidden ? attemptPath(a.run, a.ordinal) : null;
}

/** Public evals with public data whose newest published version the runner can run. Not retired
 * evals. Read once per request. */
export const runnableEvals = cache(async () => {
  const rows = await prisma.eval.findMany({
    where: { visibility: 'public', access: 'public', status: { not: 'retired' } },
    include: { versions: { where: { status: 'published' } } },
    orderBy: { displayName: 'asc' },
  });
  return rows.flatMap((r) => {
    const version = r.versions.map(evalVersionFromRow).sort(newestVersionFirst)[0];
    return version && canRun(version.runner)
      ? [
          {
            id: r.id,
            slug: r.slug,
            displayName: r.displayName,
            summary: r.summary,
            status: r.status as EvalStatus,
            topics: r.topics as Topic[],
            supersededBy: r.supersededBy,
            autoApprove: r.autoApprove,
            versionId: version.id,
            version: version.version,
            released: evalReleased(version),
            /** Who can read the run's samples (the dataset's terms). */
            display: versionRule(version),
            slots: version.runner?.models ?? [],
            defaultTrials: version.runner?.defaultTrials,
            defaultLimit: version.runner?.defaultLimit ?? null,
            rawReasoning: version.runner?.rawReasoning ?? false,
          },
        ]
      : [];
  });
});

export type RunListItem = Awaited<ReturnType<typeof listRuns>>[number];

/** Public runs, newest first, with their eval, model and headline result. `unlisted`: also the
 * unlisted runs. A method eval's runs are unlisted, so that model pages and cards leave them out. */
export async function listRuns(where: { modelId?: string; evalId?: string }, take = 50, unlisted = false) {
  const rows = await prisma.evalRun.findMany({
    where: { ...where, visibility: unlisted ? { in: SHOWN } : 'public', ...NOT_HIDDEN },
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      eval: { select: { slug: true, displayName: true, status: true } },
      evalVersion: { select: { version: true, releasedDate: true, metrics: true } },
      model: { select: { name: true, displayName: true, releaseDate: true } },
      results: { select: { metric: true, value: true, unit: true, stderr: true, safetyDirection: true } },
    },
  });
  return rows.map((r) => {
    const run = evalRunFromRow(r);
    const metrics = r.evalVersion.metrics as unknown as MetricDef[];
    const results = r.results.map((x): Score => ({
      metric: x.metric,
      value: x.value,
      ...(x.unit !== null && { unit: x.unit as Score['unit'] }),
      ...(x.stderr !== null && { stderr: x.stderr }),
      ...(x.safetyDirection !== null && { safetyDirection: x.safetyDirection as Direction }),
    }));
    const head = results.find((x) => x.metric === metrics.find((m) => m.headline)?.key) ?? results[0];
    const forBar = (x: (typeof results)[number]) => ({
      ...x,
      safetyDirection: metrics.find((m) => m.key === x.metric)?.safetyDirection ?? x.safetyDirection,
      range: metricRange(metrics, x.metric),
    });
    return {
      run,
      eval: r.eval,
      version: r.evalVersion.version,
      model: { name: r.model.name, displayName: r.model.displayName },
      /** The release dates of the model and the eval version (`releasedAfter`). */
      released: { model: r.model.releaseDate, eval: evalReleased(r.evalVersion) },
      /** The headline result, with its metric's range and safety direction for a bar. */
      result: head && forBar(head),
      /** All results, as `result`. */
      results: results.map(forBar),
    };
  });
}

/** A run's counts of attempts: passed, failed, and flagged by the group of their most severe
 * flagged chat in a published OpenAudit card. `passed` and `failed` do not count the graded
 * attempts of samples with a known error (EVAL_KNOWN_ERRORS.md); `excluded` counts them.
 * `blocked` and `errors`: the attempts with no score, as the run page counts them. */
export type RunTally = {
  passed: number;
  failed: number;
  excluded: number;
  blocked: number;
  errors: number;
  flags: Record<ChatGroup, number>;
};

/** The `RunTally` of each run, by run id. */
export async function runTallies(ids: string[]): Promise<Map<string, RunTally>> {
  if (!ids.length) return new Map();
  const [passes, flags, runs] = await Promise.all([
    prisma.$queryRaw<
      { run: string; passed: number; failed: number; excluded: number; errored: number; blocked: number }[]
    >`
      SELECT a."runId"::text AS run, count(*) FILTER (WHERE a.passed AND i.id IS NULL)::int AS passed,
        count(*) FILTER (WHERE a.passed = false AND i.id IS NULL)::int AS failed,
        count(*) FILTER (WHERE a.passed IS NOT NULL AND i.id IS NOT NULL)::int AS excluded,
        count(*) FILTER (WHERE a.status = 'error')::int AS errored,
        count(*) FILTER (WHERE a.status = 'error' AND (coalesce(a.error, '') ~* ${BLOCK_PATTERN}
          OR (coalesce(a.error, '') ~ ${BLOCK_403[0]} AND coalesce(a.error, '') ~ ${BLOCK_403[1]})))::int AS blocked
      FROM eval_attempt a LEFT JOIN eval_sample_issue i ON i."evalSampleId" = a."evalSampleId"
        AND i.status = 'confirmed' AND i.effect = 'exclude'
      WHERE a."runId" = ANY(${ids}::uuid[]) GROUP BY a."runId"`,
    prisma.$queryRaw<{ run: string; worst: number; n: number }[]>`
      SELECT run, worst, count(*)::int AS n FROM (
        SELECT a."runId"::text AS run, min(array_position(${[...SEVERITIES]}::text[], s.severity)) AS worst
        FROM openaudit_snippet s JOIN eval_attempt a ON a.id = s."attemptId"
        WHERE a."runId" = ANY(${ids}::uuid[]) AND EXISTS (SELECT 1 FROM openaudit_card_snippet j
          JOIN openaudit_card_version v ON v.id = j."versionId" WHERE j."snippetId" = s.id AND v.status = 'published')
          AND NOT ${excludedAttempt(Prisma.sql`a.id`)}
        GROUP BY a."runId", a.id
      ) f WHERE worst IS NOT NULL GROUP BY run, worst`,
    prisma.evalRun.findMany({ where: { id: { in: ids } }, select: { id: true, provenance: true } }),
  ]);
  const provenance = new Map(runs.map((r) => [r.id, r.provenance as EvalRun['provenance']]));
  const tallies = new Map<string, RunTally>();
  const tally = (run: string) => {
    let t = tallies.get(run);
    if (!t)
      tallies.set(
        run,
        (t = { passed: 0, failed: 0, excluded: 0, blocked: 0, errors: 0, flags: { high: 0, medium: 0, low: 0 } }),
      );
    return t;
  };
  for (const p of passes) {
    // As `pagedAttempts`: when one block has all of the run's errors, each error is that block.
    const blocked = runBlock(provenance.get(p.run)) ? p.errored : p.blocked;
    Object.assign(tally(p.run), {
      passed: p.passed,
      failed: p.failed,
      excluded: p.excluded,
      blocked,
      errors: p.errored - blocked,
    });
  }
  for (const f of flags) tally(f.run).flags[chatGroup(SEVERITIES[f.worst - 1]!)] += f.n;
  return tallies;
}

const LINK_SELECT = {
  id: true,
  evalId: true,
  eval: { select: { slug: true, displayName: true, summary: true, topics: true } },
  evalVersion: { select: { metrics: true } },
  results: { select: { metric: true, value: true, unit: true, safetyDirection: true } },
} satisfies Prisma.EvalRunSelect;

/** A run as a link to its eval: the eval's slug, name, summary and topics, and the run's headline result. */
function evalRunLink(r: Prisma.EvalRunGetPayload<{ select: typeof LINK_SELECT }>) {
  const metrics = r.evalVersion.metrics as unknown as MetricDef[];
  const def = metrics.find((m) => m.headline);
  const head = r.results.find((x) => x.metric === def?.key) ?? r.results[0];
  const declared = metrics.find((m) => m.key === head?.metric)?.safetyDirection;
  return {
    evalId: r.evalId,
    slug: r.eval.slug,
    label: r.eval.displayName,
    href: runPath(r),
    summary: r.eval.summary,
    topics: r.eval.topics as Topic[],
    result: head
      ? {
          metric: head.metric,
          value: head.value,
          unit: (head.unit ?? undefined) as EvalResult['unit'],
          safetyDirection: declared ?? ((head.safetyDirection ?? undefined) as Direction | undefined),
          range: metricRange(metrics, head.metric),
        }
      : null,
  };
}

/** The model's newest finished public run of each public eval, by eval name. `current`: a run that
 * stands for its eval in place of the newest. */
export async function evalRunLinks(modelId: string, current?: string) {
  const [rows, here] = await Promise.all([
    prisma.evalRun.findMany({
      where: { modelId, status: 'succeeded', visibility: 'public', eval: { visibility: 'public' } },
      orderBy: { createdAt: 'desc' },
      distinct: ['evalId'],
      select: LINK_SELECT,
    }),
    current ? prisma.evalRun.findUnique({ where: { id: current }, select: LINK_SELECT }) : null,
  ]);
  return [...rows.filter((r) => r.evalId !== here?.evalId), ...(here ? [here] : [])]
    .map(evalRunLink)
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** As `evalRunLinks`, for each of the models, by model id. One query. */
export async function evalRunLinksByModel(modelIds: string[]) {
  // Prisma's `distinct` reads all runs and their results, so SQL picks the newest run first.
  const newest = modelIds.length
    ? await prisma.$queryRaw<{ id: string }[]>`
        SELECT DISTINCT ON (r."modelId", r."evalId") r.id
        FROM eval_run r JOIN eval e ON e.id = r."evalId"
        WHERE r."modelId" = ANY(${modelIds}::uuid[]) AND r.origin <> 'rescore' AND r.status = 'succeeded'
          AND r.visibility = 'public' AND e.visibility = 'public'
        ORDER BY r."modelId", r."evalId", r."createdAt" DESC, r.id DESC`
    : [];
  const rows = newest.length
    ? await prisma.evalRun.findMany({
        where: { id: { in: newest.map((r) => r.id) } },
        select: { ...LINK_SELECT, modelId: true },
      })
    : [];
  const out = new Map<string, ReturnType<typeof evalRunLink>[]>();
  for (const r of rows) {
    const list = out.get(r.modelId);
    if (list) list.push(evalRunLink(r));
    else out.set(r.modelId, [evalRunLink(r)]);
  }
  for (const list of out.values()) list.sort((a, b) => a.label.localeCompare(b.label));
  return out;
}

/** Cached per request: the page and its breadcrumbs both read it. */
export const getRun = cache(async (id: string) => {
  const row = await prisma.evalRun.findUnique({
    where: { id },
    include: {
      eval: true,
      evalVersion: true,
      model: { include: MODEL_INCLUDE },
      results: { orderBy: { metric: 'asc' } },
      rescores: { where: { visibility: { in: SHOWN } }, orderBy: { createdAt: 'desc' }, include: { results: true } },
    },
  });
  if (!row || !SHOWN.includes(row.visibility) || row.model.hidden) return null;
  const version = evalVersionFromRow(row.evalVersion);
  const [access, subsetRules, logHazard] = await Promise.all([
    sampleAccess(version),
    runRules(row.id),
    runHazard(row.id),
  ]);
  const locked = await publicLocked(row.id, logHazard, version.sampleTerms ?? null);
  const omit = new Set(row.redactedOmit);
  return {
    run: evalRunFromRow(row),
    eval: evalFromRow(row.eval),
    version,
    access,
    /** The strictest rule over all attempts: the log has them all. */
    logRule: strictest([versionRule(version), ...subsetRules]),
    logHazard: logHazard.level,
    /** The attempts that make the log stricter than open. */
    logLocked: logHazard.attempts,
    model: modelFromRow(row.model),
    results: row.results.map(evalResultFromRow),
    rescores: row.rescores.map((r) => ({ run: evalRunFromRow(r), results: r.results.map(evalResultFromRow) })),
    logKey: row.logKey,
    /** The public copy of the log (`openaudit_runner/redact.py`). With no copy and no locked
     * attempt, it is the log itself. `ready`: it leaves out all the attempts that the public cannot
     * read now. `rule`: the strictest rule over the attempts in it. */
    redacted:
      row.redactedKey || (row.logKey && !locked.size)
        ? {
            key: row.redactedKey ?? row.logKey!,
            bytes: row.redactedKey ? row.redactedBytes : row.logBytes,
            omit: row.redactedOmit,
            ready: [...locked].every((id) => omit.has(id)),
            rule: strictest([versionRule(version), ...subsetRules.filter((r) => r !== 'scores_only')]),
          }
        : null,
    startedAt: row.startedAt,
  };
});

const ACTIVE = ['queued', 'running', 'importing'];

const QUEUE_INCLUDE = {
  eval: { select: { slug: true, displayName: true, status: true } },
  evalVersion: { select: { version: true } },
  model: { select: { name: true, displayName: true } },
} satisfies Prisma.EvalRunInclude;

/** A run for the run lists, with the times that the spec type does not keep. */
function queueItem(r: Prisma.EvalRunGetPayload<{ include: typeof QUEUE_INCLUDE }>) {
  return {
    run: evalRunFromRow(r),
    eval: r.eval,
    version: r.evalVersion.version,
    model: r.model,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
  };
}

/** The user's own runs, newest first. Only for that user: some can be private. */
export async function ownRuns(userId: string, take = 100) {
  const rows = await prisma.evalRun.findMany({
    where: { ownerUserId: userId },
    orderBy: { createdAt: 'desc' },
    take,
    include: QUEUE_INCLUDE,
  });
  return rows.map(queueItem);
}

export type AdminRun = Awaited<ReturnType<typeof adminRuns>>['queued'][number];
export type RequestedRun = Awaited<ReturnType<typeof adminRuns>>['requested'][number];

/** Who asked for a run, for the admin to decide on it. */
const REQUESTER = {
  id: true,
  name: true,
  username: true,
  email: true,
  affiliation: true,
  website: true,
  createdAt: true,
  _count: { select: { runs: { where: { status: 'succeeded' } } } },
} satisfies Prisma.UserSelect;

/** The run queue for admins: requests, active runs, and the newest that failed or were cancelled. */
export async function adminRuns(recent = 20) {
  const include = {
    ...QUEUE_INCLUDE,
    owner: { select: { email: true } },
    shards: { select: { status: true } },
  } satisfies Prisma.EvalRunInclude;
  const read = (status: string[], take: number, order: 'createdAt' | 'finishedAt') =>
    prisma.evalRun.findMany({
      where: { status: { in: status } },
      orderBy:
        order === 'createdAt'
          ? { createdAt: 'asc' }
          : [{ finishedAt: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
      take,
      include,
    });
  const item = (r: Awaited<ReturnType<typeof read>>[number]) => ({
    ...queueItem(r),
    ownerEmail: r.owner?.email ?? null,
    leaseOwner: r.leaseOwner,
    leaseExpiresAt: r.leaseExpiresAt,
    tries: r.tries,
    shards: r.shards.reduce<Record<string, number>>((n, s) => ({ ...n, [s.status]: (n[s.status] ?? 0) + 1 }), {}),
  });
  const [requested, queued, running, failed, cancelled] = await Promise.all([
    prisma.evalRun.findMany({
      where: { status: 'requested' },
      orderBy: { createdAt: 'asc' },
      take: 200,
      include: { ...QUEUE_INCLUDE, owner: { select: REQUESTER } },
    }),
    read(['queued'], 200, 'createdAt'),
    read(['running', 'importing'], 200, 'createdAt'),
    read(['failed'], recent, 'finishedAt'),
    read(['cancelled'], recent, 'finishedAt'),
  ]);
  return {
    requested: requested.map((r) => ({ ...queueItem(r), owner: r.owner })),
    queued: queued.map(item),
    running: running.map(item),
    failed: failed.map(item),
    cancelled: cancelled.map(item),
  };
}

/** Stops a requested, queued or running run and its shards. False when the run is not active. */
export async function cancelRun(runId: string, now = new Date(), error = 'Cancelled by an admin.'): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.evalRun.updateMany({
      where: { id: runId, status: { in: ['requested', ...ACTIVE] } },
      data: {
        status: 'cancelled',
        error,
        finishedAt: now,
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    });
    if (!count) return false;
    await tx.evalRunShard.updateMany({
      where: { runId, status: { in: ['queued', 'running'] } },
      data: { status: 'cancelled', finishedAt: now, leaseOwner: null, leaseExpiresAt: null },
    });
    return true;
  });
}

export const ATTEMPTS_PER_PAGE = 100;
/** `blocked`: errors that are provider blocks. `error`: the other errors. */
export type AttemptFilter = 'all' | 'passed' | 'failed' | 'blocked' | 'error';

/** `run`: its provenance gives a cut error its block (`attemptBlock`). */
type Readable = {
  version: Pick<EvalVersion, 'sampleTerms'>;
  access: SampleAccess;
  run?: Pick<EvalRun, 'provenance'>;
};
/** `hazard`: the attempt's level with its snippets'. `withheld`: the viewer cannot read the reply.
 * `flag`: the severity of its most severe flagged chat in a published OpenAudit card, and
 * `flagTitle` that chat's title. `block`: a provider refused its call for its policy. */
export type ShownAttempt = EvalAttempt & {
  hidden?: true;
  withheld?: true;
  flag?: SnippetSeverity;
  flagTitle?: string;
  block?: AttemptBlock;
  /** The split of the attempt's sample, for a `split` pick. */
  split?: string;
  settings?: AttemptSettings;
};
type AttemptFlag = { severity: SnippetSeverity; title: string | null };

function shown(a: EvalAttempt, level: Hazard | null, { version, access, run }: Readable): ShownAttempt {
  const block = a.status === 'error' ? attemptBlock(a.error, run?.provenance) : null;
  const b = { ...a, hazard: level ?? undefined, ...(block && { block }) };
  // The error text has the request, so the prompt too.
  if (!access.canRead(attemptRule(version, a))) {
    const { error: _e, ...redacted } = redactAttempt(b);
    return { ...redacted, hidden: true };
  }
  return access.canReadReply(level) ? b : { ...withholdReply(b), withheld: true };
}

/** Each attempt's most severe flagged chat in a published OpenAudit card, by attempt id. */
async function attemptFlags(ids: string[]): Promise<Map<string, AttemptFlag>> {
  const rows = ids.length
    ? await prisma.openAuditSnippet.findMany({
        where: { attemptId: { in: ids }, versions: { some: { version: { status: 'published' } } } },
        orderBy: { id: 'desc' },
        select: { attemptId: true, severity: true, title: true },
      })
    : [];
  const rank = (s: string) => SEVERITIES.indexOf(s as SnippetSeverity);
  const flags = new Map<string, AttemptFlag>();
  for (const r of rows) {
    const now = flags.get(r.attemptId);
    if (rank(r.severity) >= 0 && (!now || rank(r.severity) < rank(now.severity)))
      flags.set(r.attemptId, { severity: r.severity as SnippetSeverity, title: r.title });
  }
  return flags;
}

/** `shown`, with the attempt's `flag` and `flagTitle`. */
const shownFlagged = (a: EvalAttempt, level: Hazard | null, flag: AttemptFlag | undefined, r: Readable) => {
  const s = shown(a, level, r);
  return flag ? { ...s, flag: flag.severity, ...(flag.title && { flagTitle: flag.title }) } : s;
};

/** A metric that picks samples. `group`: the samples it counts (the attempt's `metrics`).
 * `split`: the samples of the split with the metric's key.
 * `score`: the samples whose score `scoreKey` is above `min`, highest first. */
/** `min`: on the metric's scale. `attemptScale`: as for `ScoreDef`. */
export type MetricPick =
  | { metric: string; kind: 'group' }
  | { metric: string; kind: 'split' }
  | { metric: string; kind: 'score'; scoreKey: string; min: number; attemptScale?: number };

/** A score value as a number, as the runner's `as_float` reads it. */
const scoreNumber = (key: string) => {
  const v = Prisma.sql`(scores -> ${key} -> 'value')`;
  const text = Prisma.sql`(scores -> ${key} ->> 'value')`;
  return Prisma.sql`CASE jsonb_typeof(${v})
    WHEN 'number' THEN ${text}::float8
    WHEN 'boolean' THEN CASE WHEN ${text}::boolean THEN 1 ELSE 0 END
    WHEN 'string' THEN CASE lower(trim(${text})) WHEN 'c' THEN 1 WHEN 'yes' THEN 1 WHEN 'true' THEN 1
      WHEN 'p' THEN 0.5 WHEN 'i' THEN 0 WHEN 'n' THEN 0 WHEN 'no' THEN 0 WHEN 'false' THEN 0 END
  END`;
};

/** The score keys of the run's attempts. */
const runScoreKeys = async (runId: string) =>
  (
    await prisma.$queryRaw<{ key: string }[]>`
      SELECT DISTINCT jsonb_object_keys(scores) AS key FROM eval_attempt WHERE "runId" = ${runId}::uuid ORDER BY 1`
  ).map((k) => k.key);

/**
 * The order of a run's samples, as `localRows` in the samples view orders them, but with no
 * locked-chat step: the most severe published flag first, then a picked score's highest first,
 * else the main score's worst first.
 */
async function sampleOrder(runId: string, version: EvalVersion, pick?: MetricPick) {
  const flag = Prisma.sql`(SELECT min(array_position(${[...SEVERITIES]}::text[], s.severity)) FROM openaudit_snippet s
    WHERE s."attemptId" = eval_attempt.id AND EXISTS (SELECT 1 FROM openaudit_card_snippet j
      JOIN openaudit_card_version v ON v.id = j."versionId" WHERE j."snippetId" = s.id AND v.status = 'published')) NULLS LAST`;
  if (pick?.kind === 'score') return Prisma.sql`${flag}, ${scoreNumber(pick.scoreKey)} DESC NULLS LAST, ordinal`;
  const main = mainScore(version, [], await runScoreKeys(runId));
  if (!main) return Prisma.sql`${flag}, ordinal`;
  const v = scoreNumber(main.key);
  const direction = main.bar?.safetyDirection;
  const harm =
    direction === 'higher_is_better'
      ? Prisma.sql`-(${v})`
      : direction === 'nearer_zero_is_better'
        ? Prisma.sql`abs(${v})`
        : v;
  return Prisma.sql`${flag}, ${harm} DESC NULLS LAST, ordinal`;
}

const RULES: DisplayRule[] = ['open', 'sign_in', 'scores_only'];

/** The attempts whose sample id, metric keys or input has `q` (case insensitive). The input
 * counts only where the reader can see it. */
function searchWhere(q: string, { version, access }: Readable) {
  const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
  const rules = RULES.filter((r) => access.canRead(r));
  return Prisma.sql`("sampleId" ILIKE ${like} OR array_to_string(metrics, ' ') ILIKE ${like}
    OR (COALESCE(display, ${versionRule(version)}) = ANY(${rules}::text[]) AND input ILIKE ${like}))`;
}

const pickWhere = (p: MetricPick) =>
  p.kind === 'group'
    ? Prisma.sql`${p.metric} = ANY(metrics)`
    : p.kind === 'split'
      ? Prisma.sql`"evalSampleId" IN (SELECT id FROM eval_sample WHERE split = ${p.metric})`
      : Prisma.sql`${scoreNumber(p.scoreKey)} > ${pickMin(p)}`;

/**
 * The run's metrics that pick samples, with the number of samples each picks. A metric with
 * samples in `metrics` is a group; else a metric whose `score` the attempts have is a score;
 * else a metric whose key is a split of the run's samples is a split.
 * A score key is the score or its `attemptName`, or ends with `/<name>`; a panel judge's own (`@`) is not.
 */
export async function metricPicks(
  runId: string,
  metrics: Pick<MetricDef, 'key' | 'score' | 'min'>[],
  defs: Pick<ScoreDef, 'key' | 'attemptName' | 'attemptScale'>[],
): Promise<{ pick: MetricPick; count: number }[]> {
  const [groups, keys, splitRows] = await Promise.all([
    prisma.$queryRaw<{ metric: string; n: number }[]>`
      SELECT m AS metric, count(*)::int AS n FROM eval_attempt, unnest(metrics) m
      WHERE "runId" = ${runId}::uuid GROUP BY m`,
    runScoreKeys(runId),
    prisma.$queryRaw<{ split: string; n: number }[]>`
      SELECT s.split, count(*)::int AS n FROM eval_attempt a JOIN eval_sample s ON s.id = a."evalSampleId"
      WHERE a."runId" = ${runId}::uuid GROUP BY s.split`,
  ]);
  const grouped = new Map(groups.map((g) => [g.metric, g.n]));
  const splits = new Map(splitRows.map((s) => [s.split, s.n]));
  const scoreKeys = keys.filter((k) => !k.includes('@'));
  const scores = metrics.flatMap((m): MetricPick[] => {
    const def = defs.find((d) => d.key === m.score);
    const names = [m.score, def?.attemptName].filter((n): n is string => !!n);
    const scoreKey = scoreKeys.find((k) => names.some((n) => k === n || k.endsWith(`/${n}`)));
    return !grouped.has(m.key) && scoreKey
      ? [{ metric: m.key, kind: 'score', scoreKey, min: m.min ?? 0, attemptScale: def?.attemptScale }]
      : [];
  });
  const [counts] = scores.length
    ? await prisma.$queryRaw<Record<string, number>[]>`
        SELECT ${Prisma.join(scores.map((p, i) => Prisma.sql`count(*) FILTER (WHERE ${pickWhere(p)})::int AS ${Prisma.raw(`c${i}`)}`))}
        FROM eval_attempt WHERE "runId" = ${runId}::uuid`
    : [];
  return [
    ...metrics.flatMap((m) =>
      grouped.has(m.key) ? [{ pick: { metric: m.key, kind: 'group' as const }, count: grouped.get(m.key)! }] : [],
    ),
    ...scores.map((pick, i) => ({ pick, count: counts?.[`c${i}`] ?? 0 })),
    ...metrics.flatMap((m) =>
      !grouped.has(m.key) && !scores.some((p) => p.metric === m.key) && splits.has(m.key)
        ? [{ pick: { metric: m.key, kind: 'split' as const }, count: splits.get(m.key)! }]
        : [],
    ),
  ];
}

/** The most attempts a run page gets at once, to filter and page them itself. */
export const LOCAL_ATTEMPTS = 2000;
/** The same for a methods eval: its page filters by each detector's call, and only here. */
export const METHOD_LOCAL_ATTEMPTS = 5000;
const LOCAL_INPUT = 400;

/**
 * All attempts of a run, in order, for the page to filter itself: the input shortened, no
 * output, and of the scores only the first and those `keep` names (a key or its last part). Null when the
 * run has more than `max`.
 */
export async function allAttemptsForRun(
  runId: string,
  readable: Readable,
  keep: string[],
  max = LOCAL_ATTEMPTS,
): Promise<ShownAttempt[] | null> {
  if ((await prisma.evalAttempt.count({ where: { runId } })) > max) return null;
  // The replies are the most data, and the page does not show them.
  const rows = await prisma.evalAttempt.findMany({
    where: { runId },
    orderBy: { ordinal: 'asc' },
    omit: { output: true },
  });
  const attempts = rows.map((r) => evalAttemptFromRow({ ...r, output: null }));
  const sampleIds = [...new Set(rows.flatMap((r) => (r.evalSampleId ? [r.evalSampleId] : [])))];
  const [levels, flags, samples] = await Promise.all([
    attemptHazards(attempts),
    attemptFlags(attempts.map((a) => a.id)),
    prisma.evalSample.findMany({ where: { id: { in: sampleIds } }, select: { id: true, split: true } }),
  ]);
  const splitOf = new Map(samples.map((s) => [s.id, s.split]));
  return attempts.map((a) => {
    const { output: _o, body: _b, ...b } = shownFlagged(a, levels.get(a.id) ?? null, flags.get(a.id), readable);
    const scores = Object.entries(b.scores).filter(
      ([k], i) => i === 0 || keep.some((s) => k === s || k.endsWith(`/${s}`)),
    );
    const split = a.evalSampleId && splitOf.get(a.evalSampleId);
    return {
      ...b,
      ...(split && { split }),
      input: b.input?.slice(0, LOCAL_INPUT),
      scores: Object.fromEntries(scores.map(([k, s]) => [k, s && { value: s.value, answer: s.answer }])),
    };
  });
}

/** A page of the attempts that `pick` picks (else all) and `q` finds, their number, and the
 * counts by result of all those. */
async function pagedAttempts(
  runId: string,
  filter: AttemptFilter,
  page: number,
  readable: Readable & { version: EvalVersion },
  pick?: MetricPick,
  q?: string,
) {
  const run = Prisma.sql`"runId" = ${runId}::uuid`;
  const searched = q ? Prisma.sql`${run} AND ${searchWhere(q, readable)}` : run;
  const picked = pick ? Prisma.sql`${searched} AND ${pickWhere(pick)}` : searched;
  // As `attemptBlock`: when one block has all of the run's errors, each error is that block.
  const block = runBlock(readable.run?.provenance)
    ? Prisma.sql`true`
    : Prisma.sql`(coalesce(error, '') ~* ${BLOCK_PATTERN}
        OR (coalesce(error, '') ~ ${BLOCK_403[0]} AND coalesce(error, '') ~ ${BLOCK_403[1]}))`;
  const shown = {
    all: picked,
    passed: Prisma.sql`${picked} AND passed`,
    failed: Prisma.sql`${picked} AND passed = false`,
    blocked: Prisma.sql`${picked} AND status = 'error' AND ${block}`,
    error: Prisma.sql`${picked} AND status = 'error' AND NOT ${block}`,
  }[filter];
  const order = await sampleOrder(runId, readable.version, pick);
  const [ids, [found], counts] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM eval_attempt WHERE ${shown} ORDER BY ${order}
      LIMIT ${ATTEMPTS_PER_PAGE} OFFSET ${(page - 1) * ATTEMPTS_PER_PAGE}`,
    prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM eval_attempt WHERE ${shown}`,
    prisma.$queryRaw<{ passed: boolean | null; status: string; blocked: boolean; _count: number }[]>`
      SELECT passed, status, status = 'error' AND ${block} AS blocked, count(*)::int AS "_count"
      FROM eval_attempt WHERE ${picked} GROUP BY 1, 2, 3`,
  ]);
  const at = new Map(ids.map((r, i) => [r.id, i]));
  const rows = await prisma.evalAttempt.findMany({ where: { id: { in: [...at.keys()] } } });
  return [rows.sort((a, b) => at.get(a.id)! - at.get(b.id)!), found?.n ?? 0, counts] as const;
}

export async function attemptsForRun(
  runId: string,
  filter: AttemptFilter,
  page: number,
  readable: Readable & { version: EvalVersion },
  pick?: MetricPick,
  q?: string,
) {
  const [rows, total, counts] = await pagedAttempts(runId, filter, page, readable, pick, q);
  const sum = (f: (c: (typeof counts)[number]) => boolean) => counts.filter(f).reduce((n, c) => n + c._count, 0);
  const attempts = rows.map(evalAttemptFromRow);
  const [levels, flags] = await Promise.all([attemptHazards(attempts), attemptFlags(attempts.map((a) => a.id))]);
  return {
    attempts: attempts.map((a) => shownFlagged(a, levels.get(a.id) ?? null, flags.get(a.id), readable)),
    total,
    counts: {
      all: sum(() => true),
      passed: sum((c) => c.passed === true),
      failed: sum((c) => c.passed === false),
      blocked: sum((c) => c.blocked),
      error: sum((c) => c.status === 'error' && !c.blocked),
    },
  };
}

/** One attempt, its transcript from R2, the ordinals before and after it, and the summary of a
 * withheld reply (`summary`). */
/** One attempt as the viewer can read it, or null. */
export async function getShownAttempt(runId: string, ordinal: number, readable: Readable) {
  const row = await prisma.evalAttempt.findUnique({
    where: { runId_ordinal: { runId, ordinal } },
    omit: { settings: false },
  });
  if (!row) return null;
  const a = evalAttemptFromRow(row);
  const s = shown(a, (await attemptHazards([a])).get(a.id) ?? null, readable);
  return row.settings ? { ...s, settings: row.settings as AttemptSettings } : s;
}

export async function getAttempt(runId: string, ordinal: number, readable: Readable) {
  const attempt = await getShownAttempt(runId, ordinal, readable);
  if (!attempt) return null;
  const [transcript, last, summary] = await Promise.all([
    attempt.body ? readTranscript(attempt.body.key) : null,
    prisma.evalAttempt.aggregate({ where: { runId }, _max: { ordinal: true } }),
    replySummary(attempt),
  ]);
  const max = last._max.ordinal ?? ordinal;
  return {
    attempt,
    transcript,
    summary,
    prev: ordinal > 1 ? ordinal - 1 : null,
    next: ordinal < max ? ordinal + 1 : null,
    total: max,
  };
}

/**
 * A sample and its attempts in shown runs (with `runId`, in that run only), newest run first.
 * A finished re-score replaces its source run (as in `current`). Null if there is no sample.
 */
export async function getSampleAttempts(id: string, runId?: string) {
  const [row, rows] = await Promise.all([
    prisma.evalSample.findUnique({
      where: { id },
      include: { evalVersion: { include: { eval: true } }, issue: true },
    }),
    prisma.evalAttempt.findMany({
      where: {
        evalSampleId: id,
        run: {
          visibility: { in: SHOWN },
          ...NOT_HIDDEN,
          ...(runId
            ? { id: runId }
            : {
                OR: [{ origin: { not: 'rescore' } }, { status: 'succeeded' }],
                rescores: { none: { status: 'succeeded', visibility: { in: SHOWN } } },
              }),
        },
      },
      include: {
        run: {
          select: {
            id: true,
            createdAt: true,
            provenance: true,
            settings: true,
            model: { select: { name: true, displayName: true } },
          },
        },
      },
      orderBy: [{ run: { createdAt: 'desc' } }, { epoch: 'asc' }],
    }),
    // `sampleAccess` reads the viewer again, from the request's cache.
    getViewer(),
  ]);
  if (!row) return null;
  const version = evalVersionFromRow(row.evalVersion);
  const attempts = rows.map(evalAttemptFromRow);
  const [access, levels, flags] = await Promise.all([
    sampleAccess(version),
    attemptHazards(attempts),
    attemptFlags(attempts.map((a) => a.id)),
  ]);
  const shownAttempts = rows.map((r, i) => ({
    attempt: shownFlagged(attempts[i]!, levels.get(r.id) ?? null, flags.get(r.id), {
      version,
      access,
      run: { provenance: r.run.provenance as EvalRun['provenance'] },
    }),
    run: { id: r.run.id, createdAt: r.run.createdAt },
    model: r.run.model,
  }));
  return {
    sample: { id: row.id, split: row.split, sourceId: row.sourceId },
    issue:
      row.issue?.status === 'confirmed'
        ? { kind: row.issue.kind, effect: row.issue.effect, note: row.issue.note }
        : null,
    eval: evalFromRow(row.evalVersion.eval),
    version,
    access,
    attempts: shownAttempts,
    newest: await newestReadable(shownAttempts, rows),
    slotModels: slotModels(version.runner?.models ?? [], rows),
  };
}

/** Each slot's models in the attempts' runs, the most used first. A run that sets none used the
 * slot's default. */
function slotModels(slots: { id: string; default: string }[], rows: { run: { settings: unknown } }[]) {
  const out: Record<string, string[]> = {};
  for (const s of slots) {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const model = (r.run.settings as EvalRun['settings'] | null)?.models?.[s.id]?.model || s.default;
      counts.set(model, (counts.get(model) ?? 0) + 1);
    }
    out[s.id] = [...counts].sort((a, b) => b[1] - a[1]).map(([m]) => m);
  }
  return out;
}

/** The newest attempt that the reader can read, with its transcript, model and the run's role models.
 * Its prompts and metadata show for the sample. */
async function newestReadable(
  shown: { attempt: ShownAttempt }[],
  rows: { run: { settings: unknown; model: { name: string; displayName: string } } }[],
) {
  const i = shown.findIndex((x) => !x.attempt.hidden && !x.attempt.withheld && x.attempt.body);
  const transcript = i < 0 ? null : await readTranscript(shown[i]!.attempt.body!.key);
  if (!transcript) return null;
  const settings = rows[i]!.run.settings as EvalRun['settings'] | null;
  return { transcript, model: rows[i]!.run.model, models: settings?.models ?? {} };
}

export type SampleAttempts = NonNullable<Awaited<ReturnType<typeof getSampleAttempts>>>;

/** Why the results leave out each readable attempt with no scores: its `notScored`. By attempt id;
 * attempts with no reason are not in the map. */
export function notScoredReasons(attempts: ShownAttempt[]): Map<string, string> {
  return new Map(
    attempts.flatMap((a) =>
      !a.hidden && !a.withheld && a.notScored && !Object.keys(a.scores).length ? [[a.id, a.notScored] as const] : [],
    ),
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `notScoredReasons` of the run's attempts with these ids, at most `ATTEMPTS_PER_PAGE`. */
export async function runNotScored(runId: string, ids: string[], readable: Readable): Promise<Record<string, string>> {
  const wanted = ids.filter((id) => typeof id === 'string' && UUID.test(id)).slice(0, ATTEMPTS_PER_PAGE);
  if (!wanted.length) return {};
  const rows = await prisma.evalAttempt.findMany({ where: { runId, id: { in: wanted } }, omit: { output: true } });
  const attempts = rows.map((r) => evalAttemptFromRow({ ...r, output: null }));
  const levels = await attemptHazards(attempts);
  const reasons = notScoredReasons(attempts.map((a) => shown(a, levels.get(a.id) ?? null, readable)));
  return Object.fromEntries(reasons);
}

/** The sample and up to `n` samples of its version on each side, by split, then source id (numbers
 * by value). Empty if there is no such sample. */
export async function samplesNear(id: string, n = 100) {
  return prisma.$queryRaw<{ id: string; split: string; sourceId: string }[]>`
    WITH o AS (
      SELECT s.id, s.split, s."sourceId", row_number() OVER (
        ORDER BY s.split, CASE WHEN s."sourceId" ~ '^[0-9]{1,18}$' THEN s."sourceId"::bigint END, s."sourceId"
      ) AS i
      FROM eval_sample s
      WHERE s."evalVersionId" = (SELECT "evalVersionId" FROM eval_sample WHERE id = ${id}::uuid)
    )
    SELECT o.id::text AS id, o.split, o."sourceId"
    FROM o, (SELECT i FROM o WHERE id = ${id}::uuid) h
    WHERE o.i BETWEEN h.i - ${n}::int AND h.i + ${n}::int
    ORDER BY o.i`;
}

/** A sample in the eval page's list. `input`: its start. `hidden`: the reader may not read it.
 * `graded`, `failed`: its graded replies and the ones that failed (`refresh_sample_stats`). */
export type EvalSampleItem = {
  id: string;
  href: string;
  split: string;
  sourceId: string;
  input: string | null;
  hidden: boolean;
  graded: number;
  failed: number;
  /** The sample has a confirmed known error that takes it out of the counts. */
  known: boolean;
};

/** `failed`: the most failed replies first (fewer graded first in a tie). `failedAsc`: the fewest
 * first (more graded first in a tie). `source`: by split, then source id (numbers by value). */
export type SampleOrder = 'failed' | 'failedAsc' | 'source';

const PREVIEW = 240;
/** The samples in one load of the eval page's list. */
export const SAMPLE_PAGE = 100;

/** `r` is a shown run's current grades: a finished re-score replaces its source run. Not of a
 * hidden model. */
const current = Prisma.sql`(r.origin <> 'rescore' OR r.status = 'succeeded') AND NOT EXISTS (
  SELECT 1 FROM eval_run q WHERE q."sourceRunId" = r.id AND q.status = 'succeeded'
    AND q.visibility = ANY(${SHOWN}::text[])) AND ${notHidden}`;

/** The ids of the version's samples that a shown run used (`current`). */
const usedSamples = (versionId: string) => Prisma.sql`
  SELECT DISTINCT x."evalSampleId" AS id FROM eval_run r JOIN eval_attempt x ON x."runId" = r.id
  WHERE r."evalVersionId" = ${versionId}::uuid AND r.visibility = ANY(${SHOWN}::text[])
    AND ${current} AND x."evalSampleId" IS NOT NULL`;

/** The number of the version's samples that a shown run used: the samples in the eval page's list. */
export async function usedSampleCount(versionId: string): Promise<number> {
  const [row] = await prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM (${usedSamples(versionId)}) u`;
  return row?.n ?? 0;
}

/** The number of the version's samples in each split that a shown run used, by split name. */
export async function usedSplitCounts(versionId: string): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<{ split: string; n: number }[]>`
    SELECT s.split, count(*)::int AS n FROM (${usedSamples(versionId)}) u JOIN eval_sample s ON s.id = u.id
    GROUP BY s.split`;
  return new Map(rows.map((r) => [r.split, r.n]));
}

/** The version's `limit` most failed samples that a shown run used, in the order of the eval page's
 * list, with no text. A sample with a known error has no failed replies, so it is not here. */
export async function mostFailedSamples(versionId: string, limit: number) {
  return prisma.$queryRaw<{ id: string; split: string; sourceId: string; graded: number; failed: number }[]>`
    WITH used AS MATERIALIZED (${usedSamples(versionId)})
    SELECT s.id::text AS id, s.split, s."sourceId", s.graded, s.failed
    FROM used u JOIN eval_sample s ON s.id = u.id
    WHERE s."evalVersionId" = ${versionId}::uuid AND s.failed > 0
    ORDER BY s.failed DESC, s.graded, s.id LIMIT ${limit}`;
}

/** The samples whose id has `query` in it, or whose text (`eval_sample.search`) matches it as a web
 * search (quotes, `or`, `-`). Text matches only when the reader can read an attempt of the sample. */
function sampleMatch(versionId: string, query: string, rule: string, rules: string[]) {
  const like = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
  return Prisma.sql`AND (s."sourceId" ILIKE ${like} OR (s.search @@ websearch_to_tsquery('english', ${query})
    AND EXISTS (SELECT 1 FROM eval_attempt x JOIN eval_run r ON r.id = x."runId"
      WHERE x."evalSampleId" = s.id AND r."evalVersionId" = ${versionId}::uuid
        AND r.visibility = ANY(${SHOWN}::text[]) AND ${current} AND x.input IS NOT NULL
        AND COALESCE(x.display, ${rule}) = ANY(${rules}::text[]))))`;
}

/** `SAMPLE_PAGE` of the version's samples that a shown run used, from `offset`, in `order`. The
 * input is the stored one, else one from an attempt that the reader can read. `search`: only the
 * samples that match it (`sampleMatch`). */
export async function evalSampleList(
  version: Pick<EvalVersion, 'id' | 'sampleTerms'>,
  access: SampleAccess,
  offset = 0,
  order: SampleOrder = 'source',
  search = '',
): Promise<EvalSampleItem[]> {
  const rule = versionRule(version);
  const rules = RULES.filter((r) => access.canRead(r));
  const stored = access.canRead(rule);
  const query = search.trim().slice(0, 200);
  const match = query ? sampleMatch(version.id, query, rule, rules) : Prisma.empty;
  const sort =
    order === 'failed'
      ? Prisma.sql`s.failed DESC, s.graded, s.id`
      : order === 'failedAsc'
        ? Prisma.sql`s.failed, s.graded DESC, s.id`
        : Prisma.sql`s.split, CASE WHEN s."sourceId" ~ '^[0-9]{1,18}$' THEN s."sourceId"::bigint END, s."sourceId"`;
  const rows = await prisma.$queryRaw<(Omit<EvalSampleItem, 'href' | 'hidden'> & { ok: boolean })[]>`
    WITH used AS MATERIALIZED (${usedSamples(version.id)}), page AS (
      SELECT s.id, s.split, s."sourceId", s.input, s.graded, s.failed
      FROM used u JOIN eval_sample s ON s.id = u.id WHERE s."evalVersionId" = ${version.id}::uuid ${match}
      ORDER BY ${sort} LIMIT ${SAMPLE_PAGE} OFFSET ${Math.max(0, Math.floor(offset))}
    ), pick AS (
      SELECT DISTINCT ON (x."evalSampleId") x."evalSampleId" AS sid,
        COALESCE(x.display, ${rule}) = ANY(${rules}::text[]) AS ok,
        CASE WHEN COALESCE(x.display, ${rule}) = ANY(${rules}::text[]) THEN left(x.input, ${PREVIEW}) END AS input
      FROM page JOIN eval_attempt x ON x."evalSampleId" = page.id JOIN eval_run r ON r.id = x."runId"
      WHERE r."evalVersionId" = ${version.id}::uuid AND r.visibility = ANY(${SHOWN}::text[])
        AND ${current}
      ORDER BY x."evalSampleId", ok DESC, (x.input IS NOT NULL) DESC, r."createdAt" DESC
    )
    SELECT s.id::text AS id, s.split, s."sourceId", s.graded, s.failed,
      EXISTS (SELECT 1 FROM eval_sample_issue i WHERE i."evalSampleId" = s.id
        AND i.status = 'confirmed' AND i.effect = 'exclude') AS known,
      CASE WHEN ${stored} AND jsonb_typeof(s.input) = 'string' THEN left(s.input #>> '{}', ${PREVIEW})
        ELSE p.input END AS input,
      COALESCE(p.ok, ${stored}) AS ok
    FROM page s LEFT JOIN pick p ON p.sid = s.id
    ORDER BY ${sort}`;
  return rows.map(({ ok, ...r }) => ({ ...r, href: samplePath(r), hidden: !ok }));
}

/** How a detector's misses count. `label`: the replies with the label `lie` or `honest` that it
 * called wrong. `share`: the hidden tokens that it missed, from its score (the share that it found),
 * as a mean over the scored replies. `hit`: as `share`, with one test for each reply (a score of 1
 * or 0). */
export type DetectorKind = 'label' | 'share' | 'hit';

/** A `label` detector's misses on a sample: lies and honest replies that it called wrong. */
export type Misses = { lies: number; honest: number };
/** A `share` detector on a sample: the mean of the hidden tokens that it missed in each scored
 * reply (null with none), and the number of scored replies. */
export type Finds = { mean: number | null; scored: number };

/** A sample and the replies that each detector got wrong. `missed`: by detector score key. `all`
 * and `total`: for all detectors, the sum of the misses, or for `share` and `hit` the mean.
 * `tokens`: the target (hidden tokens, or a swap), for `share` and `hit`. */
export type DetectorSampleItem = Omit<EvalSampleItem, 'graded' | 'failed'> & {
  missed: Record<string, Misses | Finds>;
  all: Misses | Finds;
  total: number | null;
  tokens?: string[];
  /** With a model filter: the path of that model's attempt. */
  attempt?: string;
};

const anyAttempt = (versionId: string, test: Prisma.Sql) => prisma.$queryRaw<{ ok: boolean }[]>`
  SELECT EXISTS (SELECT 1 FROM eval_attempt x JOIN eval_run r ON r.id = x."runId"
    WHERE r."evalVersionId" = ${versionId}::uuid AND r.visibility = ANY(${SHOWN}::text[])
      AND ${notHidden} AND x."evalSampleId" IS NOT NULL AND ${test}) AS ok`;

/** The detectors of a methods eval: the attempt score keys whose scores have an answer (`label`).
 * With none, the keys of the `variants` (by slug, with `_` for `-`) whose scores are a share from
 * 0 to 1 (`share`), or `hit` when all of them are 1 or 0. */
export async function detectorKeys(
  versionId: string,
  scores: ScoreDef[],
  variants: Set<string>,
): Promise<{ keys: string[]; kind: DetectorKind }> {
  const keys = [...new Set(scores.map((s) => s.attemptName ?? s.key))];
  const answered = await Promise.all(keys.map((k) => anyAttempt(versionId, Prisma.sql`x.scores -> ${k} ? 'answer'`)));
  const labels = keys.filter((_, i) => answered[i]?.[0]?.ok);
  if (labels.length) return { keys: labels, kind: 'label' };
  const defs = scores.filter((s) => isShareScore(s) && variants.has((s.attemptName ?? s.key).replaceAll('_', '-')));
  const shares = defs.map((s) => s.attemptName ?? s.key);
  const valued = await Promise.all(
    shares.map((k) => anyAttempt(versionId, Prisma.sql`jsonb_typeof(x.scores -> ${k} -> 'value') = 'number'`)),
  );
  const hit = defs.length > 0 && defs.every((s) => s.type === 'binary');
  return { keys: shares.filter((_, i) => valued[i]?.[0]?.ok), kind: hit ? 'hit' : 'share' };
}

/** A metric that the sample list can count misses on. `data`: the attempts have its scores.
 * `split`: it has no scores, but its key is a split of the version, so the list shows that split's
 * samples with the headline's misses. `count`: its number of samples, for the menu. */
export type SampleMetric = {
  key: string;
  name: string;
  about?: string;
  data: boolean;
  split?: boolean;
  count?: number;
};

/** The version's ranked metrics, the headline first, for the sample list of the detectors `keys`.
 * The headline always has data; another metric has data when some attempt has a `<key>/<metric>`
 * score for a detector in `keys`. */
export async function sampleMetrics(
  version: { id: string; metrics: MetricDef[] },
  keys: string[],
): Promise<SampleMetric[]> {
  const headline = version.metrics.find((m) => m.headline);
  if (!headline || !keys.length) return [];
  const [rows, splitRows] = await Promise.all([
    prisma.$queryRaw<{ k: string }[]>`
      SELECT DISTINCT k FROM eval_attempt x JOIN eval_run r ON r.id = x."runId", jsonb_object_keys(x.scores) k
      WHERE r."evalVersionId" = ${version.id}::uuid AND r.visibility = ANY(${SHOWN}::text[])
        AND ${current} AND k LIKE '%/%'`,
    prisma.$queryRaw<{ split: string }[]>`
      SELECT DISTINCT split FROM eval_sample WHERE "evalVersionId" = ${version.id}::uuid`,
  ]);
  const found = new Set(
    rows.filter(({ k }) => keys.includes(k.slice(0, k.indexOf('/')))).map(({ k }) => k.slice(k.indexOf('/') + 1)),
  );
  const splits = new Set(splitRows.map((r) => r.split));
  return [headline, ...version.metrics.filter((m) => m !== headline && m.direction !== 'neither')].map((m) => {
    const data = m === headline || found.has(m.key);
    return {
      key: m.key,
      name: m.displayName,
      about: m.description,
      data,
      ...(!data && splits.has(m.key) && { split: true }),
    };
  });
}

/** `SAMPLE_PAGE` of the version's samples from `offset`, with the misses of each detector in `keys`
 * over the shown runs (`current`), counted as `kind`. `by`: a key, the most misses of that detector
 * first; `fewestOf` a key, its fewest misses first; a list of these, by the sum of their misses
 * and passes; `BY_LIES`, `BY_HONEST` or `BY_TOTAL`, the most of those misses first;
 * `BY_TOTAL_ASC`, the fewest misses first; else by split, then source id.
 * `model`: only the attempts of the model with this name, and a link to its attempt (`attempt`).
 * `metric`: for `share` and `hit`, count the misses on this metric's `<key>/<metric>` scores, not
 * on the headline scores. `lower`: a higher value is a miss. `split`: only the samples of this split. */
export async function detectorSampleList(
  version: Pick<EvalVersion, 'id' | 'sampleTerms'>,
  access: SampleAccess,
  keys: string[],
  offset = 0,
  by?: string | readonly string[],
  kind: DetectorKind = 'label',
  model?: string,
  metric?: { key: string; lower: boolean },
  split?: string,
): Promise<DetectorSampleItem[]> {
  if (!keys.length) return [];
  const ofSplit = split ? Prisma.sql`AND s.split = ${split}` : Prisma.empty;
  const field = (k: string) => (metric && kind !== 'label' ? `${k}/${metric.key}` : k);
  const ofModel = model ? Prisma.sql`AND r."modelId" IN (SELECT id FROM model WHERE name = ${model})` : Prisma.empty;
  const rule = versionRule(version);
  const rules = RULES.filter((r) => access.canRead(r));
  const stored = access.canRead(rule);
  const miss = (k: string, label: string) =>
    Prisma.sql`count(*) FILTER (WHERE x.target #>> '{}' = ${label} AND x.scores -> ${k} ? 'answer'
      AND x.scores -> ${k} ->> 'answer' <> ${label})::int`;
  const scored = (k: string) => Prisma.sql`jsonb_typeof(x.scores -> ${field(k)} -> 'value') = 'number'`;
  const share = kind !== 'label';
  const tokens =
    kind === 'hit'
      ? Prisma.sql`1`
      : Prisma.sql`CASE jsonb_typeof(x.target) WHEN 'array' THEN jsonb_array_length(x.target) ELSE 1 END`;
  const value = (k: string) => Prisma.sql`(x.scores -> ${field(k)} ->> 'value')::float8`;
  const lost = (k: string) =>
    Prisma.sql`COALESCE(sum(round((${metric?.lower ? value(k) : Prisma.sql`1 - ${value(k)}`}) * ${tokens}))
      FILTER (WHERE ${scored(k)}), 0)::int`;
  // `l` and `h`: missed lies and missed honest replies; for `share`, the missed tokens and the
  // scored replies.
  const counts = keys.map((k, i) =>
    share
      ? Prisma.sql`${lost(k)} AS ${Prisma.raw(`l${i}`)}, count(*) FILTER (WHERE ${scored(k)})::int AS ${Prisma.raw(`h${i}`)}`
      : Prisma.sql`${miss(k, 'lie')} AS ${Prisma.raw(`l${i}`)}, ${miss(k, 'honest')} AS ${Prisma.raw(`h${i}`)}`,
  );
  const sum = (c: string) => Prisma.raw(keys.map((_, i) => `t.${c}${i}`).join(' + '));
  const total = share
    ? Prisma.sql`(${sum('l')})::float8 / NULLIF(${sum('h')}, 0)`
    : Prisma.sql`${sum('l')} + ${sum('h')}`;
  const columns = Prisma.raw(keys.map((_, i) => `s.l${i}, s.h${i}`).join(', '));
  const tie = 'total DESC NULLS LAST, labeled DESC, id';
  const tieAsc = 'total ASC NULLS LAST, labeled DESC, id';
  const order = typeof by === 'string' ? [by] : (by ?? []);
  const ratio = (i: number) => `l${i}::float8 / NULLIF(h${i}, 0)`;
  // The detectors' sorts add up to one score: the misses of each "most missed" detector, and the
  // passes of each "fewest missed" one. A share with no scored replies adds 0.
  const parts = order.flatMap((b) => {
    const at = keys.indexOf(b);
    if (at >= 0) return [{ sql: share ? `COALESCE(${ratio(at)}, 0)` : `(l${at} + h${at})`, asc: false }];
    const i = keys.findIndex((k) => fewestOf(k) === b);
    if (i < 0) return [];
    return [{ sql: share ? `COALESCE(1 - ${ratio(i)}, 0)` : `-(l${i} + h${i})`, asc: true }];
  });
  const first = order[0];
  const sort = Prisma.raw(
    parts.length
      ? `${parts.map((p) => p.sql).join(' + ')} DESC, ${parts.every((p) => p.asc) ? tieAsc : tie}`
      : first === BY_LIES
        ? `lies DESC, ${tie}`
        : first === BY_HONEST
          ? `honest DESC, ${tie}`
          : first === BY_TOTAL
            ? tie
            : first === BY_TOTAL_ASC
              ? tieAsc
              : `split, CASE WHEN "sourceId" ~ '^[0-9]{1,18}$' THEN "sourceId"::bigint END, "sourceId", id`,
  );
  const rows = await prisma.$queryRaw<(Record<string, unknown> & { id: string; ok: boolean })[]>`
    WITH stats AS MATERIALIZED (
      SELECT x."evalSampleId" AS sid, count(*) FILTER (WHERE x.target #>> '{}' IN ('lie', 'honest'))::int AS labeled,
        ${Prisma.join(counts)}
      FROM eval_attempt x JOIN eval_run r ON r.id = x."runId"
      WHERE r."evalVersionId" = ${version.id}::uuid AND r.visibility = ANY(${SHOWN}::text[])
        AND ${current} AND x."evalSampleId" IS NOT NULL ${ofModel}
      GROUP BY x."evalSampleId"
      ${metric && share ? Prisma.sql`HAVING bool_or(${Prisma.join(keys.map(scored), ' OR ')})` : Prisma.empty}
    ), page AS (
      SELECT s.id, s.split, s."sourceId", s.input, t.*, ${sum('l')} AS lies, ${sum('h')} AS honest,
        ${total} AS total
      FROM stats t JOIN eval_sample s ON s.id = t.sid WHERE s."evalVersionId" = ${version.id}::uuid ${ofSplit}
      ORDER BY ${sort} LIMIT ${SAMPLE_PAGE} OFFSET ${Math.max(0, Math.floor(offset))}
    ), pick AS (
      SELECT DISTINCT ON (x."evalSampleId") x."evalSampleId" AS sid, x."runId", x.ordinal,
        COALESCE(x.display, ${rule}) = ANY(${rules}::text[]) AS ok,
        CASE WHEN COALESCE(x.display, ${rule}) = ANY(${rules}::text[]) THEN left(x.input, ${PREVIEW}) END AS input,
        CASE WHEN COALESCE(x.display, ${rule}) = ANY(${rules}::text[]) THEN x.target END AS target
      FROM page JOIN eval_attempt x ON x."evalSampleId" = page.id JOIN eval_run r ON r.id = x."runId"
      WHERE r."evalVersionId" = ${version.id}::uuid AND r.visibility = ANY(${SHOWN}::text[])
        AND ${current} ${ofModel}
      ORDER BY x."evalSampleId", ok DESC, (x.input IS NOT NULL) DESC, r."createdAt" DESC
    )
    SELECT s.id::text AS id, s.split, s."sourceId", s.lies, s.honest, ${columns}, s.total, p.target,
      p."runId"::text AS "runId", p.ordinal,
      EXISTS (SELECT 1 FROM eval_sample_issue i WHERE i."evalSampleId" = s.id
        AND i.status = 'confirmed' AND i.effect = 'exclude') AS known,
      CASE WHEN ${stored} AND jsonb_typeof(s.input) = 'string' THEN left(s.input #>> '{}', ${PREVIEW})
        ELSE p.input END AS input,
      COALESCE(p.ok, ${stored}) AS ok
    FROM page s LEFT JOIN pick p ON p.sid = s.id
    ORDER BY ${sort}`;
  const pair = (a: unknown, b: unknown): Misses | Finds =>
    share
      ? { mean: b ? (a as number) / (b as number) : null, scored: b as number }
      : { lies: a as number, honest: b as number };
  return rows.map((r) => {
    const id = r.id;
    const target = [r.target].flat().filter((t): t is string => typeof t === 'string');
    return {
      id,
      href: samplePath({ id }),
      split: r.split as string,
      sourceId: r.sourceId as string,
      input: (r.input as string | null) ?? null,
      hidden: !r.ok,
      known: r.known as boolean,
      missed: Object.fromEntries(keys.map((k, i) => [k, pair(r[`l${i}`], r[`h${i}`])])),
      all: pair(r.lies, r.honest),
      total: (r.total as number | null) ?? null,
      ...(share && r.ok && { tokens: target }),
      ...(model && r.runId != null && { attempt: attemptPath({ id: r.runId as string }, r.ordinal as number) }),
    };
  });
}

/** True when a sample of the version has a failed reply, so that the "Most Failed" order means something. */
export async function anyFailedSample(versionId: string): Promise<boolean> {
  const row = await prisma.evalSample.findFirst({
    where: { evalVersionId: versionId, failed: { gt: 0 } },
    select: { id: true },
  });
  return !!row;
}

/** The summary of a reply that only staff or nobody can read. Null: none yet, or not needed. */
export async function replySummary(a: { id: string; hazard?: Hazard | null }): Promise<string | null> {
  if (a.hazard !== 'restricted' && a.hazard !== 'withheld') return null;
  const row = await prisma.replySummary.findUnique({ where: { attemptId: a.id }, select: { summary: true } });
  return row?.summary ?? null;
}

async function readTranscript(key: string): Promise<Transcript | null> {
  const res = await r2Get(key);
  if (!res.ok) return null;
  return (await res.json()) as Transcript;
}

export type { EvalRun };
