import type { EvalAttempt, SampleTerms } from '@openaudit/spec';
import { describe, expect, it } from 'vitest';
import { attemptRule, isNonCommercial, redactAttempt, strictest, termsText, versionRule } from './terms';

describe('isNonCommercial', () => {
  it('finds NC licenses by SPDX id or name', () => {
    expect(['cc-by-nc-4.0', 'cc-by-nc-sa-4.0', 'CC BY-NC 4.0'].every(isNonCommercial)).toBe(true);
    expect(['mit', 'cc-by-4.0', 'cc-by-sa-4.0', 'apache-2.0', 'proprietary'].some(isNonCommercial)).toBe(false);
    expect(isNonCommercial(undefined)).toBe(false);
  });
});

const terms: SampleTerms = {
  display: 'open',
  source: 'https://example.org/terms',
  subsets: [{ key: 'dataset_name', value: 'GPQA', display: 'sign_in', quote: 'Do not post.', source: 'https://x.org' }],
};

const attempt: EvalAttempt = {
  id: 'a',
  runId: 'r',
  ordinal: 1,
  sampleId: 's',
  epoch: 1,
  status: 'success',
  passed: true,
  input: 'question',
  output: 'answer',
  target: 'B',
  choices: ['x', 'y'],
  scores: { choice: { value: 'C', answer: 'B', explanation: 'why' } },
  tokens: { input: 3 },
  notScored: 'The reply "answer" has no letter.',
  body: { key: 'k', bytes: 1 },
};

describe('sample terms', () => {
  it('uses open when a version has no terms', () => {
    expect(versionRule({})).toBe('open');
    expect(attemptRule({}, {})).toBe('open');
  });

  it('lets a subset rule on the attempt replace the version rule', () => {
    expect(attemptRule({ sampleTerms: terms }, { display: 'sign_in' })).toBe('sign_in');
    expect(attemptRule({ sampleTerms: { ...terms, display: 'scores_only' } }, {})).toBe('scores_only');
  });

  it('finds the strictest rule', () => {
    expect(strictest([])).toBe('open');
    expect(strictest(['open', 'scores_only', 'sign_in'])).toBe('scores_only');
  });

  it('puts subset quotes in the terms text', () => {
    expect(termsText(terms)).toBe('Do not post.');
    expect(termsText({ ...terms, note: 'Gated.' })).toBe('Do not post.\n\nGated.');
  });

  it('removes all sample text and keeps scores', () => {
    const r = redactAttempt(attempt);
    expect(r).not.toHaveProperty('input');
    expect(r).not.toHaveProperty('output');
    expect(r).not.toHaveProperty('target');
    expect(r).not.toHaveProperty('choices');
    expect(r).not.toHaveProperty('body');
    expect(r).not.toHaveProperty('notScored');
    expect(r.scores).toEqual({ choice: { value: 'C' } });
    expect(r.passed).toBe(true);
    expect(r.tokens).toEqual({ input: 3 });
  });
});
