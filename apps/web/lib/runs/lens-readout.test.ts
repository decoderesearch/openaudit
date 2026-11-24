import { metadataOf } from '@/components/runs/attempt-facts';
import type { Transcript } from '@openaudit/spec';
import { describe, expect, it } from 'vitest';
import { bestRanks, isHidden, lensReadoutOf, tokenText } from './lens-readout';

const read = { top: [[' a'], [' b'], [' c']], ranks: { six: [40, 3, 9] } };
const transcriptOf = (metadata: Record<string, unknown>) =>
  ({ extensions: { inspect: { metadata } } }) as unknown as Transcript;
const readout = { layers: [8, 16, 24], readoutLayers: [16, 24], k: 10, lenses: { r_lens: read } };

describe('lensReadoutOf', () => {
  it('reads the readout and the facts', () => {
    const found = lensReadoutOf(transcriptOf({ lensReadout: readout, answer: 'Saturn', scored: true }));
    expect(found?.readout.lenses.r_lens).toEqual(read);
    expect(found?.facts.answer).toBe('Saturn');
  });

  it('drops a lens of the wrong shape, and is null with no lens left', () => {
    const bad = { top: [[' a']], ranks: { six: [1] } };
    const both = lensReadoutOf(
      transcriptOf({ lensReadout: { ...readout, lenses: { r_lens: read, logit_lens: bad } } }),
    );
    expect(Object.keys(both!.readout.lenses)).toEqual(['r_lens']);
    expect(lensReadoutOf(transcriptOf({ lensReadout: { ...readout, lenses: { logit_lens: bad } } }))).toBeNull();
    expect(lensReadoutOf(transcriptOf({ task: 'multihop' }))).toBeNull();
    expect(lensReadoutOf(null)).toBeNull();
  });
});

describe('bestRanks', () => {
  it('uses only the readout layers', () => {
    expect(bestRanks(read, readout.layers, readout.readoutLayers)).toEqual({ six: { rank: 3, layer: 16 } });
    expect(bestRanks(read, readout.layers, [8])).toEqual({ six: { rank: 40, layer: 8 } });
  });
});

describe('tokens', () => {
  it('matches a hidden token with no spaces and in any case', () => {
    expect(isHidden(' Six', 'six')).toBe(true);
    expect(isHidden(' sixth', 'six')).toBe(false);
  });

  it('shows outer spaces, new lines and empty tokens', () => {
    expect(tokenText('  hi ')).toBe('··hi·');
    expect(tokenText('a\nb')).toBe('a↵b');
    expect(tokenText('')).toBe('∅');
  });
});

describe('metadataOf', () => {
  it('leaves out the readout keys only when the sample has a readout', () => {
    const meta = { task: 'multihop', answer: 'Saturn', modelTop: [[' Saturn', 0.1]] };
    expect(metadataOf(transcriptOf({ ...meta, lensReadout: readout }))).toEqual([['task', 'multihop']]);
    expect(metadataOf(transcriptOf(meta)).map(([k]) => k)).toEqual(['task', 'answer', 'modelTop']);
  });
});
