import { describe, expect, it } from 'vitest';
import { sampleCount, sampleLabel, samplePlace, sampleRef, sampleTitle, shortSampleId } from './sample-label';

describe('shortSampleId', () => {
  it('keeps ids of 20 characters or fewer', () => {
    expect(shortSampleId('mask_0009b9b6')).toBe('mask_0009b9b6');
    expect(shortSampleId('a'.repeat(20))).toBe('a'.repeat(20));
  });

  it('puts the ellipsis in the middle of a longer id, at 20 characters', () => {
    const short = shortSampleId('blackmail_explicit-america_replacement');
    expect(short).toBe('blackma…_replacement');
    expect(short).toHaveLength(20);
    expect(shortSampleId('ALCUNADataset_00108996')).toBe('ALCUNAD…set_00108996');
  });

  it('shows the first 8 characters of a UUID', () => {
    expect(shortSampleId('01f6634c-ca7b-4574-91cb-a8950e6a13aa')).toBe('01f6634c');
  });
});

describe('samplePlace', () => {
  it('counts samples, and epochs when the run has more than one', () => {
    expect(samplePlace({ ordinal: 3, epoch: 1 }, 176, undefined)).toBe('Sample 3 of 176');
    expect(samplePlace({ ordinal: 14, epoch: 14 }, 50, 50)).toBe('Sample 1 of 1, epoch 14 of 50');
    expect(samplePlace({ ordinal: 7, epoch: 2 }, 15, 5)).toBe('Sample 2 of 3, epoch 2 of 5');
  });
});
describe('sampleCount', () => {
  it('shows the epochs when the run has more than one', () => {
    expect(sampleCount(176, undefined)).toBe('176');
    expect(sampleCount(50, 50)).toBe('1 × 50 epochs');
  });
});

describe('sampleLabel', () => {
  it('adds the epoch only when the run has more than one', () => {
    const a = { sampleId: 'blackmail_explicit-america_replacement', epoch: 14 };
    expect(sampleLabel(sampleRef(a, 50))).toBe('blackma…_replacement #14');
    expect(sampleLabel(sampleRef({ sampleId: '39-1', epoch: 1 }, undefined))).toBe('39-1');
    expect(sampleLabel(sampleRef({ sampleId: '39-1', epoch: 1 }, 1))).toBe('39-1');
  });

  it('gives the full id as the title only when the label shortens it', () => {
    expect(sampleTitle({ id: 'mask_0009b9b6' })).toBeUndefined();
    expect(sampleTitle({ id: 'ALCUNADataset_00108996' })).toBe('ALCUNADataset_00108996');
  });
});
