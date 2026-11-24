import { metadataOf } from '@/components/runs/attempt-facts';
import type { Transcript } from '@openaudit/spec';
import { describe, expect, it } from 'vitest';
import { answersOf, namesGold, quoteCells, splitWords, wsbReadoutOf, type WsbLens } from './wsb-readout';

const transcriptOf = (metadata: Record<string, unknown>) =>
  ({ extensions: { inspect: { metadata } } }) as unknown as Transcript;
const tokens = {
  kind: 'tokens',
  layers: [20, 24],
  positions: [
    { pos: 3, token: ' detective' },
    { pos: 4, token: ' is' },
  ],
  cells: [
    [[' London', ' city'], null],
    [[' Sherlock', ' Holmes'], [' London']],
  ],
  verdict: { pass: true, pick: 'Sherlock Holmes', quote: 'Sherlock' },
};
const text = {
  ...tokens,
  kind: 'text',
  cells: [
    [['- A detective.'], null],
    [['- Sherlock Holmes.'], null],
  ],
};
const readout = {
  family: 'multihop',
  options: ['Sherlock Holmes', 'Hamlet'],
  gold: 'Sherlock Holmes',
  lenses: { jacobian_lens: tokens, oracle_lens: text },
};

describe('wsbReadoutOf', () => {
  it('reads the readouts and the facts', () => {
    const found = wsbReadoutOf(transcriptOf({ wsbReadout: readout, scored: false, notScored: 'Not scored.' }));
    expect(Object.keys(found!.readout.lenses)).toEqual(['jacobian_lens', 'oracle_lens']);
    expect(found?.readout.lenses.oracle_lens?.kind).toBe('text');
    expect(found?.facts.notScored).toBe('Not scored.');
  });

  it('drops a lens of the wrong shape, and is null with no readout', () => {
    const bad = { ...readout, lenses: { jacobian_lens: tokens, jpp_lens: { ...tokens, cells: [[]] } } };
    expect(Object.keys(wsbReadoutOf(transcriptOf({ wsbReadout: bad }))!.readout.lenses)).toEqual(['jacobian_lens']);
    expect(wsbReadoutOf(transcriptOf({ wsbReadout: { ...readout, lenses: {} } }))).toBeNull();
    expect(wsbReadoutOf(transcriptOf({ family: 'multihop' }))).toBeNull();
    expect(wsbReadoutOf(null)).toBeNull();
  });
});

describe('namesGold', () => {
  it('finds a word of an answer in the top tokens, or an answer in a text', () => {
    const gold = answersOf({ gold: 'Sherlock Holmes' });
    expect(namesGold([' city', ' holmes'], 'tokens', gold)).toBe(true);
    expect(namesGold([' Holm'], 'tokens', gold)).toBe(false);
    expect(namesGold(['It is sherlock holmes.'], 'text', gold)).toBe(true);
    expect(namesGold(null, 'tokens', gold)).toBe(false);
    expect(namesGold([' bug'], 'tokens', [])).toBe(false);
  });

  it('finds the aliases of the gold, a CJK form inside a token, and a one-character gold', () => {
    const three = answersOf({ gold: '3', aliases: ['three', '三'] });
    expect(three).toEqual(['3', 'three', '三']);
    expect(namesGold([' 3'], 'tokens', three)).toBe(true);
    expect(namesGold([' Three'], 'tokens', three)).toBe(true);
    expect(namesGold(['是三'], 'tokens', three)).toBe(true);
    expect(namesGold([' 30', ' threes'], 'tokens', three)).toBe(false);
    expect(namesGold(['It is 30.'], 'text', three)).toBe(false);
  });

  it('uses the forms of the regex units when there is no gold', () => {
    const forms = answersOf({ units: { concept: ['northern lights', '极光'], language: ['Arabic'] } });
    expect(forms).toEqual(['northern lights', '极光', 'Arabic']);
    expect(namesGold(['极光'], 'tokens', forms)).toBe(true);
    expect(namesGold(['- the aurora, in arabic'], 'text', forms)).toBe(true);
  });
});

describe('quoteCells', () => {
  it('finds the cells that hold the quote, as a whole word or in a text', () => {
    const lens = {
      ...tokens,
      cells: [
        [[' one', ' cat'], [' someone']],
        [[' May', ' birth'], [' One']],
      ],
    } as WsbLens;
    expect(quoteCells({ ...lens, verdict: { quote: 'one' } })).toEqual([
      [0, 0],
      [1, 1],
    ]);
    expect(quoteCells({ ...lens, verdict: { quote: 'May | birth' } })).toEqual([[1, 0]]);
    expect(quoteCells({ ...lens, verdict: {} })).toEqual([]);
    expect(quoteCells({ ...(text as WsbLens), verdict: { quote: 'sherlock' } })).toEqual([[1, 0]]);
  });
});

describe('splitWords', () => {
  const lens = (cells: (string[] | null)[][], pos = [21, 22, 23]) =>
    ({
      kind: 'tokens',
      layers: cells.map((_, i) => 40 + i),
      positions: pos.map((p) => ({ pos: p, token: 'x' })),
      cells,
      verdict: {},
    }) as WsbLens;

  it('joins one token of each adjacent position at one layer, as the harness does', () => {
    const l = lens([[[' narciss', 'us'], [' ego', 'ism'], null]]);
    expect(splitWords(l, ['narcissism'])).toEqual([
      {
        word: 'narcissism',
        parts: [
          { at: [0, 0], token: ' narciss' },
          { at: [0, 1], token: 'ism' },
        ],
      },
    ]);
    expect(splitWords(lens([[[' inter'], ['pret'], ['ability']]]), ['Interpretability'])[0]!.parts).toHaveLength(3);
  });

  it('never joins across layers, past a gap in the positions, from one token, or in text', () => {
    expect(
      splitWords(
        lens([
          [[' narciss'], null, null],
          [null, ['ism'], null],
        ]),
        ['narcissism'],
      ),
    ).toEqual([]);
    expect(splitWords(lens([[[' narciss'], ['ism'], null]], [21, 23, 24]), ['narcissism'])).toEqual([]);
    expect(splitWords(lens([[[' narcissism'], [' ism'], null]]), ['narcissism'])).toEqual([]);
    expect(splitWords(lens([[['North'], ['ern'], null]]), ['northern lights'])).toEqual([]);
    expect(splitWords({ ...lens([[['narciss'], ['ism'], null]]), kind: 'text' }, ['narcissism'])).toEqual([]);
  });
});

describe('metadataOf', () => {
  it('leaves out the readout keys only when the sample has a readout', () => {
    const meta = { family: 'multihop', scored: true };
    expect(metadataOf(transcriptOf({ ...meta, wsbReadout: readout }))).toEqual([['family', 'multihop']]);
    expect(metadataOf(transcriptOf(meta)).map(([k]) => k)).toEqual(['family', 'scored']);
  });
});
