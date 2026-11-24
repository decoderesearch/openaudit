import type { ScoreDef } from '@openaudit/spec';
import { describe, expect, it } from 'vitest';
import { directionPassed, rulePassed, scoreMark, valueText } from './pass-rule';

const def = (d: Partial<ScoreDef>): ScoreDef => ({
  key: 'x',
  displayName: 'X',
  type: 'binary',
  direction: 'higher_is_better',
  ...d,
});

describe('pass rules', () => {
  it('reads values as the runner does', () => {
    expect([1.0, 0, 0.5, true, ' Yes ', null].map(valueText)).toEqual(['1', '0', '0.5', 'true', 'yes', null]);
  });

  it('marks named values, and no other', () => {
    const mask = { values: { honest: true, lie: false } };
    expect(['honest', 'lie', 'evade', ' Honest'].map((v) => rulePassed(mask, v, null))).toEqual([
      true,
      false,
      null,
      true,
    ]);
  });

  it('marks by the sample target', () => {
    const abstain = { byTarget: { True: { yes: true, no: false }, False: { yes: false, no: true } } };
    const cases: [unknown, unknown][] = [
      ['Yes', 'True'],
      ['no', 'True'],
      ['NO', 'False'],
      ['Yes', 'False'],
      [null, 'True'],
      ['Yes', ['True']],
    ];
    expect(cases.map(([v, t]) => rulePassed(abstain, v, t))).toEqual([true, false, true, false, null, null]);
  });

  it('marks only the attempts in its groups', () => {
    const ape: NonNullable<ScoreDef['pass']> = {
      values: { '0': true, '1': false },
      groups: ['turn1_attempt_undermining_control'],
    };
    const harmful = ['turn1_attempt_undermining_control', 'persuasion_score_undermining_control'];
    expect([0, 1, 0.5].map((v) => rulePassed(ape, v, null, harmful))).toEqual([true, false, null]);
    expect([0, 1].map((v) => rulePassed(ape, v, null, ['turn1_attempt_benign_factual']))).toEqual([null, null]);
  });

  it('fails at a threshold', () => {
    const elicited = { failAtOrAbove: 7 };
    expect([1, 6.67, 7, 10, '7', true].map((v) => rulePassed(elicited, v, null))).toEqual([
      true,
      true,
      false,
      false,
      null,
      null,
    ]);
    expect(rulePassed({ none: true }, 1, null)).toBeNull();
  });

  it('marks by the direction with no rule', () => {
    const share = def({ type: 'continuous', direction: 'lower_is_better', min: 0, max: 1 });
    expect([0, 0.25, 0.5, 1].map((v) => directionPassed(v, share))).toEqual([true, null, false, false]);
    expect(['C', 'I', 1, 0, 0.5].map((v) => directionPassed(v, def({})))).toEqual([true, false, true, false, null]);
    expect(directionPassed(1, def({ direction: 'neither' }))).toBeNull();
  });

  it('gives a scale with no rule no mark', () => {
    const scale = def({ type: 'ordinal', direction: 'lower_is_better', min: 1, max: 10 });
    expect(scoreMark(9, scale, null)).toBeNull();
    expect(scoreMark(9, { ...scale, pass: { failAtOrAbove: 7 } }, null)).toBe(false);
    expect(scoreMark(1, undefined, null)).toBeNull();
  });
});
