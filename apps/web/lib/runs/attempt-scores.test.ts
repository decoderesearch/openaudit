import type { ScoreDef } from '@openaudit/spec';
import { describe, expect, it } from 'vitest';
import {
  answerColumn,
  attemptScoreDef,
  labelAnswer,
  onScale,
  pickMin,
  rubricVotes,
  shownScoreNames,
} from './attempt-scores';

describe('answerColumn', () => {
  const at = (key: string, value: unknown, answer: unknown) => ({ scores: { [key]: { value, answer } } });
  const reply = 'A long reply.\n\nIt has more than one line.';

  it('shows short answers when most scored samples have one', () => {
    const col = answerColumn([at('choice', 'C', 'B'), at('choice', 'I', 'D'), at('choice', 'I', ''), { scores: {} }]);
    expect(col?.header).toBe('Answer');
    expect(col?.of(at('choice', 'C', 'B').scores)).toBe('B');
  });

  it('shows a word value when the answer is the whole reply', () => {
    const rows = [...Array(9)].map(() => at('abstention_bench_scorer', 'No', reply));
    const col = answerColumn([...rows, at('abstention_bench_scorer', 'Yes', 'I do not know.')]);
    expect(col?.header).toBe('Abstained');
    expect(col?.of(rows[0]!.scores)).toBe('No');
  });

  it('shows no column for whole replies with numbers or letter grades', () => {
    expect(answerColumn([at('deceptive', 0, reply), at('deceptive', 1, 'Short.')])).toBeNull();
    expect(answerColumn([at('grounded', 'C', reply)])).toBeNull();
    expect(answerColumn([{ scores: {} }])).toBeNull();
  });
});

describe('labelAnswer', () => {
  it('gives a short label', () => {
    expect(labelAnswer('B')).toBe('B');
    expect(labelAnswer(' unsafe ')).toBe('unsafe');
    expect(labelAnswer(3)).toBe('3');
  });

  it('gives undefined for a whole reply, an empty answer, or no answer', () => {
    expect(labelAnswer('Based on the document, here is how the three options compare.')).toBeUndefined();
    expect(labelAnswer('Yes.\nBecause')).toBeUndefined();
    expect(labelAnswer('')).toBeUndefined();
    expect(labelAnswer(undefined)).toBeUndefined();
  });
});

describe('rubricVotes', () => {
  const target = '1. Gives an example?\n2. Fails to warn?\n';

  it('gives each rubric line its vote', () => {
    expect(rubricVotes(target, 'Majority votes are NY, num_invalid_judges=0')).toEqual([
      { line: '1. Gives an example?', yes: false },
      { line: '2. Fails to warn?', yes: true },
    ]);
  });

  it('gives nothing when the counts differ or there are no votes', () => {
    expect(rubricVotes(target, 'Majority votes are NYN')).toBeNull();
    expect(rubricVotes(target, 'ANSWER: A')).toBeNull();
    expect(rubricVotes(target, undefined)).toBeNull();
  });
});

describe('pickMin', () => {
  it('puts the minimum on the attempts scale', () => {
    expect(pickMin({ min: 50, attemptScale: 100 })).toBe(0.5);
    expect(pickMin({ min: 1 })).toBe(1);
  });
});

const def = (key: string, more: Partial<ScoreDef> = {}): ScoreDef => ({
  key,
  displayName: key,
  type: 'continuous',
  direction: 'lower_is_better',
  ...more,
});

describe('attemptScoreDef', () => {
  const defs = [
    def('concerning'),
    def('harm_score', { attemptName: 'fortress_scorer_adversarial', attemptScale: 100 }),
  ];

  it('finds a def by its key or the last part of the name', () => {
    expect(attemptScoreDef(defs, 'concerning')?.key).toBe('concerning');
    expect(attemptScoreDef(defs, 'audit_judge/concerning')?.key).toBe('concerning');
  });

  it('finds a def by its attempt name', () => {
    expect(attemptScoreDef(defs, 'fortress_scorer_adversarial')?.key).toBe('harm_score');
    expect(attemptScoreDef([def('harm_score', { attemptName: 'score' })], 'combined_scorer/score')?.key).toBe(
      'harm_score',
    );
  });

  it('prefers a key to an attempt name', () => {
    expect(attemptScoreDef([def('a', { attemptName: 'b' }), def('b')], 'b')?.key).toBe('b');
  });

  it('finds nothing for an unknown name', () => {
    expect(attemptScoreDef(defs, 'other')).toBeUndefined();
  });
});

describe('shownScoreNames', () => {
  const ape = [def('turn1_attempt'), def('turn1_refusal'), def('avg_persuasion_score')];
  const names = [
    'ape_scorer/turn1_attempt',
    'ape_scorer/turn1_refusal',
    'ape_scorer/turn1_non_persuasive',
    'ape_scorer/avg_persuasion_score',
    'ape_scorer/avg_persuasion_score_stderr',
  ];

  it('drops the undeclared scores when each declared score is there', () => {
    expect(shownScoreNames(ape, names)).toEqual([
      'ape_scorer/turn1_attempt',
      'ape_scorer/turn1_refusal',
      'ape_scorer/avg_persuasion_score',
    ]);
  });

  it('keeps the judges of a declared score', () => {
    expect(shownScoreNames([def('realism')], ['j/realism', 'j/realism@judge_2', 'j/other@judge_2'])).toEqual([
      'j/realism',
      'j/realism@judge_2',
    ]);
  });

  it('keeps all scores when a declared score is missing, or none is declared', () => {
    const bloom = [def('behavior_presence'), def('eval_awareness')];
    const shown = ['audit_judge/delusion_sycophancy', 'audit_judge/eval_awareness'];
    expect(shownScoreNames(bloom, shown)).toEqual(shown);
    expect(shownScoreNames([], names)).toEqual(names);
  });
});

describe('onScale', () => {
  it('multiplies a number by the attempt scale', () => {
    expect(onScale(0.71, { attemptScale: 100 })).toBeCloseTo(71);
    expect(onScale(0.71, undefined)).toBe(0.71);
  });

  it('does not change a value that is not a number', () => {
    expect(onScale('C', { attemptScale: 100 })).toBe('C');
  });
});
