import { submissionConfirmEmail } from '@/lib/email/templates';
import type { Report } from '@/lib/report';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const count = vi.fn();
const create = vi.fn();
const sendEmail = vi.fn();
vi.mock('@/lib/db', () => ({
  prisma: {
    emailLog: { count: (...a: unknown[]) => count(...a) },
    submission: { create: (...a: unknown[]) => create(...a) },
  },
}));
vi.mock('@/lib/email/send', () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }));
vi.mock('@/lib/server/run-emails', () => ({ deliver: vi.fn() }));

const { CONFIRMS_PER_DAY, reportEmail, saveReport, sendReportConfirm } = await import('./reports');

const report = (r: Partial<Report> = {}): Report => ({
  type: 'evaluation',
  body: 'My eval <b>',
  email: 'a@b.co',
  page: '',
  fields: {},
  ...r,
});

describe('submissionConfirmEmail', () => {
  it('gives the type and the reply time, and not the reference or the text that the sender wrote', () => {
    const e = submissionConfirmEmail('Evaluation', '2–5 business days');
    expect(e.subject).not.toContain('SUB-');
    expect(e.text).not.toContain('SUB-');
    expect(e.text).toContain('evaluation submission');
    expect(e.text).toContain('2–5 business days, depending on our backlog');
    expect(e.html).toContain('2–5 business days');
  });
});

describe('saveReport', () => {
  it('stores an anonymous submission with null email and page, and returns its number', async () => {
    create.mockResolvedValue({ number: 12 });
    expect(await saveReport(report({ email: '', fields: { name: 'X' } }))).toBe(12);
    expect(create.mock.calls[0][0].data).toEqual({
      type: 'evaluation',
      body: 'My eval <b>',
      email: null,
      page: null,
      fields: { name: 'X' },
    });
  });
});

describe('reportEmail', () => {
  it('has the reference, the sender address, the fields and the escaped text', () => {
    const e = reportEmail(report({ fields: { name: 'Lie Bench', tests: 'methods' } }), 7);
    expect(e.subject).toMatch(/\[\S+ SUB-7\] Evaluation: Lie Bench$/);
    expect(e.text).toContain('From:\na@b.co');
    expect(e.text).toContain('What It Evaluates:\nSafety methods');
    expect(e.text).toContain('/admin/submissions#SUB-7');
    expect(e.html).toContain('My eval &lt;b&gt;');
  });

  it('names the variant of a method submission', () => {
    const e = reportEmail(report({ type: 'method', fields: { variant: 'K-Lens' } }), 8);
    expect(e.subject).toMatch(/SUB-8\] Method: K-Lens$/);
  });
});

describe('sendReportConfirm', () => {
  beforeEach(() => {
    count.mockReset();
    sendEmail.mockReset();
  });

  it('sends nothing to an anonymous sender', async () => {
    expect(await sendReportConfirm(report({ email: '' }))).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends a receipt, up to the daily limit for one inbox', async () => {
    count.mockResolvedValue(CONFIRMS_PER_DAY - 1);
    expect(await sendReportConfirm(report())).toBe(true);
    expect(sendEmail).toHaveBeenCalledWith(
      'a@b.co',
      'report_confirm',
      expect.objectContaining({ subject: 'We got your OpenAudit submission' }),
    );
    expect(sendEmail.mock.calls[0][2].text).not.toContain('My eval');
    count.mockResolvedValue(CONFIRMS_PER_DAY);
    expect(await sendReportConfirm(report())).toBe(false);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('does not throw when the email fails', async () => {
    count.mockResolvedValue(0);
    sendEmail.mockImplementation(async () => {
      throw new Error('down');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await sendReportConfirm(report())).toBe(false);
  });
});
