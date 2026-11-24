import { Prisma } from '#prisma';
import { prisma } from '@/lib/db';
import { escapeHtml, frame, P, type EmailContent } from '@/lib/email/templates';
import { NEXT_PUBLIC_URL, REPLY_TO_ADDRESS, SITE_NAME } from '@/lib/env';
import { incidentPath, SEVERITY, storyUrl } from '@/lib/org-research';
import { organizationPath } from '@/lib/organizations';
import { cardPath, modelPath } from '@/lib/server/catalog';
import { MIXES, need, resend, resendIds, UPDATES_FROM } from '@/lib/server/updates';
import { UPDATE_LISTS, type UpdateList } from '@/lib/updates';
import type { IncidentSeverity } from '@openaudit/spec';

// The daily update email, in two lists: Safety Incidents and New Eval Results. Each Segment (a
// mix of lists) gets one Broadcast with only its lists; a list with nothing new is left out, and a
// Segment with nothing new gets no email.
//
// An item is new when it is from the last LOOKBACK_DAYS and no earlier email had it. The sync
// from dev keeps the dev times, so a time window alone would miss an item synced a day late.

/** Each section shows this many items, then a count of the rest. */
const SHOWN = 10;
const LOOKBACK_DAYS = 14;

/** Sends only where UPDATES_SEND=1 (production). Elsewhere the digest is a preview. */
export const updatesSendOn = () => process.env.UPDATES_SEND === '1';
/** The daily cron sends only with UPDATES_AUTO_SEND=1 too. Until then, an admin sends by hand. */
export const updatesAutoSendOn = () => updatesSendOn() && process.env.UPDATES_AUTO_SEND === '1';

/** `keys`: one for each row in the item ("run:<id>"). A model with new runs is one item. */
type Item = { keys: string[]; text: string; href: string; note?: string };
type Section = { title: string; one: string; many: string; items: Item[] };
export type Updates = Record<UpdateList, Section[]>;

const url = (path: string) => (path.startsWith('http') ? path : `${NEXT_PUBLIC_URL}${path}`);
const between = (from: Date, until: Date) => ({ gt: from, lte: until });

/** What we added in (from, until] that is not in `sent`. Only public, finished, published items. */
export async function collectUpdates(from: Date, until: Date, sent: ReadonlySet<string> = new Set()): Promise<Updates> {
  const org = { select: { slug: true, displayName: true } } as const;
  const [incidents, events, departures, runs, cards, docs] = await Promise.all([
    prisma.orgIncident.findMany({
      where: { createdAt: between(from, until) },
      select: {
        id: true,
        slug: true,
        title: true,
        severity: true,
        organization: org,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.orgIncidentEvent.findMany({
      where: { createdAt: between(from, until) },
      select: {
        id: true,
        title: true,
        incident: { select: { id: true, slug: true, title: true, organization: org } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.orgDeparture.findMany({
      where: { createdAt: between(from, until) },
      select: { id: true, name: true, title: true, sources: true, quoteUrl: true, organization: org },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.evalRun.findMany({
      where: {
        status: 'succeeded',
        visibility: 'public',
        model: { hidden: false },
        origin: { not: 'rescore' },
        finishedAt: between(from, until),
      },
      select: {
        id: true,
        settings: true,
        model: { select: { name: true, displayName: true } },
        eval: { select: { displayName: true } },
      },
      orderBy: { finishedAt: 'asc' },
    }),
    prisma.openAuditCardVersion.findMany({
      where: { status: 'published', reviewedAt: between(from, until) },
      select: { id: true, number: true, card: { select: { model: { select: { name: true, displayName: true } } } } },
      orderBy: { reviewedAt: 'asc' },
    }),
    prisma.document.findMany({
      where: { kind: 'system_card', createdAt: between(from, until) },
      select: {
        id: true,
        key: true,
        title: true,
        url: true,
        publisher: { select: { displayName: true } },
        models: { take: 1, select: { model: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  const fresh = <T extends { id: string }>(rows: T[], kind: string) =>
    rows.filter((r) => !sent.has(`${kind}:${r.id}`)).map((r) => ({ ...r, key: `${kind}:${r.id}` }));

  // A run with a sample limit is a test, not a result.
  const byModel = new Map<string, { name: string; displayName: string; evals: string[]; keys: string[] }>();
  for (const r of fresh(runs, 'run')) {
    if (typeof (r.settings as { limit?: unknown } | null)?.limit === 'number') continue;
    const m = byModel.get(r.model.name) ?? { ...r.model, evals: [], keys: [] };
    m.evals.push(r.eval.displayName);
    m.keys.push(r.key);
    byModel.set(r.model.name, m);
  }
  const newIncidents = fresh(incidents, 'incident');
  // A new incident shows its events itself.
  const shown = new Set(newIncidents.map((i) => i.id));

  return {
    incidents: [
      {
        title: 'New incidents',
        one: 'new incident',
        many: 'new incidents',
        items: newIncidents.map((i) => ({
          keys: [i.key],
          text: `${i.organization.displayName}: ${i.title}`,
          href: incidentPath(i.organization, i.slug),
          note: SEVERITY[i.severity as IncidentSeverity]?.label,
        })),
      },
      {
        title: 'Incident updates',
        one: 'incident update',
        many: 'incident updates',
        items: fresh(events, 'event')
          .filter((e) => !shown.has(e.incident.id))
          .map((e) => ({
            keys: [e.key],
            text: `${e.incident.organization.displayName}: ${e.incident.title}`,
            href: incidentPath(e.incident.organization, e.incident.slug),
            note: e.title,
          })),
      },
      {
        title: 'Notable departures',
        one: 'departure',
        many: 'departures',
        items: fresh(departures, 'departure').map((d) => ({
          keys: [d.key],
          text: `${d.name} left ${d.organization.displayName}`,
          href: storyUrl(d.sources) ?? d.quoteUrl ?? organizationPath(d.organization),
          note: d.title ?? undefined,
        })),
      },
    ],
    evals: [
      {
        title: 'New eval runs on OpenAudit',
        one: 'model with new runs',
        many: 'models with new runs',
        items: [...byModel.values()].map((m) => ({
          keys: m.keys,
          text: `${m.displayName}: ${m.evals.length} ${m.evals.length === 1 ? 'run' : 'runs'}`,
          href: modelPath(m),
          note: [...new Set(m.evals)].join(', '),
        })),
      },
      {
        title: 'New OpenAudit Card versions',
        one: 'OpenAudit Card update',
        many: 'OpenAudit Card updates',
        items: fresh(cards, 'card').map((c) => ({
          keys: [c.key],
          text: `${c.card.model.displayName}, version ${c.number}`,
          // The model page shows its latest OpenAudit Card.
          href: modelPath(c.card.model),
        })),
      },
      {
        title: 'New system cards',
        one: 'system card',
        many: 'system cards',
        items: fresh(docs, 'document').map((d) => ({
          keys: [d.key],
          text: `${d.publisher.displayName}: ${d.title}`,
          href: d.models[0] ? cardPath(d.models[0].model, d.key) : d.url,
        })),
      },
    ],
  };
}

const sections = (u: Updates, lists: readonly UpdateList[]) =>
  UPDATE_LISTS.filter((l) => lists.includes(l.id)).flatMap((l) => u[l.id]);

export const counts = (u: Updates): Record<string, number> =>
  Object.fromEntries(sections(u, ['incidents', 'evals']).map((s) => [s.title, s.items.length]));

/** The keys of all items in emails for `lists`. */
const keysOf = (u: Updates, lists: readonly UpdateList[]) =>
  sections(u, lists).flatMap((s) => s.items.flatMap((i) => i.keys));

// Resend puts each contact's own link in place of this tag.
const UNSUBSCRIBE = '{{{RESEND_UNSUBSCRIBE_URL}}}';

const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** The email for a Segment with `lists`, or null when none of them has anything new. */
export function renderDigest(updates: Updates, lists: readonly UpdateList[], day: string): EmailContent | null {
  const parts = UPDATE_LISTS.filter((l) => lists.includes(l.id) && updates[l.id].some((s) => s.items.length));
  if (!parts.length) return null;
  const html: string[] = [];
  const text: string[] = [];
  for (const list of parts) {
    html.push(`<h3 style="color:#0f172a;font-size:16px;margin:20px 0 8px">${escapeHtml(list.label)}</h3>`);
    text.push(`== ${list.label} ==`);
    for (const s of updates[list.id].filter((x) => x.items.length)) {
      const shown = s.items.slice(0, SHOWN);
      const rest = s.items.length - shown.length;
      html.push(
        `<p style="${P};margin-bottom:4px;font-weight:600">${escapeHtml(s.title)}</p><ul style="${P};padding-left:18px">`,
      );
      text.push('', `${s.title}:`);
      for (const i of shown) {
        const note = i.note ? ` <span style="color:#64748b">· ${escapeHtml(i.note)}</span>` : '';
        html.push(
          `<li><a href="${escapeHtml(url(i.href))}" style="color:#0369a1">${escapeHtml(i.text)}</a>${note}</li>`,
        );
        text.push(`- ${i.text}${i.note ? ` · ${i.note}` : ''}: ${url(i.href)}`);
      }
      if (rest) {
        html.push(`<li style="color:#64748b">and ${rest} more on ${escapeHtml(SITE_NAME)}</li>`);
        text.push(`- and ${rest} more on ${SITE_NAME}`);
      }
      html.push('</ul>');
    }
    text.push('');
  }
  html.push(
    `<p style="${P};font-size:12px;color:#64748b">You get this because you subscribed on ${escapeHtml(SITE_NAME)}. <a href="${UNSUBSCRIBE}" style="color:#0369a1">Change your lists or unsubscribe</a>.</p>`,
  );
  text.push(`You get this because you subscribed on ${SITE_NAME}. Change your lists or unsubscribe: ${UNSUBSCRIBE}`);
  const said = sections(
    updates,
    parts.map((l) => l.id),
  )
    .filter((s) => s.items.length)
    .map((s) => `${s.items.length} ${s.items.length === 1 ? s.one : s.many}`);
  const summary = said.length > 3 ? `${said.slice(0, 3).join(', ')} and more` : said.join(', ');
  return {
    subject: `${SITE_NAME} updates, ${dayLabel(day)}: ${summary}`,
    html: frame(`${SITE_NAME} updates`, html.join('\n')),
    text: text.join('\n'),
  };
}

export type DigestEmail = { segment: string; lists: UpdateList[]; email: EmailContent };

export type DigestResult = {
  day: string;
  since: Date;
  until: Date;
  counts: Record<string, number>;
  emails: DigestEmail[];
  /** sent: Broadcasts went out. preview: not sent. already: today's digest exists. nothing: no news. */
  outcome: 'sent' | 'preview' | 'already' | 'nothing';
  broadcasts?: Record<string, string>;
};

/**
 * The start of the window, and the items earlier emails had. The window starts LOOKBACK_DAYS
 * ago, but not before the first email: at the start, only the last day is new.
 */
async function window(now: Date): Promise<{ since: Date; sent: Set<string> }> {
  const lookback = new Date(now.getTime() - LOOKBACK_DAYS * 864e5);
  const [first, recent] = await Promise.all([
    prisma.updateDigest.findFirst({ orderBy: { day: 'asc' }, select: { since: true } }),
    // An email that failed with no Broadcast sent nothing, so its items are still new.
    prisma.updateDigest.findMany({
      where: { until: { gt: lookback }, OR: [{ sentAt: { not: null } }, { NOT: { broadcasts: { equals: {} } } }] },
      select: { items: true },
    }),
  ]);
  const start = first?.since ?? new Date(now.getTime() - 864e5);
  return {
    since: start > lookback ? start : lookback,
    sent: new Set(recent.flatMap((d) => (Array.isArray(d.items) ? (d.items as string[]) : []))),
  };
}

/**
 * Makes today's digest and, with `send`, one Broadcast for each Segment with news. One digest a
 * day: a second call returns `already`. After a failure with no Broadcast sent, a call tries
 * again; after a failure part way, it does not, so nobody gets an email twice.
 */
export async function runDigest({ now = new Date(), send = updatesSendOn() } = {}): Promise<DigestResult> {
  const day = now.toISOString().slice(0, 10);
  const { since, sent } = await window(now);
  const updates = await collectUpdates(since, now, sent);
  const emails = MIXES.flatMap((m) => {
    const email = renderDigest(updates, m.lists, day);
    return email ? [{ segment: m.segment, lists: m.lists, email }] : [];
  });
  const base = { day, since, until: now, counts: counts(updates), emails };
  if (!send) return { ...base, outcome: 'preview' };

  const items = keysOf(updates, ['incidents', 'evals']);
  const row = await claim(day, { since, until: now, counts: base.counts, items });
  if (!row) return { ...base, outcome: 'already' };
  const broadcasts: Record<string, string> = {};
  try {
    if (emails.length) {
      const { segments, topics } = await resendIds();
      for (const e of emails) {
        const { id } = await need(
          resend().broadcasts.create({
            name: `Updates ${day}: ${e.segment}`,
            segmentId: segments[e.segment],
            // With one list, Resend also skips contacts that opted out of its Topic.
            topicId: e.lists.length === 1 ? topics[e.lists[0]] : undefined,
            from: UPDATES_FROM,
            replyTo: REPLY_TO_ADDRESS,
            subject: e.email.subject,
            html: e.email.html,
            text: e.email.text,
            send: true,
          }),
          'create broadcast',
        );
        broadcasts[e.segment] = id;
      }
    }
    await prisma.updateDigest.update({ where: { id: row }, data: { broadcasts, sentAt: new Date() } });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await prisma.updateDigest.update({ where: { id: row }, data: { broadcasts, error: error.slice(0, 2000) } });
    throw e;
  }
  return { ...base, outcome: emails.length ? 'sent' : 'nothing', broadcasts };
}

type Claim = { since: Date; until: Date; counts: Record<string, number>; items: string[] };

/** The row id for today's digest, or null when today has one already. */
async function claim(day: string, data: Claim): Promise<string | null> {
  try {
    return (await prisma.updateDigest.create({ data: { day, ...data }, select: { id: true } })).id;
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
  }
  const retry = await prisma.updateDigest.updateMany({
    where: { day, sentAt: null, error: { not: null }, broadcasts: { equals: {} } },
    data: { ...data, error: null },
  });
  if (!retry.count) return null;
  return (await prisma.updateDigest.findUniqueOrThrow({ where: { day }, select: { id: true } })).id;
}

/** The last digests, newest first, for the admin page. */
export function recentDigests(take = 14) {
  return prisma.updateDigest.findMany({ orderBy: { day: 'desc' }, take });
}
