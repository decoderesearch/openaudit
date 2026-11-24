// Makes the Resend Topics and Segments for the email update lists (lib/server/updates.ts). It
// does nothing that exists already. With no --apply, it only prints what it would do.
//
//   node scripts/with-env.mjs tsx scripts/updates-setup.ts [--apply] [--delete-segment NAME]
//     [--webhook https://openaudit.com --secret-file PATH]
//
// --delete-segment: deletes a Segment with no contacts (the plan allows only 3 Segments).
// --webhook: makes the webhook for the site and writes its signing secret to PATH (mode 600),
// for `wrangler secret put RESEND_WEBHOOK_SECRET`. It never prints the secret.
import { MIXES, WEBHOOK_EVENTS, WEBHOOK_PATH } from '@/lib/server/updates';
import { UPDATE_LISTS } from '@/lib/updates';
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { Resend } from 'resend';

const { values: args } = parseArgs({
  options: {
    apply: { type: 'boolean', default: false },
    'delete-segment': { type: 'string' },
    webhook: { type: 'string' },
    'secret-file': { type: 'string' },
  },
});

type Result<T> = { data: T | null; error: { message: string } | null };
async function need<T>(call: Promise<Result<T>>, what: string): Promise<T> {
  const { data, error } = await call;
  if (error || !data) throw new Error(`${what}: ${error?.message ?? 'no data'}`);
  return data;
}

// Resend allows 10 requests a second.
const pause = () => new Promise((r) => setTimeout(r, 150));

async function main() {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set.');
  if (args.webhook && !args['secret-file']) throw new Error('--webhook needs --secret-file.');
  const r = new Resend(process.env.RESEND_API_KEY);
  const act = async (text: string, fn: () => Promise<unknown>) => {
    console.log(`${args.apply ? '' : '(dry run) '}${text}`);
    if (args.apply) await fn();
    await pause();
  };

  const topics = (await need(r.topics.list(), 'list topics')).data;
  for (const l of UPDATE_LISTS) {
    if (topics.some((t) => t.name === l.label)) {
      console.log(`Topic "${l.label}" exists.`);
      continue;
    }
    await act(`Create Topic "${l.label}".`, () =>
      need(
        // Public: the preferences page shows each list, so a person can add the other list there.
        r.topics.create({
          name: l.label,
          description: l.description,
          defaultSubscription: 'opt_out',
          visibility: 'public',
        } as Parameters<typeof r.topics.create>[0]),
        'create topic',
      ),
    );
  }

  const segments = (await need(r.segments.list({ limit: 100 }), 'list segments')).data;
  const drop = args['delete-segment'] ? segments.find((x) => x.name === args['delete-segment']) : undefined;
  if (args['delete-segment'] && !drop) console.log(`Segment "${args['delete-segment']}" does not exist.`);
  if (drop) {
    const contacts = await need(r.contacts.list({ segmentId: drop.id, limit: 1 }), 'list contacts');
    if (contacts.data.length) throw new Error(`Segment "${drop.name}" has contacts. Not deleted.`);
  }
  const missing = MIXES.filter((m) => !segments.some((s) => s.name === m.segment));
  for (const m of MIXES) if (!missing.includes(m)) console.log(`Segment "${m.segment}" exists.`);
  // Resend cannot delete the last Segment, so one new Segment comes first.
  for (const [i, m] of missing.entries()) {
    if (drop && i === Math.min(1, missing.length))
      await act(`Delete empty Segment "${drop.name}".`, () => need(r.segments.remove(drop.id), 'delete segment'));
    await act(`Create Segment "${m.segment}".`, () => need(r.segments.create({ name: m.segment }), 'create segment'));
  }
  if (drop && missing.length < 2)
    await act(`Delete empty Segment "${drop.name}".`, () => need(r.segments.remove(drop.id), 'delete segment'));

  if (args.webhook) {
    const endpoint = `${args.webhook.replace(/\/$/, '')}${WEBHOOK_PATH}`;
    const hooks = (await need(r.webhooks.list(), 'list webhooks')).data;
    if (hooks.some((h) => h.endpoint === endpoint)) console.log(`Webhook for ${endpoint} exists.`);
    else
      await act(`Create webhook for ${endpoint} (${WEBHOOK_EVENTS.join(', ')}).`, async () => {
        const hook = await need(
          r.webhooks.create({ endpoint, events: [...WEBHOOK_EVENTS] as never }),
          'create webhook',
        );
        writeFileSync(args['secret-file']!, hook.signing_secret, { mode: 0o600 });
        console.log(`Wrote the signing secret to ${args['secret-file']}.`);
      });
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
