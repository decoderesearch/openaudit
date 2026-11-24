'use client';

import { copyToClipboard } from '@/components/copy-text';
import { Check, Copy, Link } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

/** A small icon button that copies a value, then shows a check for a short time. */
function CopyButton({ label, value, icon }: { label: string; value: () => string; icon: ReactNode }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 1500);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() =>
        copyToClipboard(value()).then(
          () => setDone(true),
          () => toast.error('Could not copy'),
        )
      }
      className="flex size-5 cursor-pointer items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
    >
      {done ? <Check className="size-3 text-emerald-600" aria-hidden /> : icon}
    </button>
  );
}

/** Buttons to copy a message's text, and a link to it. `href`: the link's path and hash. */
export function MessageActions({ text, href }: { text: string; href?: string }) {
  return (
    <span className="-my-0.5 flex items-center gap-0.5">
      <CopyButton label="Copy Message" value={() => text} icon={<Copy className="size-3" aria-hidden />} />
      {href && (
        <CopyButton
          label="Copy Link to Message"
          value={() => new URL(href, window.location.origin).href}
          icon={<Link className="size-3" aria-hidden />}
        />
      )}
    </span>
  );
}
