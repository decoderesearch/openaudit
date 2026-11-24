import { abstains, counts, deploymeter, humanWeight, median, verdictOf, votesOf } from '@/lib/deploymeter';
import { describe, expect, it } from 'vitest';

describe('deploymeter', () => {
  it('maps scores to verdicts at 70 and 50', () => {
    expect([100, 70, 69, 50, 49, 0].map(verdictOf)).toEqual([
      'approve',
      'approve',
      'limits',
      'limits',
      'reject',
      'reject',
    ]);
  });

  it('takes the median', () => {
    expect(median([])).toBeNull();
    expect(median([60, 10, 80])).toBe(60);
    expect(median([60, 80])).toBe(70);
  });

  it('gives humans no weight below 5 reviews, then more, at most half', () => {
    expect(humanWeight(4)).toBe(0);
    expect(humanWeight(5)).toBeCloseTo(0.2);
    expect(humanWeight(20)).toBe(0.5);
    expect(humanWeight(1000)).toBe(0.5);
  });

  it('is the AI score until humans count, then moves toward the human median', () => {
    expect(deploymeter(72, [])).toBe(72);
    expect(deploymeter(72, [0, 0, 0, 0])).toBe(72);
    expect(deploymeter(70, [20, 20, 20, 20, 20])).toBe(60);
    expect(deploymeter(null, [])).toBeNull();
    expect(deploymeter(null, [40, 50, 60, 70, 80])).toBe(60);
  });

  it('counts only scored reviews by judges of other labs', () => {
    expect(counts({ score: 80, sameLab: false, self: false })).toBe(true);
    expect(counts({ score: 80, sameLab: true, self: false })).toBe(false);
    expect(counts({ score: 80, sameLab: false, self: true })).toBe(false);
    expect(counts({ score: null, sameLab: false, self: false })).toBe(false);
  });

  it('counts abstains of judges of other labs as their own vote', () => {
    expect(abstains({ abstain: true, sameLab: false, self: false })).toBe(true);
    expect(abstains({ abstain: true, sameLab: true, self: false })).toBe(false);
    expect(
      votesOf([
        { name: 'a', score: 80 },
        { name: 'b', score: null },
        { name: 'c', score: 40 },
      ]),
    ).toEqual({ reject: 1, limits: 0, approve: 1, abstain: 1 });
  });
});
