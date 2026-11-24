'use client';

import Link from '@/components/link';
import Turnstile from '@/components/turnstile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { TURNSTILE_ACTION } from '@/lib/sign-in';
import { Mail } from 'lucide-react';
import { useCallback, useState } from 'react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Email magic-link sign-in. A new email becomes a new account, and onboarding runs next. With a
// Turnstile site key, the form sends only after the browser check passes. `bare`: no card or
// title, for a dialog.
export default function SignInForm({
  returnTo,
  turnstileSiteKey,
  bare,
}: {
  returnTo: string;
  turnstileSiteKey: string | null;
  bare?: boolean;
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  const onToken = useCallback((token: string | null) => setCaptchaToken(token), []);
  const waitingForCheck = Boolean(turnstileSiteKey) && !captchaToken;

  async function submit() {
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    if (waitingForCheck) {
      setError('Wait for the browser check to finish.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await authClient.signIn.magicLink({
      email: trimmed,
      name: trimmed.split('@')[0],
      callbackURL: returnTo,
      newUserCallbackURL: `/onboarding?returnTo=${encodeURIComponent(returnTo)}`,
      fetchOptions: captchaToken ? { headers: { 'x-captcha-response': captchaToken } } : undefined,
    });
    setBusy(false);
    // A Turnstile token works once. Get a new one for the next try.
    if (turnstileSiteKey) {
      setCaptchaToken(null);
      setWidgetKey((k) => k + 1);
    }
    if (err) {
      setError(err.message ?? 'Could not send the sign-in link.');
      return;
    }
    setSent(true);
  }

  const body = sent ? (
    <div
      role="status"
      className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
    >
      Check <span className="font-medium">{email.trim()}</span> for the sign-in link.
    </div>
  ) : (
    <form
      className="flex flex-col gap-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="flex flex-col gap-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.org"
        />
      </div>
      {error && (
        <div role="alert" className="text-xs text-red-600">
          {error}
        </div>
      )}
      {turnstileSiteKey && (
        <Turnstile key={widgetKey} siteKey={turnstileSiteKey} action={TURNSTILE_ACTION} onToken={onToken} />
      )}
      <Button type="submit" disabled={busy || waitingForCheck}>
        <Mail />
        {busy ? 'Sending…' : waitingForCheck ? 'Checking your browser…' : 'Send sign-in link'}
      </Button>
      <p className="text-xs text-slate-500">
        By signing in, you agree to the{' '}
        <Link href="/terms" className="text-sky-800 underline">
          Terms of Service
        </Link>{' '}
        and the{' '}
        <Link href="/privacy" className="text-sky-800 underline">
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
  if (bare) return body;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sky-800">Sign in or sign up</CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
