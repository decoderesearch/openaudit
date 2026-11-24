import { describe, expect, it, vi } from 'vitest';
import { emailTypeFor, runEmail, type RunEmailInput } from './run-emails';

vi.mock('@/lib/db', () => ({ prisma: {} }));

const base: RunEmailInput = {
  type: 'run_succeeded',
  evalName: 'TruthfulQA',
  modelName: 'qwen/qwen3.6-27b',
  status: 'succeeded',
  costUsd: 0.01234,
  url: 'http://localhost:3300/runs/abc',
};

describe('emailTypeFor', () => {
  it('maps each final status to its email', () => {
    expect(emailTypeFor('succeeded')).toBe('run_succeeded');
    expect(emailTypeFor('failed')).toBe('run_failed');
    expect(emailTypeFor('cancelled')).toBe('run_cancelled');
  });

  it('sends nothing while the run is not done', () => {
    for (const s of ['queued', 'running', 'importing', 'other']) expect(emailTypeFor(s)).toBeNull();
  });
});

describe('runEmail', () => {
  it('names the eval, the model, the status and the link', () => {
    const e = runEmail(base);
    expect(e.subject).toBe('Your run is done: TruthfulQA on qwen/qwen3.6-27b');
    expect(e.text).toContain('Status: succeeded');
    expect(e.text).toContain('Cost: $0.0123');
    expect(e.text).toContain(base.url);
    expect(e.html).toContain(`href="${base.url}"`);
  });

  it('gives no cost or error for a queued run', () => {
    const e = runEmail({ ...base, type: 'run_queued', status: 'queued', error: 'old' });
    expect(e.subject).toMatch(/^Your run is queued/);
    expect(e.text).not.toContain('Cost');
    expect(e.text).not.toContain('Error');
  });

  it('gives the error for a failed run, escaped in HTML', () => {
    const e = runEmail({ ...base, type: 'run_failed', status: 'failed', costUsd: null, error: '<boom>' });
    expect(e.text).toContain('Error: <boom>');
    expect(e.text).not.toContain('Cost');
    expect(e.html).toContain('&lt;boom&gt;');
    expect(e.html).not.toContain('<boom>');
  });
});
