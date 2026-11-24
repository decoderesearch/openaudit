import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  orgIncident: { findMany: vi.fn() },
  orgIncidentEvent: { findMany: vi.fn() },
  orgDeparture: { findMany: vi.fn() },
  evalRun: { findMany: vi.fn() },
  openAuditCardVersion: { findMany: vi.fn() },
  document: { findMany: vi.fn() },
  updateDigest: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
}));
const broadcasts = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@/lib/db', () => ({ prisma: db }));
vi.mock('@/lib/env', async (actual) => ({ ...(await actual()), NEXT_PUBLIC_URL: 'https://oa.test' }));
vi.mock('@/lib/server/updates', async (actual) => ({
  ...(await actual()),
  resend: () => ({ broadcasts }),
  resendIds: async () => ({
    topics: { incidents: 'topic-inc', evals: 'topic-ev' },
    segments: {
      'Updates: Safety Incidents': 'seg-inc',
      'Updates: New Eval Results': 'seg-ev',
      'Updates: Both': 'seg-both',
    },
  }),
}));

import { Prisma } from '#prisma';
import { collectUpdates, renderDigest, runDigest, type Updates } from './update-digest';

const org = { slug: 'acme', displayName: 'Acme AI' };
const model = { name: 'acme/m1', displayName: 'M1' };
const since = new Date('2026-10-03T15:00:00Z');
const now = new Date('2026-10-04T15:00:00Z');

function none() {
  for (const t of [
    'orgIncident',
    'orgIncidentEvent',
    'orgDeparture',
    'evalRun',
    'openAuditCardVersion',
    'document',
  ] as const)
    db[t].findMany.mockResolvedValue([]);
}

beforeEach(() => {
  none();
  db.updateDigest.findFirst.mockResolvedValue({ since });
  db.updateDigest.findMany.mockResolvedValue([]);
  db.updateDigest.create.mockResolvedValue({ id: 'd1' });
  broadcasts.create.mockImplementation(async (b: { segmentId: string }) => ({
    data: { id: `b-${b.segmentId}` },
    error: null,
  }));
});
afterEach(() => vi.clearAllMocks());

describe('collectUpdates', () => {
  it('groups runs by model and leaves out test runs with a sample limit', async () => {
    db.evalRun.findMany.mockResolvedValue([
      { id: 'r1', settings: {}, model, eval: { displayName: 'StrongREJECT' } },
      { id: 'r2', settings: { limit: 5 }, model, eval: { displayName: 'XSTest' } },
      { id: 'r3', settings: {}, model, eval: { displayName: 'StrongREJECT' } },
    ]);
    const u = await collectUpdates(since, now);
    expect(u.evals[0]!.items).toEqual([
      { keys: ['run:r1', 'run:r3'], text: 'M1: 2 runs', href: '/acme/m1', note: 'StrongREJECT' },
    ]);
    const where = db.evalRun.findMany.mock.calls[0]![0].where;
    expect(where).toMatchObject({ status: 'succeeded', visibility: 'public', origin: { not: 'rescore' } });
    expect(where.finishedAt).toEqual({ gt: since, lte: now });
  });

  it('leaves out items an earlier email had', async () => {
    db.orgDeparture.findMany.mockResolvedValue([
      { id: 'd1', name: 'Ana', title: 'CTO', organization: org },
      { id: 'd2', name: 'Bo', title: null, organization: org },
    ]);
    const u = await collectUpdates(since, now, new Set(['departure:d1']));
    expect(u.incidents[2]!.items).toEqual([{ keys: ['departure:d2'], text: 'Bo left Acme AI', href: '/acme' }]);
  });

  it('shows an event as an update only when its incident is not new in this email', async () => {
    db.orgIncident.findMany.mockResolvedValue([
      { id: 'i1', slug: 'leak', title: 'Leak', severity: 'red', events: [], organization: org },
    ]);
    const incident = (id: string) => ({ id, slug: `${id}-slug`, title: id, organization: org });
    db.orgIncidentEvent.findMany.mockResolvedValue([
      { id: 'e1', title: 'Found', incident: incident('i1') },
      { id: 'e2', title: 'Fixed', incident: incident('old') },
    ]);
    const u = await collectUpdates(since, now);
    expect(u.incidents[0]!.items[0]).toMatchObject({
      text: 'Acme AI: Leak',
      note: 'Serious',
      href: '/acme/incidents/leak',
    });
    expect(u.incidents[1]!.items).toMatchObject([{ keys: ['event:e2'], href: '/acme/incidents/old-slug' }]);
  });

  it('takes only published card versions, by the time of review', async () => {
    await collectUpdates(since, now);
    expect(db.openAuditCardVersion.findMany.mock.calls[0]![0].where).toEqual({
      status: 'published',
      reviewedAt: { gt: since, lte: now },
    });
  });
});

const empty = (): Updates => ({
  incidents: [{ title: 'New incidents', one: 'new incident', many: 'new incidents', items: [] }],
  evals: [{ title: 'New eval runs on OpenAudit', one: 'model with new runs', many: 'models with new runs', items: [] }],
});

describe('renderDigest', () => {
  it('gives no email when its lists have nothing new', () => {
    const u = empty();
    u.evals[0]!.items.push({ keys: ['run:1'], text: 'M1: 1 run', href: '/acme/m1' });
    expect(renderDigest(u, ['incidents'], '2026-10-04')).toBeNull();
  });

  it('shows only lists with news, caps each section, and has the unsubscribe link', () => {
    const u = empty();
    for (let i = 0; i < 13; i++) u.evals[0]!.items.push({ keys: [`run:${i}`], text: `Model <${i}>`, href: `/m/${i}` });
    const e = renderDigest(u, ['incidents', 'evals'], '2026-10-04')!;
    expect(e.subject).toBe('OpenAudit updates, Oct 4: 13 models with new runs');
    expect(e.html).not.toContain('Safety Incidents');
    expect(e.html).toContain('Model &lt;9&gt;');
    expect(e.html).not.toContain('Model &lt;10&gt;');
    expect(e.html).toContain('and 3 more');
    expect(e.html).toContain('href="https://oa.test/m/0"');
    expect(e.html).toContain('{{{RESEND_UNSUBSCRIBE_URL}}}');
    expect(e.text).toContain('{{{RESEND_UNSUBSCRIBE_URL}}}');
  });
});

describe('runDigest', () => {
  const withIncident = () =>
    db.orgIncident.findMany.mockResolvedValue([
      { id: 'i1', title: 'Leak', severity: 'red', sources: [], events: [], organization: org },
    ]);

  it('only previews when not sending', async () => {
    withIncident();
    const r = await runDigest({ now, send: false });
    expect(r.outcome).toBe('preview');
    expect(r.emails.map((e) => e.segment)).toEqual(['Updates: Safety Incidents', 'Updates: Both']);
    expect(db.updateDigest.create).not.toHaveBeenCalled();
    expect(broadcasts.create).not.toHaveBeenCalled();
  });

  it('sends one Broadcast per Segment with news, and saves the items', async () => {
    withIncident();
    const r = await runDigest({ now, send: true });
    expect(r.outcome).toBe('sent');
    expect(db.updateDigest.create.mock.calls[0]![0].data).toMatchObject({
      day: '2026-10-04',
      since,
      until: now,
      items: ['incident:i1'],
    });
    const sent = broadcasts.create.mock.calls.map((c) => c[0]);
    expect(sent.map((b) => [b.segmentId, b.topicId, b.send])).toEqual([
      ['seg-inc', 'topic-inc', true],
      ['seg-both', undefined, true],
    ]);
    expect(db.updateDigest.update.mock.calls[0]![0].data).toMatchObject({
      broadcasts: { 'Updates: Safety Incidents': 'b-seg-inc', 'Updates: Both': 'b-seg-both' },
    });
  });

  it('starts a day ago when no email went out before, and at most 14 days ago after', async () => {
    db.updateDigest.findFirst.mockResolvedValue(null);
    expect((await runDigest({ now, send: false })).since).toEqual(new Date(now.getTime() - 864e5));
    db.updateDigest.findFirst.mockResolvedValue({ since: new Date('2026-01-01T00:00:00Z') });
    expect((await runDigest({ now, send: false })).since).toEqual(new Date(now.getTime() - 14 * 864e5));
  });

  it('leaves out items that a sent email had', async () => {
    withIncident();
    db.updateDigest.findMany.mockResolvedValue([{ items: ['incident:i1'] }]);
    const r = await runDigest({ now, send: false });
    expect(r.emails).toEqual([]);
  });

  it('sends nothing a second time on the same day', async () => {
    withIncident();
    db.updateDigest.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }),
    );
    db.updateDigest.updateMany.mockResolvedValue({ count: 0 });
    expect((await runDigest({ now, send: true })).outcome).toBe('already');
    expect(broadcasts.create).not.toHaveBeenCalled();
  });

  it('records the error and the Broadcasts sent before it', async () => {
    withIncident();
    broadcasts.create
      .mockResolvedValueOnce({ data: { id: 'b1' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'rate limit' } });
    await expect(runDigest({ now, send: true })).rejects.toThrow(/rate limit/);
    expect(db.updateDigest.update.mock.calls[0]![0].data).toMatchObject({
      broadcasts: { 'Updates: Safety Incidents': 'b1' },
      error: expect.stringContaining('rate limit'),
    });
  });
});
