import type { ScoreDef } from '@openaudit/spec';
import { describe, expect, it } from 'vitest';
import { labelTally, shareCalls, shareDetectorsOf } from './detectors';

describe('labelTally', () => {
  it('names the one label of all the replies', () => {
    expect(labelTally(new Map([['lie', 32]]))).toBe('All Replies: Lie');
  });

  it('counts each label, most first', () => {
    const labels = new Map([
      ['honest', 4],
      ['lie', 10],
      ['ambiguous', 1],
    ]);
    expect(labelTally(labels)).toBe('Lie: 10 Replies · Honest: 4 Replies · Ambiguous: 1 Reply');
  });
});

const share = (key: string, extra: Partial<ScoreDef> = {}) =>
  ({
    key,
    displayName: key.toUpperCase(),
    type: 'continuous',
    min: 0,
    max: 1,
    direction: 'higher_is_better',
    ...extra,
  }) as ScoreDef;

describe('share detectors', () => {
  it('keeps the 0-to-1 scores that some attempt has', () => {
    const scores = [share('a'), share('b'), share('c', { max: 10 })];
    const attempts = [{ scores: { a: { value: 0.5 }, c: { value: 3 } } }];
    expect(shareDetectorsOf(scores, attempts).map((d) => d.key)).toEqual(['a']);
  });

  it('counts the missed tokens of all', () => {
    const detectors = shareDetectorsOf([share('a'), share('b')], [{ scores: { a: { value: 1 }, b: { value: 1 } } }]);
    const calls = shareCalls({ a: { value: 0.5 }, b: { value: 1 } }, detectors, ['x', 'y', 'z', 'w']);
    expect(calls).toEqual({
      a: { answer: '2/4 Missed', value: 0.5, right: false },
      b: { answer: '0/4 Missed', value: 1, right: true },
    });
    expect(shareCalls({ a: { value: 0 } }, detectors, 'x').a?.answer).toBe('Missed');
    expect(shareCalls({ a: { value: 1 } }, detectors, ['x']).a?.answer).toBe('Passed');
  });

  it('counts a binary score as one test, whatever the target', () => {
    const detectors = shareDetectorsOf([share('a', { type: 'binary' })], [{ scores: { a: { value: 0 } } }]);
    expect(detectors[0]?.hit).toBe(true);
    const calls = shareCalls({ a: { value: 0 } }, detectors, ['Brazil → Mexico', 'Portuguese → Spanish']);
    expect(calls.a).toEqual({ answer: 'Missed', value: null, right: false });
    expect(shareCalls({ a: { value: 1 } }, detectors, 'x').a).toEqual({ answer: 'Passed', value: null, right: true });
  });
});
