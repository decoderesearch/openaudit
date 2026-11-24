// The daily cron asks the web app to send the update email. The web app does the work; a second
// call on the same day does nothing there.

/** 15:00 UTC: morning in the US, afternoon in Europe. Also in `triggers` in wrangler.jsonc (staging). */
export const DIGEST_CRON = '0 15 * * *';

type DigestEnv = { OPENAUDIT_URL?: string; RUNNER_NOTIFY_TOKEN?: string };

/** The web reply, or `skipped` when this Worker has no web URL or token. */
export async function postDigest(
  env: DigestEnv,
  fetcher: typeof fetch = fetch,
): Promise<{ status: number; body: string } | 'skipped'> {
  if (!env.OPENAUDIT_URL || !env.RUNNER_NOTIFY_TOKEN) return 'skipped';
  const res = await fetcher(`${env.OPENAUDIT_URL.replace(/\/$/, '')}/api/runner/digest`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RUNNER_NOTIFY_TOKEN}` },
    signal: AbortSignal.timeout(60_000),
  });
  return { status: res.status, body: (await res.text()).slice(0, 1000) };
}
