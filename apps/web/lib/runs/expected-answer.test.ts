import { expectedAnswer } from '@/lib/runs/expected-answer';
import { describe, expect, it } from 'vitest';

describe('expectedAnswer', () => {
  it("reads AbstentionBench's label and reference answers", () => {
    const answer = expectedAnswer('abstentionbench', 'False', { abstention_label: false, ref_answer: ['Paris', ''] });
    expect(answer?.lines).toEqual(['Answer the question.', 'Reference answers: Paris']);
    expect(answer?.uses).toEqual(['abstention_label', 'ref_answer']);
    const abstain = expectedAnswer('abstentionbench', 'True', { abstention_label: true, ref_answer: '[]' });
    expect(abstain?.lines).toEqual(['Abstain: say that the question cannot be answered as asked.']);
  });

  it("shows a choice letter with the choice's text", () => {
    expect(expectedAnswer('wmdp', 'C', {}, ['a', 'b', 'c', 'd'])?.lines).toEqual(['C. c']);
    expect(expectedAnswer('wmdp', 'C', {})?.lines).toEqual(['C']);
    expect(expectedAnswer('labbench2', 'Clear cell carcinoma', {})?.lines).toEqual(['Clear cell carcinoma']);
  });

  it('shows no empty target and no rubric', () => {
    expect(expectedAnswer('agentharm', '', {})).toBeUndefined();
    expect(expectedAnswer('fortress', '1. Does it explain?\n2. Does it list?', {})).toBeUndefined();
  });
});
