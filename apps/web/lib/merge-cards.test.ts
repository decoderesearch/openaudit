import { mergeCards, type CardSourceData } from '@/lib/merge-cards';
import type { EvalResult } from '@openaudit/spec';
import { describe, expect, it } from 'vitest';

const src = { page: '1', quote: 'q' };
const result = (value: number, extra: Partial<EvalResult> = {}): EvalResult =>
  ({
    id: String(value),
    origin: 'reported',
    rawEvalName: 'GPQA',
    metric: 'accuracy',
    value,
    settings: {},
    ...extra,
  }) as EvalResult;
const card = (over: Partial<CardSourceData>): CardSourceData => ({
  findings: [],
  riskDecisions: [],
  topics: [],
  testers: [],
  disclosures: {},
  results: [],
  ...over,
});

describe('mergeCards', () => {
  it('keeps one source as it is, even with repeated results', () => {
    const one = card({ results: [result(1), result(2)] });
    expect(mergeCards([one]).results.map((r) => [r.value, r.from])).toEqual([
      [1, 0],
      [2, 0],
    ]);
  });

  it('takes the newest value for the same measurement', () => {
    const newer = card({ results: [result(80)] });
    const older = card({ results: [result(70), result(50, { metric: 'pass@1' })] });
    expect(mergeCards([newer, older]).results.map((r) => [r.metric, r.value, r.from])).toEqual([
      ['accuracy', 80, 0],
      ['pass@1', 50, 1],
    ]);
  });

  it('keeps results apart when settings differ', () => {
    const newer = card({ results: [result(80, { settings: { tools: true } })] });
    const older = card({ results: [result(70)] });
    expect(mergeCards([newer, older]).results).toHaveLength(2);
  });

  it('takes all verdicts of a risk area from the newest source that has one', () => {
    const v = (domain: 'cyber' | 'bio_chem', labLabel: string) =>
      ({ domain, labLabel, phase: 'unspecified', source: src }) as const;
    const newer = card({ riskDecisions: [v('cyber', 'High')] });
    const older = card({
      riskDecisions: [v('cyber', 'Medium'), v('bio_chem', 'High'), v('bio_chem', 'below Critical')],
    });
    expect(mergeCards([newer, older]).riskDecisions.map((r) => [r.labLabel, r.from])).toEqual([
      ['High', 0],
      ['High', 1],
      ['below Critical', 1],
    ]);
  });

  it('prefers a covered topic, and the newest stated fact', () => {
    const newer = card({
      topics: [{ topic: 'cyber', covered: false }],
      disclosures: { contextWindow: { status: 'not_stated' } },
    });
    const older = card({
      topics: [{ topic: 'cyber', covered: true, headline: 'x', source: src }],
      disclosures: { contextWindow: { status: 'stated', value: '200K', source: src } },
    });
    const m = mergeCards([newer, older]);
    expect(m.topics.map((t) => [t.covered, t.from])).toEqual([[true, 1]]);
    expect(m.disclosures.contextWindow?.from).toBe(1);
  });

  it('drops an older finding that repeats a newer one', () => {
    const f = (text: string) => ({ text, source: src });
    const newer = card({
      findings: [f('Sexual disallowed content is forecast to rise ~40% (0.05%→0.07%) vs GPT-5.5 in deployment.')],
    });
    const older = card({
      findings: [
        f('Sexual disallowed content forecast rose ~40% (0.05%→0.07%) vs GPT-5.5; mental health fell.'),
        f('METR found a high cheating rate on time horizon.'),
      ],
    });
    expect(mergeCards([newer, older]).findings.map((x) => x.from)).toEqual([0, 1]);
  });

  it('lists a tester once, from the newest source', () => {
    const newer = card({ testers: [{ name: 'UK AISI', source: src }] });
    const older = card({
      testers: [
        { name: 'UK  AISI', source: src },
        { name: 'METR', source: src },
      ],
    });
    expect(mergeCards([newer, older]).testers.map((t) => [t.name, t.from])).toEqual([
      ['UK AISI', 0],
      ['METR', 1],
    ]);
  });
});
