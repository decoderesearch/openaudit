import { barOf, flagRank, harmOf, mainScore, sampleBar } from '@/lib/runs/main-score';
import type { EvalVersion } from '@openaudit/spec';
import { describe, expect, it } from 'vitest';

describe('sampleBar', () => {
  const version = {
    metrics: [
      { key: 'attempt', score: 'attempt', safetyDirection: 'lower_is_better', min: 0, max: 1 },
      { key: 'attempt_benign', score: 'attempt', safetyDirection: 'neither' },
      { key: 'attempt_harmful', score: 'attempt', safetyDirection: 'lower_is_better' },
      { key: 'refusal_benign', score: 'refusal', safetyDirection: 'neither' },
      { key: 'quiet', safetyDirection: 'higher_is_better' },
      { key: 'quiet_benign', safetyDirection: 'neither' },
    ],
  } as unknown as EvalVersion;
  const bar = barOf(version, [], 'attempt')!;

  it("uses the sample's group direction", () => {
    expect(sampleBar('attempt', 1, bar, ['attempt_benign', 'refusal_benign']).safetyDirection).toBe('neither');
    expect(sampleBar('attempt', 1, bar, ['attempt_harmful']).safetyDirection).toBe('lower_is_better');
  });

  it('finds the groups of a metric with no score by key', () => {
    const quiet = barOf(version, [], 'quiet')!;
    expect(sampleBar('quiet', 0, quiet, ['quiet_benign']).safetyDirection).toBe('neither');
    expect(sampleBar('attempt', 1, bar, ['quiet_benign']).safetyDirection).toBe('lower_is_better');
  });

  it("uses the metric's direction with no group of its score", () => {
    const score = sampleBar('attempt', 1, bar, ['refusal_benign']);
    expect(score).toEqual({
      metric: 'attempt',
      value: 1,
      unit: undefined,
      safetyDirection: 'lower_is_better',
      range: [0, 1],
    });
    expect(sampleBar('attempt', 1, bar).safetyDirection).toBe('lower_is_better');
  });
});

describe('mainScore', () => {
  it("names a scorer's key by the score whose attemptName it is, with its description", () => {
    const version = {
      metrics: [{ key: 'recall', score: 'abstained_when_should', headline: true }],
      scores: [
        { key: 'abstained_when_should', description: 'Not in attempts.' },
        { key: 'abstained', displayName: 'Abstained', attemptName: 'abstention_bench_scorer', description: 'Yes.' },
      ],
    } as unknown as EvalVersion;
    expect(mainScore(version, [], ['abstention_bench_scorer'])).toMatchObject({
      key: 'abstention_bench_scorer',
      label: 'Abstained',
      description: 'Yes.',
    });
  });

  it('takes the first declared score when the headline names none', () => {
    const version = {
      metrics: [{ key: 'balanced_accuracy', headline: true }],
      scores: [
        { key: 'cot_judge', displayName: 'Judge Grade', type: 'ordinal' },
        { key: 'apollo', displayName: 'Apollo' },
      ],
    } as unknown as EvalVersion;
    expect(mainScore(version, [], ['apollo', 'cot_judge'])).toMatchObject({ key: 'cot_judge', label: 'Judge Grade' });
    expect(mainScore(version, [], ['other'])?.key).toBe('other');
  });

  describe('with a headline that is a share above a cutoff', () => {
    const version = {
      metrics: [
        {
          key: 'elicitation_rate',
          displayName: 'Elicitation rate',
          score: 'behavior_presence',
          aggregation: 'custom',
          headline: true,
          min: 0,
          max: 1,
          safetyDirection: 'lower_is_better',
          description: 'Share at 7 or higher.',
        },
        {
          key: 'mean_behavior_presence',
          score: 'behavior_presence',
          aggregation: 'mean',
          min: 1,
          max: 10,
          safetyDirection: 'lower_is_better',
        },
      ],
      scores: [
        {
          key: 'behavior_presence',
          displayName: 'Behavior presence',
          attemptName: 'delusion_sycophancy',
          description: 'How strongly.',
        },
        { key: 'eval_awareness' },
        { key: 'scenario_realism' },
      ],
    } as unknown as EvalVersion;
    const keys = ['audit_judge/eval_awareness', 'audit_judge/scenario_realism', 'audit_judge/delusion_sycophancy'];

    it("finds the headline's score by its attemptName, not the first key", () => {
      expect(mainScore(version, [], keys)?.key).toBe('audit_judge/delusion_sycophancy');
    });

    it("has the score's name, the bar of its mean, and the headline in its description", () => {
      expect(mainScore(version, [], keys)).toMatchObject({
        label: 'Behavior presence',
        bar: { safetyDirection: 'lower_is_better', range: [1, 10] },
        description: 'How strongly. The headline, Elicitation rate: Share at 7 or higher.',
      });
    });

    it("has the headline's bar with no mean metric when the score is on its scale", () => {
      const [head] = version.metrics;
      const binary = {
        metrics: [head],
        scores: [{ key: 'behavior_presence', displayName: 'Elicited', type: 'binary', min: 0, max: 1 }],
      } as unknown as EvalVersion;
      expect(mainScore(binary, [], ['scorer/behavior_presence'])).toMatchObject({
        label: 'Elicited',
        bar: { range: [0, 1] },
      });
      const wide = {
        metrics: [head],
        scores: [{ key: 'behavior_presence', min: 1, max: 10 }],
      } as unknown as EvalVersion;
      expect(mainScore(wide, [], ['scorer/behavior_presence'])?.bar).toBeUndefined();
    });
  });

  it("describes the headline's score", () => {
    const version = {
      metrics: [{ key: 'rate', displayName: 'Refusal rate', score: 'refused', headline: true, description: 'Rate.' }],
      scores: [{ key: 'refused', description: 'One when the model refuses.' }],
    } as unknown as EvalVersion;
    expect(mainScore(version, [], ['scorer/refused'])).toMatchObject({
      label: 'Refusal rate',
      description: 'One when the model refuses.',
    });
  });
});

describe('harmOf', () => {
  it('puts the worst score highest', () => {
    expect(harmOf(0.2, 'higher_is_better')).toBeGreaterThan(harmOf(0.8, 'higher_is_better'));
    expect(harmOf(0.8, 'lower_is_better')).toBeGreaterThan(harmOf(0.2, 'lower_is_better'));
    expect(harmOf(-0.9, 'nearer_zero_is_better')).toBeGreaterThan(harmOf(0.1, 'nearer_zero_is_better'));
  });

  it('puts the highest first with no direction', () => {
    expect(harmOf(0.8)).toBeGreaterThan(harmOf(0.2));
    expect(harmOf(0.8, 'neither')).toBeGreaterThan(harmOf(0.2, 'neither'));
  });
});

describe('flagRank', () => {
  it('puts the most severe flag first and no flag last', () => {
    const ranks = (['low', undefined, 'high', 'medium'] as const).map(flagRank);
    expect([...ranks].sort((a, b) => a - b)).toEqual([
      flagRank('high'),
      flagRank('medium'),
      flagRank('low'),
      flagRank(),
    ]);
    expect(flagRank()).toBeGreaterThan(flagRank('low'));
  });
});
