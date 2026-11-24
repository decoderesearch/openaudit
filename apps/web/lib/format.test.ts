import { titleCase } from '@/lib/format';
import { describe, expect, it } from 'vitest';

describe('titleCase', () => {
  it('starts each word with a capital, but not small words after the first', () => {
    expect(titleCase('Feature match (MCC)')).toBe('Feature Match (MCC)');
    expect(titleCase('SCR (top 20 latents)')).toBe('SCR (Top 20 Latents)');
    expect(titleCase('Top-1 latent accuracy')).toBe('Top-1 Latent Accuracy');
    expect(titleCase('rate of the lies')).toBe('Rate of the Lies');
  });
});
