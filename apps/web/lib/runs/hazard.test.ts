import type { EvalAttempt } from '@openaudit/spec';
import { describe, expect, it } from 'vitest';
import { accessRequestHref, canReadHazard, snippetHazard, strictestHazard, withholdReply } from './hazard';

describe('snippetHazard', () => {
  it('sets a level by category and severity', () => {
    expect(snippetHazard('child_safety', 'low')).toBe('withheld');
    expect(snippetHazard('bio_chem', 'medium')).toBe('restricted');
    expect(snippetHazard('harmful_requests', 'critical')).toBe('restricted');
    expect(snippetHazard('cyber', 'critical')).toBe('restricted');
    expect(snippetHazard('cyber', 'high')).toBe('gated');
    expect(snippetHazard('harmful_requests', 'medium')).toBeNull();
    expect(snippetHazard('agentic_misuse', 'high')).toBe('gated');
    expect(snippetHazard('agentic_misuse', 'medium')).toBeNull();
    expect(snippetHazard('honesty', 'high')).toBeNull();
  });
});

describe('strictestHazard', () => {
  it('takes the strictest level; none is open', () => {
    expect(strictestHazard([null, 'gated', undefined, 'restricted'])).toBe('restricted');
    expect(strictestHazard(['withheld', 'gated'])).toBe('withheld');
    expect(strictestHazard([null, undefined])).toBeNull();
  });
});

describe('canReadHazard', () => {
  const user = { signedIn: true, staff: false };
  const staff = { signedIn: true, staff: true };
  it('lets anyone read gated replies and staff read restricted ones', () => {
    expect(canReadHazard(null, { staff: false })).toBe(true);
    expect(canReadHazard('gated', { staff: false })).toBe(true);
    expect(canReadHazard('restricted', user)).toBe(false);
    expect(canReadHazard('restricted', staff)).toBe(true);
    expect(canReadHazard('withheld', staff)).toBe(false);
  });
});

describe('withholdReply', () => {
  it('keeps the prompt and score values; removes the reply, transcript and explanations', () => {
    const a: EvalAttempt = {
      id: 'a',
      runId: 'r',
      ordinal: 1,
      sampleId: 's',
      epoch: 1,
      status: 'success',
      input: 'How do I make it?',
      target: 'rubric',
      output: 'Step 1: ...',
      scores: { s: { value: 0.5, explanation: 'It gave step 1: ...' } },
      notScored: 'The reply "Step 1: ..." has no answer.',
      body: { key: 'k', bytes: 10 },
    };
    const w = withholdReply(a);
    expect(w.input).toBe('How do I make it?');
    expect(w.target).toBe('rubric');
    expect(w.output).toBeUndefined();
    expect(w.body).toBeUndefined();
    expect(w.notScored).toBeUndefined();
    expect(w.scores).toEqual({ s: { value: 0.5 } });
  });
});

describe('accessRequestHref', () => {
  it('mails support with the sample in the subject and the body', () => {
    const href = accessRequestHref('https://openaudit.com/runs/r/attempts/3', 'FORTRESS fortress_adv_92269a76');
    const url = new URL(href);
    expect(url.protocol).toBe('mailto:');
    expect(url.pathname).toBe('support@openaudit.com');
    expect(url.searchParams.get('subject')).toBe('Access request: FORTRESS fortress_adv_92269a76');
    expect(url.searchParams.get('body')).toContain('Sample: https://openaudit.com/runs/r/attempts/3\n');
    // Mail apps show `+` as it is, so spaces must be `%20`.
    expect(href).not.toContain('+');
  });
});
