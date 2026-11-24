import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SignInForm from './sign-in-form';

const magicLink = vi.fn();
vi.mock('@/lib/auth-client', () => ({
  authClient: { signIn: { magicLink: (...a: unknown[]) => magicLink(...a) } },
}));
// A stand-in for the Cloudflare widget: one button passes the check.
vi.mock('@/components/turnstile', () => ({
  default: ({ onToken }: { onToken: (t: string | null) => void }) => (
    <button type="button" onClick={() => onToken('turnstile-token')}>
      Pass check
    </button>
  ),
}));

describe('SignInForm', () => {
  beforeEach(() => {
    magicLink.mockReset();
    magicLink.mockResolvedValue({ error: null });
  });

  it('sends the link without a check when Turnstile is off', async () => {
    const user = userEvent.setup();
    render(<SignInForm returnTo="/settings" turnstileSiteKey={null} />);
    await user.type(screen.getByLabelText('Email'), 'Jane@Example.org');
    await user.click(screen.getByRole('button', { name: 'Send sign-in link' }));
    expect(magicLink).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'jane@example.org', fetchOptions: undefined }),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Check Jane@Example.org for the sign-in link.');
  });

  it('waits for the check, then sends its token in the header', async () => {
    const user = userEvent.setup();
    render(<SignInForm returnTo="/" turnstileSiteKey="site-key" />);
    await user.type(screen.getByLabelText('Email'), 'jane@example.org');
    expect(screen.getByRole('button', { name: 'Checking your browser…' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Pass check' }));
    await user.click(screen.getByRole('button', { name: 'Send sign-in link' }));
    expect(magicLink).toHaveBeenCalledWith(
      expect.objectContaining({ fetchOptions: { headers: { 'x-captcha-response': 'turnstile-token' } } }),
    );
  });

  it('shows the server message when the limit is reached, and needs a new check', async () => {
    const user = userEvent.setup();
    magicLink.mockResolvedValue({ error: { message: 'We sent several sign-in emails to this address.' } });
    render(<SignInForm returnTo="/" turnstileSiteKey="site-key" />);
    await user.type(screen.getByLabelText('Email'), 'jane@example.org');
    await user.click(screen.getByRole('button', { name: 'Pass check' }));
    await user.click(screen.getByRole('button', { name: 'Send sign-in link' }));
    expect(screen.getByRole('alert')).toHaveTextContent('We sent several sign-in emails to this address.');
    expect(screen.getByRole('button', { name: 'Checking your browser…' })).toBeDisabled();
  });
});
