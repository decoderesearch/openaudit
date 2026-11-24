import { describe, expect, it } from 'vitest';
import { splitSummaryParts } from './thinking';

describe('splitSummaryParts', () => {
  it('puts a blank line before a title that follows text with no break', () => {
    expect(splitSummaryParts('**One**\n\nIs that okay!**Two**\n\nYes.')).toBe(
      '**One**\n\nIs that okay!\n\n**Two**\n\nYes.',
    );
  });

  it('keeps bold text inside a line, and parts that already have a break', () => {
    const text = '**One**\n\nA **bold** word and a**tight** one.\n\n**Two**\n\nYes.';
    expect(splitSummaryParts(text)).toBe(text);
  });
});
