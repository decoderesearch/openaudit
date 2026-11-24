import { afterEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  model: { findFirst: vi.fn() },
  openAuditCard: { findUnique: vi.fn(), upsert: vi.fn() },
  openAuditCardVersion: { findUnique: vi.fn(), updateMany: vi.fn() },
  emailLog: { create: vi.fn() },
}));
const mail = vi.hoisted(() => ({ admins: vi.fn(), deliver: vi.fn() }));
vi.mock('@/lib/db', () => ({ prisma: db }));
vi.mock('@/lib/env', async (actual) => ({ ...(await actual()), NEXT_PUBLIC_URL: 'https://oa.test' }));
vi.mock('@/lib/server/admins', () => ({ adminEmails: mail.admins }));
vi.mock('@/lib/server/run-emails', () => ({ deliver: mail.deliver }));
vi.mock('@/lib/server/openaudit-cards', () => ({
  openAuditPath: (m: { name: string }, v: number) => `/${m.name}?v=${v}`,
}));

import { cardDraftReady, discardCardVersion, publishCardVersion, requestCardRebuild } from './card-admin';

const MODEL = '0199a3b2-1c2d-7e3f-8a9b-0c1d2e3f4a5b';

describe('requestCardRebuild', () => {
  afterEach(() => vi.clearAllMocks());

  const update = () => db.openAuditCard.upsert.mock.calls[0]![0].update;

  it('refuses a model with no public finished run', async () => {
    db.model.findFirst.mockResolvedValue(null);
    expect(await requestCardRebuild(MODEL, false)).toBe(false);
    expect(db.openAuditCard.upsert).not.toHaveBeenCalled();
  });

  it('makes the card when there is none', async () => {
    db.model.findFirst.mockResolvedValue({ id: MODEL });
    db.openAuditCard.findUnique.mockResolvedValue(null);
    expect(await requestCardRebuild(MODEL, true)).toBe(true);
    const arg = db.openAuditCard.upsert.mock.calls[0]![0];
    expect(arg.create).toMatchObject({ modelId: MODEL, rebuildForce: true });
    expect(arg.create.rebuildAt).toBeInstanceOf(Date);
  });

  it('keeps a waiting force request, and ends the retry wait of a failed build', async () => {
    db.model.findFirst.mockResolvedValue({ id: MODEL });
    db.openAuditCard.findUnique.mockResolvedValue({ rebuildAt: new Date(), rebuildForce: true, leaseOwner: null });
    await requestCardRebuild(MODEL, false);
    expect(update()).toMatchObject({ rebuildForce: true, leaseExpiresAt: null });
  });

  it('keeps the lease of a build that runs now', async () => {
    db.model.findFirst.mockResolvedValue({ id: MODEL });
    db.openAuditCard.findUnique.mockResolvedValue({ rebuildAt: null, rebuildForce: true, leaseOwner: 'host:1:cards' });
    await requestCardRebuild(MODEL, false);
    expect(update().rebuildForce).toBe(false);
    expect(update()).not.toHaveProperty('leaseExpiresAt');
  });
});

const VERSION = '0199a3b2-1c2d-7e3f-8a9b-0c1d2e3f4a5c';

describe('publishCardVersion and discardCardVersion', () => {
  afterEach(() => vi.clearAllMocks());

  it('changes only a draft', async () => {
    db.openAuditCardVersion.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    expect(await publishCardVersion(VERSION)).toBe(true);
    expect(await discardCardVersion(VERSION)).toBe(false);
    const [first, second] = db.openAuditCardVersion.updateMany.mock.calls.map((c) => c[0]);
    expect(first.where).toEqual({ id: VERSION, status: 'draft' });
    expect(first.data.status).toBe('published');
    expect(first.data.reviewedAt).toBeInstanceOf(Date);
    expect(second.data.status).toBe('discarded');
  });
});

describe('cardDraftReady', () => {
  afterEach(() => vi.clearAllMocks());

  const draft = (over: Record<string, unknown> = {}) => ({
    number: 13,
    status: 'draft',
    createdAt: new Date(),
    costUsd: 0.31,
    emailedAt: null,
    _count: { runs: 21, snippets: 80 },
    card: { model: { name: 'Qwen/Qwen3.6-27B', displayName: 'Qwen3.6 27B' }, versions: [{ number: 12 }] },
    ...over,
  });

  it('is null for no such version, and sends nothing for a version that is not a draft or was emailed', async () => {
    db.openAuditCardVersion.findUnique.mockResolvedValueOnce(null);
    expect(await cardDraftReady(VERSION)).toBeNull();
    db.openAuditCardVersion.findUnique.mockResolvedValueOnce(draft({ status: 'published' }));
    expect(await cardDraftReady(VERSION)).toBe('not_draft');
    db.openAuditCardVersion.findUnique.mockResolvedValueOnce(draft({ emailedAt: new Date() }));
    expect(await cardDraftReady(VERSION)).toBe('already_sent');
    expect(mail.deliver).not.toHaveBeenCalled();
  });

  it('emails all admins once, with the preview link', async () => {
    db.openAuditCardVersion.findUnique.mockResolvedValue(draft());
    mail.admins.mockResolvedValue(['a@x.test', 'b@x.test']);
    db.openAuditCardVersion.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    mail.deliver.mockResolvedValue({ providerMessageId: 'm1', error: null });
    db.emailLog.create.mockResolvedValue({});
    expect(await cardDraftReady(VERSION)).toBe('sent');
    expect(await cardDraftReady(VERSION)).toBe('already_sent');
    expect(mail.deliver).toHaveBeenCalledTimes(1);
    const [to, type, content] = mail.deliver.mock.calls[0]!;
    expect(to).toEqual(['a@x.test', 'b@x.test']);
    expect(type).toBe('card_draft');
    expect(content.subject).toContain('Card draft ready: Qwen3.6 27B v13');
    expect(content.text).toContain('https://oa.test/Qwen/Qwen3.6-27B?v=13');
    expect(content.text).toContain('https://oa.test/admin/cards');
    expect(content.text).toContain('the public sees version 12');
    expect(db.openAuditCardVersion.updateMany.mock.calls[0]![0].where).toEqual({
      id: VERSION,
      status: 'draft',
      emailedAt: null,
    });
  });

  it('frees the claim after a failed send, so the runner tries again', async () => {
    db.openAuditCardVersion.findUnique.mockResolvedValue(draft());
    mail.admins.mockResolvedValue(['a@x.test']);
    db.openAuditCardVersion.updateMany.mockResolvedValue({ count: 1 });
    mail.deliver.mockResolvedValue({ providerMessageId: null, error: 'rate limited' });
    db.emailLog.create.mockResolvedValue({});
    expect(await cardDraftReady(VERSION)).toBe('failed');
    expect(db.openAuditCardVersion.updateMany.mock.calls[1]![0].data).toEqual({ emailedAt: null });
  });

  it('keeps the claim when the email went but the log failed', async () => {
    db.openAuditCardVersion.findUnique.mockResolvedValue(draft());
    mail.admins.mockResolvedValue(['a@x.test']);
    db.openAuditCardVersion.updateMany.mockResolvedValue({ count: 1 });
    mail.deliver.mockResolvedValue({ providerMessageId: 'm1', error: null });
    db.emailLog.create.mockRejectedValue(new Error('db down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await cardDraftReady(VERSION)).toBe('sent');
    expect(db.openAuditCardVersion.updateMany).toHaveBeenCalledTimes(1);
  });

  it('sends nothing when no admin address is set', async () => {
    db.openAuditCardVersion.findUnique.mockResolvedValue(draft());
    mail.admins.mockResolvedValue([]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await cardDraftReady(VERSION)).toBe('no_admins');
    expect(db.openAuditCardVersion.updateMany).not.toHaveBeenCalled();
  });
});
