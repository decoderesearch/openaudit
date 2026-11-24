import { describe, expect, it } from 'vitest';
import { modelReleased, releasedAfter } from './release-dates';

describe('releasedAfter', () => {
  it('compares at the precision of both dates', () => {
    expect(releasedAfter('2026-10-02', '2024-10-11')).toBe(true);
    expect(releasedAfter('2024-11', '2024-10-11')).toBe(true);
    expect(releasedAfter('2024-10', '2024-10-11')).toBe(false);
    expect(releasedAfter('2024-10-11', '2024-10-11')).toBe(false);
    expect(releasedAfter('2024-09-30', '2024-10')).toBe(false);
    expect(releasedAfter('2025', '2024-12-31')).toBe(true);
  });

  it('is false with no date or a bad date', () => {
    expect(releasedAfter(null, '2024-10')).toBe(false);
    expect(releasedAfter('2026-01', undefined)).toBe(false);
    expect(releasedAfter('soon', '2024')).toBe(false);
    expect(releasedAfter('2026-01', '2.0.1')).toBe(false);
  });
});

describe('modelReleased', () => {
  it('reads a string release date only', () => {
    expect(modelReleased({ releaseDate: { value: '2026-10-02' } })).toBe('2026-10-02');
    expect(modelReleased({ releaseDate: { value: 2026 } })).toBeNull();
    expect(modelReleased(null)).toBeNull();
  });
});
