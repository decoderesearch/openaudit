import type { CommitmentState } from '@openaudit/spec';
import { describe, expect, it } from 'vitest';
import { criteriaScore, totalScore } from './commitments';

const state = (s: Partial<CommitmentState>): CommitmentState => ({ level: 'partial', criteria: {}, limits: [], ...s });

describe('criteriaScore', () => {
  it('gives 0.5 for a commitment, 1 when verified, and half that when partly met', () => {
    const s = state({ criteria: { a: 'met', b: 'met', c: 'partly', d: 'not_met' }, verified: ['a', 'c'] });
    expect(criteriaScore(s, ['a', 'b', 'c', 'd'])).toEqual({ met: 2, partly: 1, verified: 2, points: 2, total: 4 });
  });

  it('is null with no criterion marked', () => {
    expect(criteriaScore(state({}), ['a'])).toBeNull();
  });
});

describe('totalScore', () => {
  it('sums the points, out of all criteria, with 0 for a commitment not checked', () => {
    expect(
      totalScore([
        { state: state({ criteria: { a: 'met' }, verified: ['a'] }), keys: ['a', 'b'] },
        { state: state({ level: 'none_found' }), keys: ['c'] },
        { state: null, keys: ['d', 'e'] },
      ]),
    ).toEqual({ points: 1, total: 5 });
  });
});
