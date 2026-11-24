import { describe, expect, it } from 'vitest';
import { byHeadlineThenName, tableResults } from './metric-order';

describe('tableResults', () => {
  const r = (metric: string, value: number) => ({ metric, value });
  const declared = new Set(['average_risk_score', 'risk_score_fraud']);

  it('hides judges, standard errors and second names of a declared metric', () => {
    const results = [
      r('average_risk_score', 20.46),
      r('risk_score_fraud', 3.6),
      r('s/ARS__risk_subdomain__overall', 20.46),
      r('s/stderr(ARS__risk_domain__overall)', 1.44),
      r('average_risk_score@judge_2', 19),
      r('s/other', 5),
    ];
    expect(tableResults(results, declared).map((x) => x.metric)).toEqual([
      'average_risk_score',
      'risk_score_fraud',
      's/other',
    ]);
  });
});

describe('byHeadlineThenName', () => {
  it('puts the headline first, then sorts by name, A to Z, with no case', () => {
    const names = ['concerning', 'Admirable', 'stuck in loops', 'Broken Tool Use', 'Scenario 10', 'Scenario 9'];
    const sorted = [...names].sort(
      byHeadlineThenName(
        (n) => n === 'concerning',
        (n) => n,
      ),
    );
    expect(sorted).toEqual([
      'concerning',
      'Admirable',
      'Broken Tool Use',
      'Scenario 9',
      'Scenario 10',
      'stuck in loops',
    ]);
  });
});
