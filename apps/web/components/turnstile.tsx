'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

type TurnstileApi = {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      size?: 'normal' | 'flexible' | 'compact';
      appearance?: 'always' | 'interaction-only';
      callback: (token: string) => void;
      'expired-callback': () => void;
      'before-interactive-callback': () => void;
      'error-callback': (code: string) => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const CHECK_TIMEOUT_MS = 15_000;

export const TURNSTILE_BLOCKED =
  'The browser check did not load. An ad blocker or privacy setting can stop it. Allow challenges.cloudflare.com, then reload the page.';
export const TURNSTILE_FAILED = 'The browser check failed. Reload the page and try again.';

// The Cloudflare Turnstile widget. It calls `onToken` with a token, or with null when the token
// expires or the check fails. A token works once: give the widget a new `key` to get another.
// With `appearance="interaction-only"`, it is visible only when the user must do a challenge.
export default function Turnstile({
  siteKey,
  action,
  onToken,
  appearance = 'always',
}: {
  siteKey: string;
  action: string;
  onToken: (token: string | null) => void;
  appearance?: 'always' | 'interaction-only';
}) {
  const el = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  });

  useEffect(() => {
    // `loaded` re-runs this when the script arrives; the script may also be there already.
    const api = window.turnstile;
    if (!api || !el.current) return;
    // A blocked challenge request gives no error callback, so stop waiting after a time.
    const slow = setTimeout(() => setProblem(TURNSTILE_BLOCKED), CHECK_TIMEOUT_MS);
    const id = api.render(el.current, {
      sitekey: siteKey,
      action,
      size: 'flexible',
      appearance,
      callback: (token) => {
        clearTimeout(slow);
        setProblem(null);
        onTokenRef.current(token);
      },
      'expired-callback': () => onTokenRef.current(null),
      'before-interactive-callback': () => clearTimeout(slow),
      'error-callback': (code) => {
        clearTimeout(slow);
        console.warn(`[turnstile] error ${code}`);
        setProblem(TURNSTILE_FAILED);
        onTokenRef.current(null);
      },
    });
    return () => {
      clearTimeout(slow);
      api.remove(id);
    };
  }, [loaded, siteKey, action, appearance]);

  return (
    <>
      <Script
        src={SCRIPT_URL}
        strategy="afterInteractive"
        onReady={() => setLoaded(true)}
        onError={() => setProblem(TURNSTILE_BLOCKED)}
      />
      <div ref={el} className={appearance === 'always' ? 'min-h-[65px]' : undefined} />
      {problem && (
        <div role="alert" className="text-xs text-red-600">
          {problem}
        </div>
      )}
    </>
  );
}
