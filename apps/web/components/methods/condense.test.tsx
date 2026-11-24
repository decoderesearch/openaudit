import { describe, expect, it } from 'vitest';
import { condense } from './condense';

const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

describe('condense', () => {
  it('keeps the top three and the current row, with a gap where rows are left out', () => {
    expect(condense(rows, (r) => r === 'f')).toEqual(['a', 'b', 'c', null, 'f', null]);
    expect(condense(rows, (r) => r === 'd')).toEqual(['a', 'b', 'c', 'd', null]);
    expect(condense(rows, (r) => r === 'g')).toEqual(['a', 'b', 'c', null, 'g']);
    expect(condense(rows, (r) => r === 'b')).toEqual(['a', 'b', 'c', null]);
  });

  it('keeps all rows when it would leave out fewer than two', () => {
    expect(condense(['a', 'b', 'c', 'd'], (r) => r === 'a')).toEqual(['a', 'b', 'c', 'd']);
    expect(condense(['a', 'b', 'c', 'd', 'e'], (r) => r === 'd')).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});
