'use client';

import Link from '@/components/link';
import { usePanelRefresh } from '@/components/pdf-viewer';
import Turnstile from '@/components/turnstile';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ATTESTED_FLAG } from '@/lib/clearance-token';
import {
  attestationHeaders,
  EVAL_ACCESS_TURNSTILE_ACTION,
  HARM_PROMISE,
  NO_TRAINING_PROMISE,
  withAttestation,
  type Attestation,
} from '@/lib/eval-attestation';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { useRouter } from 'nextjs-toploader/app';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

// The reader's statement for eval content. The form sends it with a browser check; the server
// then sets a signed cookie (`lib/server/eval-clearance.ts`). The browser keeps a copy with the
// same expiry, so it knows when to ask again, and sends it with each request for eval content.

const KEY = 'openaudit.attestation.v3';
const EVENT = 'openaudit:attestation';
const DAYS = 30;

function parse(text: string | null): Attestation | null {
  try {
    const a = JSON.parse(text ?? 'null') as { client?: string; x?: number } | null;
    return a?.client === 'human' && typeof a.x === 'number' && a.x > Date.now() ? { client: 'human' } : null;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** The saved statement; null before the reader makes one, after it expires, and on the server. */
export function useAttestation(): Attestation | null {
  const text = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(KEY),
    () => null,
  );
  useEffect(takeFlag, []);
  return parse(text);
}

/** The unlock link (`lib/site-gate.ts`) sets the flag with the clearance cookie. Saves the statement. */
function takeFlag() {
  if (!document.cookie.split(';').some((c) => c.trim() === `${ATTESTED_FLAG}=1`)) return;
  document.cookie = `${ATTESTED_FLAG}=; Path=/; Max-Age=0`;
  save({ client: 'human' });
}

function save(a: Attestation | null) {
  if (a) localStorage.setItem(KEY, JSON.stringify({ ...a, x: Date.now() + DAYS * 864e5 }));
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

/** True if the reader made the statement and it did not expire. Only in the browser. */
export const hasAttestation = () => parse(localStorage.getItem(KEY)) !== null;

/** Forgets the statement, for example after the server says that the cookie expired. */
export const forgetAttestation = () => save(null);

/** The Turnstile site key (public), or null when the check is off. */
function useSiteKey(): string | null | undefined {
  const [key, setKey] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    fetch('/api/eval-access')
      .then((r) => r.json() as Promise<{ siteKey?: string | null }>)
      .then((d) => setKey(d.siteKey ?? null))
      .catch(() => setKey(null));
  }, []);
  return key;
}

/** One checkbox for "not an AI agent" and the promises, and a browser check. Only people get access. */
export function AttestationForm({ onDone }: { onDone?: (a: Attestation) => void }) {
  const siteKey = useSiteKey();
  const [promised, setPromised] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [widget, setWidget] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [unagreed, setUnagreed] = useState(false);
  const checked = siteKey === null || token !== null;

  async function submit() {
    if (!promised) return setUnagreed(true);
    if (!checked) return setError('Wait for the browser check to finish, then try again.');
    const a: Attestation = { client: 'human' };
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/eval-access', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...attestationHeaders(a) },
        body: JSON.stringify({ turnstileToken: token }),
      });
      if (!res.ok) {
        setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Try again.');
        setToken(null);
        setWidget((w) => w + 1);
        setBusy(false);
        return;
      }
      save(a);
      // Stays busy: `onDone` loads the content, which then replaces this form.
      onDone?.(a);
    } catch {
      setError('Could not reach the server. Try again.');
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-2 rounded-lg border border-rose-800 bg-rose-50 p-3 text-xs text-slate-700"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) void submit();
      }}
    >
      <p className="text-[13px] font-medium text-slate-800">
        To view evaluation content, click the checkbox to agree to our{' '}
        <Link href="/terms#ai-training" className="text-sky-800 hover:underline">
          terms
        </Link>
        .
      </p>
      <label className="flex cursor-pointer items-center gap-2">
        <span className="relative flex size-4 shrink-0">
          <input
            type="checkbox"
            aria-invalid={unagreed}
            className="peer size-4 cursor-pointer appearance-none rounded-[3px] border-2 border-slate-500 bg-white checked:border-sky-700 checked:bg-sky-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-700 aria-invalid:border-rose-600"
            checked={promised}
            onChange={(e) => {
              setPromised(e.target.checked);
              if (e.target.checked) setUnagreed(false);
            }}
          />
          <Check
            aria-hidden
            strokeWidth={3.5}
            className="pointer-events-none absolute inset-0 m-auto size-3 text-white opacity-0 peer-checked:opacity-100"
          />
        </span>
        <span>
          I am not an AI agent. {NO_TRAINING_PROMISE}. {HARM_PROMISE}.
        </span>
      </label>
      {unagreed && <p className="text-rose-700">Check the box to agree, then click Confirm and View Evals.</p>}
      {siteKey && (
        <Turnstile
          key={widget}
          siteKey={siteKey}
          action={EVAL_ACCESS_TURNSTILE_ACTION}
          appearance="interaction-only"
          onToken={setToken}
        />
      )}
      {error && <p className="text-rose-700">{error}</p>}
      <Button
        type="submit"
        size="sm"
        disabled={busy}
        className="-mt-0.5 self-start bg-emerald-700 text-[11px] font-semibold tracking-wide uppercase hover:bg-emerald-800"
      >
        {/* Both labels share one cell, so the width stays the same. */}
        <span className="grid justify-items-center">
          <span aria-hidden={busy} className={cn('col-start-1 row-start-1', busy && 'invisible')}>
            Confirm and View Evals
          </span>
          <span aria-hidden={!busy} className={cn('col-start-1 row-start-1', !busy && 'invisible')}>
            Confirming…
          </span>
        </span>
      </Button>
    </form>
  );
}

/**
 * A download link for eval content. `cleared`: the server saw a valid cookie (or staff). Without
 * it, or without a saved statement, a click asks for the statement first.
 */
export function AttestedLink({
  href,
  cleared,
  className,
  children,
  onOpen,
}: {
  href: string;
  cleared: boolean;
  className?: string;
  children: ReactNode;
  /** In place of opening `href`: what to do with it (with the statement). */
  onOpen?: (url: string) => void;
}) {
  const attestation = useAttestation();
  const [open, setOpen] = useState(false);
  if (cleared && attestation) {
    const url = withAttestation(href, attestation);
    return onOpen ? (
      <button type="button" onClick={() => onOpen(url)} className={className}>
        {children}
      </button>
    ) : (
      <a href={url} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={className}>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-80 border-0 bg-transparent p-0">
        <AttestationForm
          onDone={(a) => {
            setOpen(false);
            const url = withAttestation(href, a);
            if (onOpen) onOpen(url);
            else window.location.assign(url);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** For a page or side panel with sample text that the server hid: the form, then the page again. */
export function EvalAccessGate() {
  const router = useRouter();
  const refreshPanel = usePanelRefresh();
  return (
    <AttestationForm
      onDone={() => {
        refreshPanel?.();
        router.refresh();
      }}
    />
  );
}
