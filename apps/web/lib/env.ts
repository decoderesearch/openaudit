// Every environment variable the app reads, in one place. `NEXT_PUBLIC_*` values are inlined
// into the client bundle; everything else is server-only.

export const NEXT_PUBLIC_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3300';

// The browser posts J-Lens shares here (see lib/jlens.ts).
export const NEXT_PUBLIC_NEURONPEDIA_URL = process.env.NEXT_PUBLIC_NEURONPEDIA_URL || 'https://www.neuronpedia.org';

export const SITE_NAME = 'OpenAudit';
export const SITE_TAGLINE = 'Independent Evaluations of AI Models, Organizations, and Safety Methods';
export const SUPPORT_EMAIL = 'support@openaudit.com';
export const TWITTER_URL = 'https://twitter.com/OpenAuditCom';
export const LAUNCH_POST_URL = 'https://www.lesswrong.com/posts/AZmwgxBFvCjf2t37i';

// Auth
export const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || '';
export const BETTER_AUTH_URL = process.env.BETTER_AUTH_URL || NEXT_PUBLIC_URL;

// Origins the browser may call the auth API from: the public URL, its `www.` twin, and the
// Vercel preview and production hostnames. In development, also localhost.
export const TRUSTED_ORIGINS: string[] = (() => {
  const set = new Set<string>();
  if (process.env.NODE_ENV === 'development') set.add('http://localhost:3300');
  for (const raw of [NEXT_PUBLIC_URL, BETTER_AUTH_URL]) {
    try {
      const u = new URL(raw);
      set.add(u.origin);
      const host = u.hostname.startsWith('www.') ? u.hostname.slice(4) : `www.${u.hostname}`;
      set.add(`${u.protocol}//${host}${u.port ? `:${u.port}` : ''}`);
    } catch {
      // Better Auth reports a malformed URL at startup.
    }
  }
  return [...set];
})();

// Email. With no Resend key, every email prints to the server console. Tests never send.
export const RESEND_API_KEY = process.env.NODE_ENV === 'test' ? '' : process.env.RESEND_API_KEY || '';
export const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || 'OpenAudit <login@mail.openaudit.com>';
// Where replies to any email go.
export const REPLY_TO_ADDRESS = process.env.REPLY_TO_ADDRESS || SUPPORT_EMAIL;

// Sign-in emails the site sends per day, at most. At the cap, sign-in email stops and admins
// get one alert. See lib/server/email-limits.ts.
export const SIGN_IN_EMAILS_PER_DAY = Number(process.env.SIGN_IN_EMAILS_PER_DAY) || 300;

// Cloudflare Turnstile on sign-in. On only when both keys are set.
export const TURNSTILE_SITE_KEY = process.env.CLOUDFLARE_TURNSTILE_SITEKEY || '';
export const TURNSTILE_SECRET_KEY = process.env.CLOUDFLARE_TURNSTILE_SECRETKEY || '';
export const TURNSTILE_ENABLED = Boolean(TURNSTILE_SITE_KEY && TURNSTILE_SECRET_KEY);
// Cloudflare's test secrets (`1x…AA` and the others) answer without our action name.
export const TURNSTILE_TEST_SECRET = /^[123]x0+AA$/.test(TURNSTILE_SECRET_KEY);

// Emails that get the `admin` role on first sign-in. Comma separated.
export const BOOTSTRAP_ADMIN_EMAILS = (process.env.BOOTSTRAP_ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// The site assistant is on only when OPENAUDIT_ASK is "1". Off: no launcher, and /api/ask returns
// 404. Server only: client code gets it as a prop.
export const ASK_ENABLED = process.env.OPENAUDIT_ASK === '1';
// Sign-in is on only when OPENAUDIT_SIGN_IN is "1". Off: nobody is signed in, and the sign-in
// pages and auth routes return 404. Server only: client code gets it as a prop.
export const SIGN_IN_ENABLED = process.env.OPENAUDIT_SIGN_IN === '1';
// The site assistant (/api/ask). Without a key it answers that it is not set up. Its model is the
// `site_assistant` role in spec/model-ladders.yaml; ANTHROPIC_MODEL replaces it.
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || '';
// Questions per day: for all readers together, and for one IP.
export const ASK_GLOBAL_DAILY = Number(process.env.ASK_GLOBAL_DAILY) || 2000;
export const ASK_DAILY_PER_IP = Number(process.env.ASK_DAILY_PER_IP) || 100;

// The Run button on model pages. Only a signed-in admin can use it (`PUBLIC_RUNS_ENABLED`).
// Run pages show either way.
export const RUNS_ENABLED = process.env.OPENAUDIT_RUNS === '1';
// Runs for viewers who are not admins: moderator runs and requests. Off: only a
// signed-in admin can start runs, and the others see no run controls.
export const PUBLIC_RUNS_ENABLED = false;
// The runner sends it to POST /api/runner/notify when a run ends. Unset: the endpoint refuses all.
export const RUNNER_NOTIFY_TOKEN = process.env.RUNNER_NOTIFY_TOKEN || '';

// Cloudflare R2 through its S3 API: saved copies of documents and run logs. Without it, no file is served.
export const R2 = (() => {
  const endpoint = process.env.R2_S3_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  return endpoint && accessKeyId && secretAccessKey
    ? {
        endpoint: endpoint.replace(/\/$/, ''),
        accessKeyId,
        secretAccessKey,
        bucket: process.env.R2_BUCKET || 'openaudit',
      }
    : null;
})();
