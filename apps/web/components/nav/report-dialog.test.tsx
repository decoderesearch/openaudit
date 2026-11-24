import { bodyOfHash, presetFromQuery, REPORT_LIMITS, submitPreset } from '@/lib/report';
import type { NavMethod } from '@/lib/server/nav-methods';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReportDialog, SubmitPageForm } from './report-dialog';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/components/link', () => ({
  default: ({ href, children, hover: _, ...p }: { href: string; hover?: boolean; children: React.ReactNode }) => (
    <a href={href} {...p}>
      {children}
    </a>
  ),
}));

const method = (slug: string, label: string, variants: string[]): NavMethod => ({
  label,
  href: `/methods/${slug}`,
  group: 'white_box',
  summary: '',
  variants: variants.map((v) => ({ label: v, href: '', summary: null, author: null, date: null, medals: [] })),
});
const METHODS = [
  method('workspace-lenses', 'Workspace Lenses', ['Jacobian Lens']),
  method('steering-vectors', 'Steering Vectors', ['CAA']),
];

function open(fields: Record<string, string> = {}) {
  render(<ReportDialog open type="method" fields={fields} methods={METHODS} />);
}
const pick = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label, { selector: 'select' }), { target: { value } });
const optionsOf = (label: string) =>
  [...screen.getByLabelText(label, { selector: 'select' }).querySelectorAll('option')].map((o) => o.textContent);

describe('presetFromQuery', () => {
  it('gives the type and its text fields from a ?submit= link', () => {
    expect(presetFromQuery('?submit=method&method=Workspace%20Lenses&variant=K&other=x')).toEqual({
      type: 'method',
      fields: { method: 'Workspace Lenses', variant: 'K' },
    });
  });

  it('is null with no type or an unknown type', () => {
    expect(presetFromQuery('')).toBeNull();
    expect(presetFromQuery('?submit=spam')).toBeNull();
  });
});

describe('submitPreset', () => {
  it('takes the type from the hash first, then ?type= or ?submit=', () => {
    expect(submitPreset('#incident', '?type=method')?.type).toBe('incident');
    expect(submitPreset('', '?type=evaluation&name=X&access=private')).toEqual({
      type: 'evaluation',
      fields: { name: 'X', access: 'private' },
    });
    expect(submitPreset('', '?submit=other')?.type).toBe('other');
    expect(submitPreset('', '?type=other&link=https://a.example/x')?.fields).toEqual({
      link: 'https://a.example/x',
    });
  });

  it('is null with no type or an unknown type', () => {
    expect(submitPreset('', '')).toBeNull();
    expect(submitPreset('#spam', '')).toBeNull();
  });

  it('takes the type from a #type=...&body=... hash, else from the query', () => {
    expect(submitPreset('#type=other&body=Hi', '')?.type).toBe('other');
    expect(submitPreset('#body=Hi', '?type=method')?.type).toBe('method');
  });
});

describe('bodyOfHash', () => {
  it('gives the decoded text of #...&body=, cut to the limit', () => {
    expect(bodyOfHash('#type=incident&body=A%20%7B%22b%22%3A1%7D%0Ac')).toBe('A {"b":1}\nc');
    expect(bodyOfHash(`#body=${'x'.repeat(REPORT_LIMITS.body + 5)}`)).toHaveLength(REPORT_LIMITS.body);
  });

  it('is empty with no body', () => {
    expect(bodyOfHash('')).toBe('');
    expect(bodyOfHash('#incident')).toBe('');
  });
});

describe('ReportDialog, Method type', () => {
  it('picks the method from a list, and names the new variant', () => {
    open();
    expect(optionsOf('Method')).toEqual(['Select', 'Steering Vectors', 'Workspace Lenses', 'New Method']);
    pick('Method', 'Steering Vectors');
    expect(screen.queryByLabelText('Variant', { selector: 'select' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Variant'), { target: { value: 'My Vector' } });
    expect(screen.getByLabelText('Variant')).toHaveProperty('value', 'My Vector');
    expect(screen.getByLabelText('Submission')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeTruthy();
  });

  it('gives a new method text boxes for the method and variant names', () => {
    open();
    pick('Method', '__new__');
    expect(screen.getByLabelText('Method name')).toBeTruthy();
    expect(screen.getByLabelText('Variant')).toBeTruthy();
    expect(screen.getByLabelText('Submission')).toBeTruthy();
  });

  it('sends a variant of a method with a harness to its submit page', () => {
    open();
    pick('Method', 'Workspace Lenses');
    expect(screen.getByRole('link', { name: /Open Instructions/ }).getAttribute('href')).toBe(
      '/methods/workspace-lenses/submit',
    );
    expect(screen.queryByLabelText('Variant')).toBeNull();
    expect(screen.queryByLabelText('Submission')).toBeNull();
    expect(screen.queryByLabelText('Link')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull();
  });

  it('shows the form for a variant that does not fit the harnesses', () => {
    open();
    pick('Method', 'Workspace Lenses');
    expect(screen.getByText(/Workspace Lenses has 2 method evaluation harnesses/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'My variant does not fit the harnesses' }));
    expect(screen.queryByRole('link', { name: /Open Instructions/ })).toBeNull();
    expect(screen.getByLabelText('Variant')).toBeTruthy();
    expect(screen.getByLabelText('Submission')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeTruthy();
    pick('Method', 'Steering Vectors');
    pick('Method', 'Workspace Lenses');
    expect(screen.getByRole('link', { name: /Open Instructions/ })).toBeTruthy();
  });

  it('keeps a start method that is not in the list as a new method', () => {
    open({ method: 'Circuit Tracing', variant: 'CLT' });
    expect(screen.getByLabelText('Method', { selector: 'select' })).toHaveProperty('value', '__new__');
    expect(screen.getByLabelText('Method name')).toHaveProperty('value', 'Circuit Tracing');
    expect(screen.getByLabelText('Variant')).toHaveProperty('value', 'CLT');
  });
});

describe('the thank-you note', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function send() {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ ok: true, ref: 'SUB-1', confirmed: false })),
    );
    fireEvent.change(screen.getByLabelText('Submission'), { target: { value: 'It sent my files.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await screen.findByText(/Thank you. We got your submission./);
    expect(screen.queryByText(/SUB-/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send another' })).toBeNull();
  }

  it('has only Close in the dialog', async () => {
    render(<ReportDialog open type="incident" />);
    await send();
    // The X of the dialog is also "Close".
    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(2);
  });

  it('has only Back to Home on the page', async () => {
    render(<SubmitPageForm start={{ type: 'incident', fields: {} }} />);
    await send();
    expect(screen.getByRole('link', { name: 'Back to Home' }).getAttribute('href')).toBe('/');
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });
});
