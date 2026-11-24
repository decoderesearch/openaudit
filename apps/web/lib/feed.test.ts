import { chatGroup, firstOfEachGroup, inTurns, openChatsFirst, shortCount } from '@/lib/feed';
import { describe, expect, it } from 'vitest';

describe('shortCount', () => {
  it('writes thousands as K, cut down, in at most 4 characters', () => {
    expect(shortCount(999)).toBe('999');
    expect(shortCount(1000)).toBe('1K');
    expect(shortCount(1499)).toBe('1.4K');
    expect(shortCount(1500)).toBe('1.5K');
    expect(shortCount(15_300)).toBe('15K');
  });
});

describe('inTurns', () => {
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id).join(' ');

  it('gives each key a turn in each block, and keeps the blocks in order', () => {
    const items = [
      { id: 'a1', key: 'ape', block: 'medium' },
      { id: 'a2', key: 'ape', block: 'medium' },
      { id: 'a3', key: 'ape', block: 'medium' },
      { id: 'm1', key: 'mask', block: 'medium' },
      { id: 'p1', key: 'petri', block: 'medium' },
      { id: 'm2', key: 'mask', block: 'medium' },
      { id: 'a4', key: 'ape', block: 'low' },
      { id: 'a5', key: 'ape', block: 'low' },
      { id: 'm3', key: 'mask', block: 'low' },
    ];
    expect(
      ids(
        inTurns(
          items,
          (x) => x.key,
          (x) => x.block,
        ),
      ),
    ).toBe('a1 m1 p1 a2 m2 a3 a4 m3 a5');
  });

  it('keeps the order with one key', () => {
    const items = [{ id: 'a' }, { id: 'b' }];
    expect(
      ids(
        inTurns(
          items,
          () => 'x',
          () => 'y',
        ),
      ),
    ).toBe('a b');
  });
});

describe('firstOfEachGroup', () => {
  it('keeps the first n chats of each group, in order, with critical as high', () => {
    const chats = (['critical', 'high', 'medium', 'high', 'low', 'medium', 'medium'] as const).map((severity, i) => ({
      i,
      severity,
    }));
    expect(firstOfEachGroup(chats, 2).map((c) => c.i)).toEqual([0, 1, 2, 4, 5]);
    expect(chatGroup('critical')).toBe('high');
  });
});

describe('openChatsFirst', () => {
  const chat = (i: number, severity: 'critical' | 'high' | 'medium' | 'low', locked = false) => ({
    i,
    severity,
    locked,
  });

  it('puts the 2 most severe open chats first, then the rest in order', () => {
    const chats = [
      chat(0, 'critical', true),
      chat(1, 'high'),
      chat(2, 'high', true),
      chat(3, 'low'),
      chat(4, 'medium'),
    ];
    expect(openChatsFirst(chats).map((c) => c.i)).toEqual([1, 4, 0]);
  });

  it('keeps the order when the first chats are open', () => {
    const chats = [chat(0, 'critical'), chat(1, 'high'), chat(2, 'high'), chat(3, 'medium')];
    expect(openChatsFirst(chats).map((c) => c.i)).toEqual([0, 1, 2]);
  });

  it('fills with locked chats when few are open', () => {
    const chats = [chat(0, 'high', true), chat(1, 'high', true), chat(2, 'low')];
    expect(openChatsFirst(chats).map((c) => c.i)).toEqual([2, 0, 1]);
  });

  it('fills from `rest` only', () => {
    const chats = [chat(0, 'high', true), chat(1, 'medium'), chat(2, 'medium', true), chat(3, 'low')];
    expect(openChatsFirst(chats, { rest: chats.slice(0, 1) }).map((c) => c.i)).toEqual([1, 3, 0]);
  });
});
