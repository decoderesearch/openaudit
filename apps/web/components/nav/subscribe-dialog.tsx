'use client';

import Link from '@/components/link';
import { NAV_ITEM } from '@/components/nav/nav-menu';
import Turnstile from '@/components/turnstile';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SUBSCRIBE_TURNSTILE_ACTION, UPDATE_LISTS } from '@/lib/updates';
import { cn } from '@/lib/utils';
import { Bell } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

// The navbar's "Updates" button. A signed-in user goes to Settings. Others give an
// email address and one consent for all lists, and get a confirm link; the updates start when
// they confirm.

type State = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'error'; message: string };

// Below xl the navbar has no room for the words, so only the bell shows.
const CLS = cn(NAV_ITEM, 'hidden hover:bg-sky-50 sm:flex');
const LABEL = 'Subscribe for Updates';
const Text = () => <span className="hidden xl:inline">Updates</span>;

export function SubscribeButton({ signedIn }: { signedIn: boolean }) {
  if (signedIn)
    return (
      <Link href="/settings#email-updates" aria-label={LABEL} title={LABEL} className={CLS}>
        <Bell />
        <Text />
      </Link>
    );
  return <SubscribeDialog />;
}

/** The Turnstile site key (public), or null when the check is off. Asked once, at first open. */
function useSiteKey(open: boolean): string | null | undefined {
  const [key, setKey] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!open || key !== undefined) return;
    fetch('/api/updates/subscribe')
      .then((r) => r.json() as Promise<{ siteKey?: string | null }>)
      .then((d) => setKey(d.siteKey ?? null))
      .catch(() => setKey(null));
  }, [open, key]);
  return key;
}

/** The subscribe form in a dialog. With `open`, the parent opens and closes it, and there is no
 * button. */
export function SubscribeDialog({
  open: openProp,
  onOpenChange,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
} = {}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = openProp ?? ownOpen;
  const setOpen = (o: boolean) => {
    if (openProp === undefined) setOwnOpen(o);
    onOpenChange?.(o);
  };
  const turnstileSiteKey = useSiteKey(open);
  const [email, setEmail] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [token, setToken] = useState<string | null>(null);
  // A token works once: a new key gives a new widget and a new token.
  const [widget, setWidget] = useState(0);
  const checked = turnstileSiteKey === null || token !== null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState({ kind: 'sending' });
    try {
      const res = await fetch('/api/updates/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, lists: UPDATE_LISTS.map((l) => l.id), turnstileToken: token }),
      });
      if (res.ok) return setState({ kind: 'sent' });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setState({ kind: 'error', message: data?.error ?? 'We could not send the email. Try again later.' });
    } catch {
      setState({ kind: 'error', message: 'We could not send the email. Check your connection and try again.' });
    } finally {
      setToken(null);
      setWidget((n) => n + 1);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o && state.kind === 'sent') setState({ kind: 'idle' });
      }}
    >
      {openProp === undefined && (
        <DialogTrigger asChild>
          <button type="button" className={CLS} aria-label={LABEL} title={LABEL}>
            <Bell />
            <Text />
          </button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Get Updates</DialogTitle>
          <DialogDescription className="text-xs">Max one email per week, unsubscribe anytime.</DialogDescription>
        </DialogHeader>
        {state.kind === 'sent' ? (
          <div className="flex flex-col gap-y-4">
            <p className="text-sm text-slate-700">
              We sent a confirm link to <span className="font-medium">{email}</span>. Open it to start the updates.
            </p>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Close</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-y-4">
            <Input
              type="email"
              required
              autoComplete="email"
              aria-label="Email"
              value={email}
              maxLength={254}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <label className="-mb-1.5 flex cursor-pointer items-start gap-2.5 text-xs text-slate-700">
              <input
                type="checkbox"
                required
                className="mt-0.5 size-4 shrink-0 accent-sky-700"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              I want to receive updates from OpenAudit.
            </label>
            {turnstileSiteKey && (
              <Turnstile
                key={widget}
                siteKey={turnstileSiteKey}
                action={SUBSCRIBE_TURNSTILE_ACTION}
                appearance="interaction-only"
                onToken={setToken}
              />
            )}
            {state.kind === 'error' && <p className="text-sm text-red-600">{state.message}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={state.kind === 'sending' || !email.trim() || !agreed || !checked}>
                {state.kind === 'sending' ? 'Sending…' : 'Subscribe'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
