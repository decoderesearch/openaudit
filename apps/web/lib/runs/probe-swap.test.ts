import { metadataOf } from '@/components/runs/attempt-facts';
import type { Transcript } from '@openaudit/spec';
import { describe, expect, it } from 'vitest';
import { isWord, probeSwapOf } from './probe-swap';

const transcriptOf = (metadata: Record<string, unknown>) =>
  ({ extensions: { inspect: { metadata } } }) as unknown as Transcript;
const trial = { scale: 1, rank: 1, answerRank: 3, top: [' Spanish', ' Mexican'], editNorm: 0.1 };
const swap = {
  layers: [16, 24],
  scales: [0.5, 1],
  bestScale: { r_lens: 1 },
  intermediate: 'Brazil',
  swapTo: 'Mexico',
  answer: 'Portuguese',
  swapAnswer: 'Spanish',
  trials: { main: { r_lens: [trial] }, randomNull: { r_lens: [{ ...trial, to: 'button' }] } },
};

describe('probeSwapOf', () => {
  it('reads the swap and the facts', () => {
    const found = probeSwapOf(transcriptOf({ probeSwap: swap, scored: false, notScored: 'Not scored.' }));
    expect(found?.swap.trials.main?.r_lens).toEqual([trial]);
    expect(found?.swap.trials.randomNull?.r_lens?.[0]?.to).toBe('button');
    expect(found?.facts.notScored).toBe('Not scored.');
  });

  it('drops a lens of the wrong shape, and is null with no swap', () => {
    const bad = { ...swap, trials: { main: { r_lens: [trial], logit_lens: [{ scale: 1 }] } } };
    expect(Object.keys(probeSwapOf(transcriptOf({ probeSwap: bad }))!.swap.trials.main!)).toEqual(['r_lens']);
    expect(probeSwapOf(transcriptOf({ probeSwap: { ...swap, scales: 'x' } }))).toBeNull();
    expect(probeSwapOf(transcriptOf({ category: 'multihop' }))).toBeNull();
    expect(probeSwapOf(null)).toBeNull();
  });

  it('matches a word with no spaces and in any case', () => {
    expect(isWord(' spanish', 'Spanish')).toBe(true);
    expect(isWord(' Spain', 'Spanish')).toBe(false);
  });
});

describe('metadataOf', () => {
  it('leaves out the swap keys only when the sample has a swap', () => {
    const meta = { category: 'multihop', scored: true };
    expect(metadataOf(transcriptOf({ ...meta, probeSwap: swap }))).toEqual([['category', 'multihop']]);
    expect(metadataOf(transcriptOf(meta)).map(([k]) => k)).toEqual(['category', 'scored']);
  });
});
