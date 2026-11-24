import { describe, expect, it } from 'vitest';
import { parseReport, REPORT_LIMITS, REPORT_TYPES, shownFields, submissionRef } from './report';

describe('parseReport', () => {
  it('has the types in order, with Incident first', () => {
    expect(REPORT_TYPES.map((t) => t.label)).toEqual(['Incident', 'Evaluation', 'Method', 'Other']);
  });

  it('accepts a submission, trims its fields and lower-cases the email', () => {
    const r = parseReport({ type: 'incident', body: '  Text  ', email: ' A@B.co ', page: '/openai' });
    expect(r).toEqual({
      ok: true,
      report: { type: 'incident', body: 'Text', email: 'a@b.co', page: '/openai', fields: {} },
    });
  });

  it('refuses an unknown or old type and an empty body', () => {
    expect(parseReport({ type: 'spam', body: 'x' }).ok).toBe(false);
    expect(parseReport({ type: 'inaccuracy', body: 'x' }).ok).toBe(false);
    expect(parseReport({ type: 'other', body: '   ' }).ok).toBe(false);
    expect(parseReport(null).ok).toBe(false);
  });

  it('refuses a body over the limit', () => {
    expect(parseReport({ type: 'other', body: 'x'.repeat(REPORT_LIMITS.body) }).ok).toBe(true);
    expect(parseReport({ type: 'other', body: 'x'.repeat(REPORT_LIMITS.body + 1) }).ok).toBe(false);
  });

  it('lets an incident or other be anonymous, but needs an email for an evaluation or method', () => {
    expect(parseReport({ type: 'incident', body: 'x' })).toMatchObject({ ok: true, report: { email: '' } });
    expect(parseReport({ type: 'other', body: 'x', email: '  ' }).ok).toBe(true);
    expect(parseReport({ type: 'evaluation', body: 'x' }).ok).toBe(false);
    expect(parseReport({ type: 'method', body: 'x' }).ok).toBe(false);
    expect(parseReport({ type: 'method', body: 'x', email: 'a@b.co' }).ok).toBe(true);
  });

  it('refuses an email that is not an address', () => {
    expect(parseReport({ type: 'incident', body: 'x', email: 'Jane Doe' }).ok).toBe(false);
  });

  it('keeps only a site path as the page', () => {
    const r = parseReport({ type: 'other', body: 'x', page: 'https://evil.example/' });
    expect(r.ok && r.report.page).toBe('');
  });

  it('keeps the known fields of the type, trimmed, and drops the rest', () => {
    const r = parseReport({
      type: 'method',
      body: 'x',
      email: 'a@b.co',
      fields: {
        method: ' Workspace Lenses ',
        variant: 'K-Lens',
        recipe: 'Fit on 64 prompts.',
        name: 'not a method field',
        link: '',
      },
    });
    expect(r.ok && r.report.fields).toEqual({
      method: 'Workspace Lenses',
      variant: 'K-Lens',
      recipe: 'Fit on 64 prompts.',
    });
  });

  it('refuses a select value that is not an option, and a link that is not http', () => {
    const base = { type: 'evaluation', body: 'x', email: 'a@b.co' };
    expect(parseReport({ ...base, fields: { tests: 'cats' } })).toMatchObject({ ok: false, error: /What It Evaluates/ });
    expect(parseReport({ ...base, fields: { link: 'javascript:alert(1)' } })).toMatchObject({
      ok: false,
      error: /https/,
    });
    expect(parseReport({ ...base, fields: { link: 'https://x.org/a' } }).ok).toBe(true);
  });

  it('keeps a check box only when its condition holds', () => {
    const base = { type: 'evaluation', body: 'x', email: 'a@b.co' };
    const pub = parseReport({ ...base, fields: { access: 'public', runPrivately: true } });
    expect(pub.ok && pub.report.fields).toEqual({ access: 'public' });
    const priv = parseReport({ ...base, fields: { access: 'partly', runPrivately: true } });
    expect(priv.ok && priv.report.fields).toEqual({ access: 'partly', runPrivately: 'yes' });
  });
});

describe('shownFields and submissionRef', () => {
  it('gives labels and display values in field order', () => {
    expect(shownFields('evaluation', { runPrivately: 'yes', access: 'private', name: 'X' })).toEqual([
      { label: 'Name', value: 'X' },
      { label: 'Access', value: 'Private' },
      { label: 'You can run it on your side and keep the private parts private', value: 'Yes' },
    ]);
    expect(submissionRef(42)).toBe('SUB-42');
  });
});
