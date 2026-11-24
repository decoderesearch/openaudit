import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  topics: { list: vi.fn() },
  segments: { list: vi.fn() },
  contacts: {
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    topics: { list: vi.fn(), update: vi.fn() },
    segments: { list: vi.fn(), add: vi.fn(), remove: vi.fn() },
  },
}));
vi.mock('resend', () => ({
  Resend: class {
    topics = api.topics;
    segments = api.segments;
    contacts = api.contacts;
  },
}));
vi.mock('@/lib/env', async (actual) => ({
  ...(await actual()),
  RESEND_API_KEY: 're_test',
  BETTER_AUTH_SECRET: 'test-secret',
}));

import {
  blockUpdates,
  confirmToken,
  getSubscription,
  readConfirmToken,
  readUnsubscribeToken,
  segmentFor,
  setSubscription,
  syncSegments,
  unsubscribeToken,
  updatesBlocked,
} from './updates';

const ok = <T>(data: T) => Promise.resolve({ data, error: null });
const T = { incidents: 'topic-inc', evals: 'topic-ev' };
const S = { inc: 'seg-inc', ev: 'seg-ev', both: 'seg-both', other: 'seg-other' };

beforeEach(() => {
  api.topics.list.mockImplementation(() =>
    ok({
      data: [
        { id: T.incidents, name: 'Safety Incidents' },
        { id: T.evals, name: 'New Eval Results' },
      ],
    }),
  );
  api.segments.list.mockImplementation(() =>
    ok({
      data: [
        { id: S.inc, name: 'Updates: Safety Incidents' },
        { id: S.ev, name: 'Updates: New Eval Results' },
        { id: S.both, name: 'Updates: Both' },
      ],
    }),
  );
  for (const f of [
    api.contacts.update,
    api.contacts.topics.update,
    api.contacts.segments.add,
    api.contacts.segments.remove,
  ])
    f.mockImplementation(() => ok({}));
});
afterEach(() => vi.clearAllMocks());

describe('segmentFor', () => {
  it('gives the Segment for each mix, in any order', () => {
    expect(segmentFor(['incidents'])).toBe('Updates: Safety Incidents');
    expect(segmentFor(['evals'])).toBe('Updates: New Eval Results');
    expect(segmentFor(['evals', 'incidents'])).toBe('Updates: Both');
    expect(segmentFor([])).toBeNull();
  });
});

describe('confirm tokens', () => {
  const req = { email: 'ana@example.com', lists: ['incidents', 'evals'] as const };

  it('reads back what it signed', async () => {
    const t = await confirmToken({ ...req, lists: [...req.lists] });
    expect(await readConfirmToken(t)).toEqual({ email: req.email, lists: ['incidents', 'evals'] });
  });

  it('refuses a changed or expired token', async () => {
    const t = await confirmToken({ ...req, lists: ['incidents'] }, 0);
    expect(await readConfirmToken(t, 8 * 864e5)).toBeNull();
    const fresh = await confirmToken({ ...req, lists: ['incidents'] });
    const [body, sig] = fresh.split('.');
    const forged = btoa(JSON.stringify({ e: 'eve@example.com', l: ['incidents'], x: Date.now() + 1e6 }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(await readConfirmToken(`${forged}.${sig}`)).toBeNull();
    expect(await readConfirmToken(`${body}.${sig!.slice(0, -2)}xx`)).toBeNull();
    expect(await readConfirmToken('junk')).toBeNull();
  });
});

describe('unsubscribe tokens', () => {
  it('reads back the address, and refuses a changed token or a confirm token', async () => {
    const t = await unsubscribeToken('ana@example.com');
    expect(await readUnsubscribeToken(t)).toBe('ana@example.com');
    const [body, sig] = t.split('.');
    expect(await readUnsubscribeToken(`${body}.${sig!.slice(0, -2)}xx`)).toBeNull();
    const c = await confirmToken({ email: 'ana@example.com', lists: ['incidents'] });
    expect(await readUnsubscribeToken(c)).toBeNull();
    expect(await readConfirmToken(t)).toBeNull();
    expect(await readUnsubscribeToken('junk')).toBeNull();
  });
});

describe('blockUpdates', () => {
  it('makes an unsubscribed contact for a new address', async () => {
    api.contacts.get.mockImplementation(() =>
      Promise.resolve({ data: null, error: { name: 'not_found', message: 'x' } }),
    );
    api.contacts.create.mockImplementation(() => ok({ id: 'new' }));
    await blockUpdates('ana@example.com');
    expect(api.contacts.create).toHaveBeenCalledWith({ email: 'ana@example.com', unsubscribed: true });
  });

  it('unsubscribes a contact, opts it out of all lists and removes its Segments', async () => {
    api.contacts.get.mockImplementation(() => ok({ id: 'c1', unsubscribed: false }));
    api.contacts.segments.list.mockImplementation(() => ok({ data: [{ id: S.both }] }));
    await blockUpdates('ana@example.com');
    expect(api.contacts.update).toHaveBeenCalledWith({ id: 'c1', unsubscribed: true });
    expect(api.contacts.topics.update).toHaveBeenCalledWith({
      id: 'c1',
      topics: [
        { id: T.incidents, subscription: 'opt_out' },
        { id: T.evals, subscription: 'opt_out' },
      ],
    });
    expect(api.contacts.segments.remove).toHaveBeenCalledWith({ contactId: 'c1', segmentId: S.both });
  });

  it('updatesBlocked is true only for an unsubscribed contact', async () => {
    api.contacts.get.mockImplementation(() => ok({ id: 'c1', unsubscribed: true }));
    expect(await updatesBlocked('ana@example.com')).toBe(true);
    api.contacts.get.mockImplementation(() => ok({ id: 'c1', unsubscribed: false }));
    expect(await updatesBlocked('ana@example.com')).toBe(false);
  });
});

describe('syncSegments', () => {
  it('moves the contact to the Segment of its lists only', async () => {
    api.contacts.segments.list.mockImplementation(() => ok({ data: [{ id: S.inc }, { id: S.other }] }));
    await syncSegments('c1', ['incidents', 'evals']);
    expect(api.contacts.segments.remove).toHaveBeenCalledExactlyOnceWith({ contactId: 'c1', segmentId: S.inc });
    expect(api.contacts.segments.add).toHaveBeenCalledExactlyOnceWith({ contactId: 'c1', segmentId: S.both });
  });

  it('reads the Topics when no lists are given, and removes a contact with none', async () => {
    api.contacts.topics.list.mockImplementation(() =>
      ok({
        data: [
          { id: T.incidents, subscription: 'opt_out' },
          { id: T.evals, subscription: 'opt_out' },
        ],
      }),
    );
    api.contacts.segments.list.mockImplementation(() => ok({ data: [{ id: S.ev }] }));
    await syncSegments('c1');
    expect(api.contacts.segments.remove).toHaveBeenCalledExactlyOnceWith({ contactId: 'c1', segmentId: S.ev });
    expect(api.contacts.segments.add).not.toHaveBeenCalled();
  });
});

describe('setSubscription', () => {
  it('makes a contact with the Topics and its Segment', async () => {
    api.contacts.get.mockImplementation(() =>
      Promise.resolve({ data: null, error: { name: 'not_found', message: 'x' } }),
    );
    api.contacts.create.mockImplementation(() => ok({ id: 'new' }));
    api.contacts.segments.list.mockImplementation(() => ok({ data: [] }));
    await setSubscription('ana@example.com', ['evals']);
    expect(api.contacts.create).toHaveBeenCalledWith({
      email: 'ana@example.com',
      unsubscribed: false,
      topics: [
        { id: T.incidents, subscription: 'opt_out' },
        { id: T.evals, subscription: 'opt_in' },
      ],
    });
    expect(api.contacts.segments.add).toHaveBeenCalledWith({ contactId: 'new', segmentId: S.ev });
  });

  it('ends an unsubscribe-from-all when lists are given again', async () => {
    api.contacts.get.mockImplementation(() => ok({ id: 'c1', unsubscribed: true }));
    api.contacts.segments.list.mockImplementation(() => ok({ data: [] }));
    await setSubscription('ana@example.com', ['incidents']);
    expect(api.contacts.update).toHaveBeenCalledWith({ id: 'c1', unsubscribed: false });
    expect(api.contacts.topics.update).toHaveBeenCalled();
  });

  it('makes no contact for no lists', async () => {
    api.contacts.get.mockImplementation(() =>
      Promise.resolve({ data: null, error: { name: 'not_found', message: 'x' } }),
    );
    await setSubscription('ana@example.com', []);
    expect(api.contacts.create).not.toHaveBeenCalled();
  });
});

describe('getSubscription', () => {
  it('gives no lists to an unsubscribed contact', async () => {
    api.contacts.get.mockImplementation(() => ok({ id: 'c1', unsubscribed: true }));
    expect(await getSubscription('ana@example.com')).toEqual({ lists: [], contactId: 'c1' });
  });

  it('gives the opted-in lists', async () => {
    api.contacts.get.mockImplementation(() => ok({ id: 'c1', unsubscribed: false }));
    api.contacts.topics.list.mockImplementation(() => ok({ data: [{ id: T.evals, subscription: 'opt_in' }] }));
    expect(await getSubscription('ana@example.com')).toEqual({ lists: ['evals'], contactId: 'c1' });
  });
});
