import { DONATE_URL } from '@/lib/legal';
import { roundUsd } from '@/lib/server/audit-estimate';
import { donateAmountStep } from '@/lib/sponsorship';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuditNotice } from './sponsor-audit';
import { sponsorComment, sponsorMailto } from './sponsor-dialog';

vi.mock('@/lib/db', () => ({ prisma: {} }));

afterEach(cleanup);

const MODEL = { name: 'meta/muse-wonder', displayName: 'Muse Wonder', path: '/meta/muse-wonder' };
const ESTIMATE = { evals: 12, older: 6, samples: 4488, evalsUsd: 342.27, cardUsd: 1.21, meterUsd: 3.52, totalUsd: 347 };

describe('roundUsd', () => {
  it('rounds to $10 under $100, else to $50, and is never 0', () => {
    expect(roundUsd(347)).toBe(350);
    expect(roundUsd(124)).toBe(100);
    expect(roundUsd(46)).toBe(50);
    expect(roundUsd(2)).toBe(10);
  });
});

describe('AuditNotice', () => {
  it('with no estimate, links to the system card', () => {
    render(<AuditNotice model={MODEL} systemCard estimate={null} />);
    expect(screen.getByText(/We don.t have any confirmed evaluations for Muse Wonder yet/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View System Card' }).getAttribute('href')).toBe(
      '/meta/muse-wonder?tab=system-card',
    );
    expect(screen.queryByRole('button', { name: 'Sponsor This Audit' })).toBeNull();
  });

  it('shows nothing with no estimate and no system card', () => {
    const { container } = render(<AuditNotice model={MODEL} systemCard={false} estimate={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('puts the system card below the sponsor estimate', () => {
    render(<AuditNotice model={MODEL} systemCard estimate={ESTIMATE} />);
    expect(screen.getByText(/Alternatively, you can/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'view the system card' }).getAttribute('href')).toBe(
      '/meta/muse-wonder?tab=system-card',
    );
    expect(screen.queryByRole('link', { name: 'View System Card' })).toBeNull();
  });

  it('shows the rounded total and each part', () => {
    render(<AuditNotice model={MODEL} systemCard estimate={ESTIMATE} />);
    expect(screen.getByText('$350')).toBeTruthy();
    expect(screen.getByText('Evaluations (12 evals, 4,488 samples)')).toBeTruthy();
    expect(screen.getByText('$342')).toBeTruthy();
    expect(screen.getByText('$1.21')).toBeTruthy();
    expect(screen.getByText('$3.52')).toBeTruthy();
  });

  it('takes sponsors when the model is newer than half or fewer of the evals', () => {
    render(<AuditNotice model={MODEL} systemCard estimate={ESTIMATE} />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText(/You can sponsor it with a donation/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sponsor This Audit' }).hasAttribute('disabled')).toBe(false);
  });

  it('warns and disables the button when the model is newer than most of the evals', () => {
    render(<AuditNotice model={MODEL} systemCard estimate={{ ...ESTIMATE, older: 7 }} />);
    expect(screen.getByRole('alert').textContent).toMatch(
      /^Evaluations UnderpoweredMuse Wonder was released after 7 of these 12 evaluations\.The evaluations use public datasets.*we do not accept sponsorships/,
    );
    expect(screen.queryByText(/You can sponsor it with a donation/)).toBeNull();
    const button = screen.getByRole('button', { name: 'Sponsor This Audit' });
    expect(button.hasAttribute('disabled')).toBe(true);
    fireEvent.click(button);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('opens the email only after the sponsor agrees to the terms', () => {
    render(<AuditNotice model={MODEL} systemCard estimate={ESTIMATE} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sponsor This Audit' }));
    expect(screen.getByText(/will get no financial or other personal benefit/)).toBeTruthy();
    const email = () => screen.getByText('Email Us').closest('a')!;
    expect(email().getAttribute('href')).toBeNull();
    expect(email().getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByRole('checkbox'));
    expect(email().getAttribute('href')).toBe(sponsorMailto(MODEL, 350));
  });

  it('opens the donation page only after the sponsor agrees, with the steps and the comment', () => {
    render(<AuditNotice model={MODEL} systemCard estimate={ESTIMATE} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sponsor This Audit' }));
    const donate = () => screen.getByText('Copy Comment and Donate').closest('a')!;
    expect(donate().getAttribute('href')).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy the comment' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(donate().getAttribute('href')).toBe(DONATE_URL);
    expect(donate().getAttribute('target')).toBe('_blank');
    expect(screen.getByText('Choose Other, then enter $350.')).toBeTruthy();
    expect(screen.getByText(sponsorComment(MODEL))).toBeTruthy();
  });
});

describe('sponsorComment', () => {
  it('names the model, links its page and the terms, and asks about AI developers', () => {
    const c = sponsorComment(MODEL);
    expect(c).toMatch(/^Sponsor the audit of Muse Wonder \(.*\/meta\/muse-wonder\)\./);
    expect(c).toContain('/terms#sponsorship');
    expect(c).toContain('Do I work for, or act for, an AI developer? (yes or no)');
  });
});

describe('donateAmountStep', () => {
  it('picks the page button for its amounts, else Other', () => {
    expect(donateAmountStep(500)).toBe('Choose $500.');
    expect(donateAmountStep(1000)).toBe('Choose $1,000.');
    expect(donateAmountStep(350)).toBe('Choose Other, then enter $350.');
    expect(donateAmountStep(1250)).toBe('Choose Other, then enter $1,250.');
  });
});

describe('sponsorMailto', () => {
  it('asks to donate the amount for the model, asks how to send it, and states the agreement', () => {
    const url = new URL(sponsorMailto(MODEL, 350));
    expect(url.pathname).toBe('support@openaudit.com');
    expect(url.searchParams.get('subject')).toBe('Sponsor the audit of Muse Wonder');
    const body = url.searchParams.get('body')!;
    expect(body).toContain('I want to donate $350 to sponsor the audit of Muse Wonder (');
    expect(body).toContain('/meta/muse-wonder');
    expect(body).toContain('Please send me the instructions to send the donation.');
    expect(body).not.toMatch(/about|estimate/i);
    expect(body).toContain('/terms#sponsorship');
    expect(body).toContain('My gift is a donation, and I will get no personal benefit from the audit.');
  });
});
