// Starts a run (or the cards container) on Cloudflare Containers: one message to the run Queue,
// through the Cloudflare REST API, so it works from local dev and from the deployed site. The
// runner Worker reads the queue and starts the containers.

const API = 'https://api.cloudflare.com/client/v4';

/** Samples in a shard when the run does not set it. The same as SHARD_SIZE in the runner. */
const SHARD_SIZE = 50;
/** The most containers for one run. The runtime estimates use the same number. */
export const MAX_CONTAINERS = 4;

/** Containers for a run of `samples` samples: one for each shard, at most MAX_CONTAINERS. */
export function containersFor(samples: number | null | undefined, shardSize = SHARD_SIZE): number {
  if (!samples) return MAX_CONTAINERS;
  return Math.min(MAX_CONTAINERS, Math.max(1, Math.ceil(samples / shardSize)));
}

function queueConfig() {
  const accountId = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || '';
  const queueId = process.env.RUN_QUEUE_ID || '';
  // A token with only Queues write. The broad Cloudflare token must not be on the web server.
  const token = process.env.CLOUDFLARE_RUN_QUEUE_WRITE_TOKEN || '';
  return accountId && queueId && token ? { accountId, queueId, token } : null;
}

/** Sends one message. False (and a log line) when the queue is not set up or the send fails. */
async function send(body: object, what: string): Promise<boolean> {
  const config = queueConfig();
  if (!config) {
    console.warn(
      `${what} not queued: set RUN_QUEUE_ID, R2_ACCOUNT_ID (or CLOUDFLARE_ACCOUNT_ID) and CLOUDFLARE_RUN_QUEUE_WRITE_TOKEN.`,
    );
    return false;
  }
  try {
    const res = await fetch(`${API}/accounts/${config.accountId}/queues/${config.queueId}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ body, content_type: 'json' }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return true;
    console.error(`${what} not queued: Cloudflare Queues ${res.status} ${(await res.text()).slice(0, 300)}`);
  } catch (e) {
    console.error(`${what} not queued: ${e instanceof Error ? e.message : String(e)}`);
  }
  return false;
}

/** Sends the run to the queue. False when the queue is not set up or the send fails. */
export function enqueueRun(runId: string, containers: number): Promise<boolean> {
  return send({ runId, containers: Math.max(1, Math.floor(containers)) }, `Run ${runId}`);
}

/** Starts the cards container, which builds the cards that are stale or that an admin asked for. */
export function enqueueCards(): Promise<boolean> {
  return send({ kind: 'cards' }, 'Cards');
}
