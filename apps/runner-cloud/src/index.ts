import { Container } from '@cloudflare/containers';
import * as Sentry from '@sentry/cloudflare';
import {
  CARDS_DELAY_SECONDS,
  CARDS_NAME,
  instanceName,
  isCards,
  isStandby,
  parseMessage,
  START_RETRIES,
  startRetryDelay,
  type CardsMessage,
  type QueueMessage,
} from './queue';
import { DIGEST_CRON, postDigest } from './digest';
import { afterStop, beginLaunch, MAX_LIFETIME_MS, newJob, restartDue, type Job } from './restarts';
import { authorized, cardsToken, EXPIRES_SECONDS, parseRequest, presign, runToken, SignError } from './sign';

// The runner: a Queue consumer starts Container instances for a run, and `/r2/sign` gives the
// containers pre-signed R2 URLs. On staging, when a run container stops and each hour, the cards
// container builds the stale OpenAudit Cards, and a daily cron calls the update email.

export interface Env {
  RUNNER: DurableObjectNamespace<RunnerContainer>;
  RUNS: Queue<QueueMessage>;
  // The URL of `/r2/sign` on this Worker.
  SIGN_URL: string;
  RUNNER_TOKEN: string;
  RUNNER_DATABASE_URL: string;
  OPENROUTER_API_KEY: string;
  HF_TOKEN?: string;
  OPENAUDIT_URL?: string;
  RUNNER_NOTIFY_TOKEN?: string;
  R2_S3_ENDPOINT: string;
  R2_BUCKET: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  // Only the production Worker has it. The containers get it too.
  SENTRY_DSN?: string;
  // `off`: no cards message and no cards container (production).
  CARDS?: string;
}

const RUNNER = ['tini', '-g', '--', 'openaudit-runner'];
const CARDS_ARGS = ['cards', 'drain'];

function log(event: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({ event, ...data }));
}

const runIdOf = (job: Job) => (isCards(job) ? null : job.runId);

export class RunnerContainer extends Container<Env> {
  // The runner serves no port. The activity check only enforces MAX_LIFETIME_MS.
  sleepAfter = '1m';
  enableInternet = true;

  /** The stored job. A job in an old format, with no counts, is ignored. */
  private async loadJob(): Promise<Job | undefined> {
    const job = await this.ctx.storage.get<Job>('job');
    return typeof job?.launches === 'number' ? job : undefined;
  }

  /** Starts the container for the job, if it is not running. A message seen before does nothing. */
  async run(message: QueueMessage, name: string, messageId: string): Promise<'started' | 'running' | 'seen'> {
    const old = await this.loadJob();
    if (old?.messageId === messageId) return 'seen';
    const { status } = await this.getState();
    if (status === 'running' || status === 'healthy' || status === 'stopping') return 'running';
    if (old?.restartAt && !old.done) return 'running';
    try {
      await this.launch(newJob(message, name, messageId, Date.now()));
    } catch (e) {
      // The next try of this message must start the container again.
      if (old) await this.ctx.storage.put('job', old);
      else await this.ctx.storage.delete('job');
      throw e;
    }
    return 'started';
  }

  /** Counts the start in storage first, so a failed start also counts. */
  private async launch(current: Job) {
    const job = beginLaunch(current);
    if (!job) {
      log('container_start_refused', { name: current.name, launches: current.launches, stops: current.stops });
      return;
    }
    await this.ctx.storage.put('job', job);
    const env = this.env;
    const envVars: Record<string, string> = {
      DATABASE_URL: env.RUNNER_DATABASE_URL,
      OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
      OPENAUDIT_R2_SIGN_URL: env.SIGN_URL,
    };
    // Run emails, the email to admins that a card draft is ready, and error reports.
    for (const name of ['OPENAUDIT_URL', 'RUNNER_NOTIFY_TOKEN', 'SENTRY_DSN'] as const) {
      if (env[name]) envVars[name] = env[name];
    }
    if (isCards(job)) {
      envVars.RUNNER_TOKEN = await cardsToken(env.RUNNER_TOKEN);
      await this.start({ envVars, entrypoint: [...RUNNER, ...CARDS_ARGS] });
      log('container_start', { name: job.name, launch: job.launches, args: CARDS_ARGS });
      return;
    }
    envVars.RUN_ID = job.runId;
    envVars.RUNNER_TOKEN = await runToken(env.RUNNER_TOKEN, job.runId);
    if (isStandby(job.name)) envVars.OPENAUDIT_STANDBY = '1';
    if (env.HF_TOKEN) envVars.HF_TOKEN = env.HF_TOKEN;
    await this.start({ envVars, ...(job.args ? { entrypoint: [...RUNNER, ...job.args] } : {}) });
    log('container_start', { name: job.name, runId: job.runId, launch: job.launches, args: job.args ?? null });
  }

  override async onActivityExpired() {
    const job = await this.loadJob();
    if (job && Date.now() - job.startedAt > MAX_LIFETIME_MS) {
      log('container_timeout', { name: job.name, runId: runIdOf(job) });
      await this.stop();
    }
  }

  override async onStop({ exitCode, reason }: { exitCode: number; reason: string }) {
    const job = await this.loadJob();
    if (!job) return;
    const next = afterStop(job, exitCode, Date.now());
    log(next.duplicate ? 'container_stop_duplicate' : 'container_stop', {
      name: job.name,
      runId: runIdOf(job),
      launch: job.launches,
      exitCode,
      reason,
      restart: next.restart,
    });
    if (next.duplicate) return;
    await this.ctx.storage.put('job', next.job);
    if (isCards(job) || this.env.CARDS === 'off') return;
    // A failed send must not stop the run's restarts; the hourly sweep builds the card later.
    try {
      await this.env.RUNS.send({ kind: 'cards' }, { delaySeconds: CARDS_DELAY_SECONDS });
    } catch (e) {
      log('cards_send_failed', { name: job.name, error: String(e) });
    }
  }

  // The library calls onStop from its alarm and then deletes the alarm. So the restart is here,
  // after the library alarm.
  override async alarm(props?: AlarmInvocationInfo) {
    await super.alarm(props);
    const job = await this.loadJob();
    const due = restartDue(job, Date.now());
    if (!job || due === 'no') return;
    if (due === 'wait') {
      if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(job.restartAt!);
      return;
    }
    const { status } = await this.getState();
    if (status !== 'stopped' && status !== 'stopped_with_code') return;
    await this.launch(job);
  }

  override onError(error: unknown) {
    log('container_error', { error: String(error) });
    throw error;
  }
}

async function sign(request: Request, env: Env): Promise<Response> {
  try {
    const body = parseRequest(await request.json().catch(() => null));
    if (!(await authorized(request.headers.get('authorization'), env.RUNNER_TOKEN, body.runId)))
      throw new SignError(401, 'Bad token.');
    const r2 = {
      endpoint: env.R2_S3_ENDPOINT,
      bucket: env.R2_BUCKET,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    };
    const urls = await presign(r2, body.items);
    return Response.json({ expiresIn: EXPIRES_SECONDS, urls });
  } catch (e) {
    if (e instanceof SignError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

const handler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/r2/sign' && request.method === 'POST') return sign(request, env);
    if (pathname === '/' && request.method === 'GET') return Response.json({ ok: true });
    return new Response('Not found', { status: 404 });
  },

  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      const message = parseMessage(msg.body);
      if (!message) {
        log('bad_message', { id: msg.id });
        msg.ack();
        continue;
      }
      if (isCards(message)) {
        if (env.CARDS === 'off') {
          log('cards_off', { id: msg.id });
          msg.ack();
          continue;
        }
        try {
          const state = await startCards(env, message, msg.id);
          log('cards_queued', { state });
          msg.ack();
        } catch (e) {
          log('cards_start_failed', { error: String(e), attempts: msg.attempts });
          msg.retry({ delaySeconds: 30 });
        }
        continue;
      }
      try {
        const names = Array.from({ length: message.containers }, (_, i) => instanceName(message.runId, i));
        const states = await Promise.all(
          names.map((name) => env.RUNNER.get(env.RUNNER.idFromName(name)).run(message, name, msg.id)),
        );
        log('run_queued', { runId: message.runId, containers: names.length, states });
        msg.ack();
      } catch (e) {
        const last = msg.attempts > START_RETRIES;
        if (last) Sentry.captureException(e);
        log(last ? 'run_start_gave_up' : 'run_start_failed', {
          runId: message.runId,
          error: String(e),
          attempts: msg.attempts,
        });
        if (last) msg.ack();
        else msg.retry({ delaySeconds: startRetryDelay(msg.attempts) });
      }
    }
  },

  // Staging only. The hourly sweep finds runs that sent no cards message: imports, and runs on
  // other hosts. The daily cron calls the update email.
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    if (controller.cron === DIGEST_CRON) {
      const result = await postDigest(env);
      log('digest_cron', { result });
      if (result !== 'skipped' && result.status >= 500) throw new Error(`digest: HTTP ${result.status}`);
      return;
    }
    if (env.CARDS === 'off') return;
    const state = await startCards(env, { kind: 'cards' }, `cron:${controller.scheduledTime}`);
    log('cards_cron', { state });
  },
} satisfies ExportedHandler<Env>;

/** Sentry is on only where `SENTRY_DSN` is set. It gets no headers, bodies, query values or queue messages. */
export default Sentry.withSentry(
  (env: Env) =>
    env.SENTRY_DSN
      ? {
          dsn: env.SENTRY_DSN,
          environment: 'production',
          dataCollection: {
            userInfo: false,
            cookies: false,
            httpHeaders: false,
            httpBodies: [],
            urlQueryParams: false,
            queues: false,
            stackFrameVariables: false,
          },
        }
      : undefined,
  handler,
);

/** One cards container at a time. A message while it runs does nothing: it builds until none is stale. */
function startCards(env: Env, message: CardsMessage, messageId: string) {
  return env.RUNNER.get(env.RUNNER.idFromName(CARDS_NAME)).run(message, CARDS_NAME, messageId);
}
