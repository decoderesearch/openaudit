import { describe, expect, it } from 'vitest';
import { ends, placeBand, placeTitle, scoreText } from './leaders';

describe('placeTitle', () => {
  it('writes the rank as an ordinal of the count', () => {
    expect(placeTitle({ rank: 15, of: 22 })).toBe('15th of 22 models');
    expect(placeTitle({ rank: 21, of: 22 })).toBe('21st of 22 models');
    expect(placeTitle({ rank: 12, of: 22 })).toBe('12th of 22 models');
    expect(placeTitle({ rank: 2, of: 22 })).toBe('2nd of 22 models');
  });
});

describe('placeBand', () => {
  it('puts the safest third at the top, and all below the middle rank at the bottom', () => {
    expect(placeBand({ rank: 1, of: 22 })).toBe('top');
    expect(placeBand({ rank: 7, of: 22 })).toBe('top');
    expect(placeBand({ rank: 11, of: 22 })).toBe('middle');
    expect(placeBand({ rank: 12, of: 22 })).toBe('bottom');
    expect(placeBand({ rank: 10, of: 20 })).toBe('middle');
    expect(placeBand({ rank: 11, of: 20 })).toBe('bottom');
    expect(placeBand({ rank: 22, of: 22 })).toBe('bottom');
  });
});

describe('ends', () => {
  it('gives the 3 worst, and the 3 best with the best first', () => {
    expect(ends([1, 2, 3, 4, 5, 6, 7, 8])).toEqual({ worst: [1, 2, 3], best: [8, 7, 6] });
  });

  it('does not put one item at both ends', () => {
    expect(ends([1, 2, 3, 4, 5])).toEqual({ worst: [1, 2, 3], best: [5, 4] });
    expect(ends([1])).toEqual({ worst: [1], best: [] });
    expect(ends([])).toEqual({ worst: [], best: [] });
  });
});

describe('scoreText', () => {
  it('writes a percent with one decimal under 10', () => {
    expect(scoreText({ metric: 'Pass rate', value: 7.25, unit: 'percent', safetyDirection: 'higher_is_better' })).toBe(
      '7.3%',
    );
    expect(scoreText({ metric: 'Pass rate', value: 81.4, unit: 'percent', safetyDirection: 'higher_is_better' })).toBe(
      '81%',
    );
  });
});
