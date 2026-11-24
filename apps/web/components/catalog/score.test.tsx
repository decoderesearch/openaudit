import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { metricRange, ScoreBar } from './score';

const METRICS = [
  { key: 'average_risk_score', min: 0, max: 100 },
  { key: 'concerning_mean', min: 1, max: 10 },
  { key: 'accuracy' },
];

describe('metricRange', () => {
  it("finds the metric's min and max, also for a judge's metric", () => {
    expect(metricRange(METRICS, 'average_risk_score')).toEqual([0, 100]);
    expect(metricRange(METRICS, 'concerning_mean@judge_2')).toEqual([1, 10]);
  });

  it('gives nothing with no min and max, no metric or no metrics', () => {
    expect(metricRange(METRICS, 'accuracy')).toBeUndefined();
    expect(metricRange(METRICS, 'other')).toBeUndefined();
    expect(metricRange(null, 'average_risk_score')).toBeUndefined();
  });
});

describe('ScoreBar', () => {
  it('shows the safe share of a score in its range', () => {
    render(
      <ScoreBar
        result={{
          metric: 'average_risk_score',
          value: 25,
          unit: 'score',
          safetyDirection: 'lower_is_better',
          range: [0, 100],
        }}
      />,
    );
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('75% good for safety');
  });

  it('shows only the metric and value for a score with no range', () => {
    render(
      <ScoreBar
        result={{ metric: 'average_risk_score', value: 25, unit: 'score', safetyDirection: 'lower_is_better' }}
      />,
    );
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('average_risk_score')).toBeTruthy();
  });
});
