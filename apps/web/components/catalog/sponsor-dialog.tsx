'use client';

import { copyToClipboard } from '@/components/copy-text';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { NEXT_PUBLIC_URL, SUPPORT_EMAIL } from '@/lib/env';
import { DONATE_URL } from '@/lib/legal';
import { donateAmountStep, SPONSORSHIP_HASH, SPONSORSHIP_TERMS } from '@/lib/sponsorship';
import { cn } from '@/lib/utils';
import { Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

/** The email that a sponsor sends us: a donation of `usd` for the model's audit, and the agreement. */
export function sponsorMailto(model: { displayName: string; path: string }, usd: number): string {
  const subject = `Sponsor the audit of ${model.displayName}`;
  const body = [
    `I want to donate $${usd} to sponsor the audit of ${model.displayName} (${NEXT_PUBLIC_URL}${model.path}).`,
    'Please send me the instructions to send the donation.',
    '',
    `I agree to the audit sponsorship terms (${NEXT_PUBLIC_URL}/terms#${SPONSORSHIP_HASH}). My gift is a donation, and I will get no personal benefit from the audit.`,
    '',
    'Name:',
    'Organization (if any):',
    'Do you work for, or act for, an AI developer?',
  ].join('\n');
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** The comment that a sponsor puts on the donation page: the model, and the agreement. The page
 * cannot take it from a link, so the sponsor copies it. */
export function sponsorComment(model: { displayName: string; path: string }): string {
  return [
    `Sponsor the audit of ${model.displayName} (${NEXT_PUBLIC_URL}${model.path}).`,
    `I agree to the audit sponsorship terms (${NEXT_PUBLIC_URL}/terms#${SPONSORSHIP_HASH}).`,
    'Do I work for, or act for, an AI developer? (yes or no)',
  ].join(' ');
}

const copyComment = (comment: string) =>
  copyToClipboard(comment).then(
    () => toast.success('Copied the comment. Paste it in Comment on the donation page.'),
    () => toast.error('Could not copy the comment. Select it and copy it.'),
  );

/** The sponsor terms and a box to agree to them, then the steps to donate on the sponsor's
 * donation page. An email to us is the other way. `disabled`: only the button, which does not open. */
export function SponsorDialog({
  model,
  usd,
  disabled,
}: {
  model: { displayName: string; path: string };
  usd: number;
  disabled?: boolean;
}) {
  const [agreed, setAgreed] = useState(false);
  const comment = sponsorComment(model);
  if (disabled)
    return (
      <Button size="sm" disabled className="bg-sky-700 text-white">
        Sponsor This Audit
      </Button>
    );
  return (
    <Dialog onOpenChange={(o) => !o && setAgreed(false)}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-sky-700 text-white hover:bg-sky-800">
          Sponsor This Audit
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined} className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Sponsor the Audit of {model.displayName}</DialogTitle>
        </DialogHeader>
        <ul className="flex list-disc flex-col gap-y-1.5 pl-5 text-xs text-slate-700">
          {SPONSORSHIP_TERMS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm font-medium text-slate-900">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-sky-700"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>
            I agree to these terms and to the{' '}
            <a href={`/terms#${SPONSORSHIP_HASH}`} target="_blank" className="text-sky-700 underline">
              Terms of Service
            </a>
            .
          </span>
        </label>
        <section
          aria-label="How to donate"
          className={cn(
            'flex flex-col gap-y-2 rounded-md bg-slate-50 p-3 text-xs text-slate-700',
            !agreed && 'opacity-50',
          )}
        >
          <ol className="flex list-decimal flex-col gap-y-1 pl-5">
            <li>Copy the comment below, and open the donation page.</li>
            <li>{donateAmountStep(usd)}</li>
            <li>Paste the comment in Comment, and answer its question. It tells us which model to audit.</li>
            <li>Enter your email, then complete the payment.</li>
          </ol>
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1.5 font-mono text-[11px] break-words text-slate-600 select-all">
              {comment}
            </p>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Copy the comment"
              disabled={!agreed}
              onClick={() => void copyComment(comment)}
            >
              <Copy />
            </Button>
          </div>
        </section>
        <DialogFooter className="items-center gap-2 sm:justify-between">
          <Button asChild size="sm" variant="outline" className={cn(!agreed && 'pointer-events-none opacity-50')}>
            <a href={agreed ? sponsorMailto(model, usd) : undefined} aria-disabled={!agreed} tabIndex={agreed ? 0 : -1}>
              Email Us
            </a>
          </Button>
          <Button
            asChild
            size="sm"
            className={cn('bg-sky-700 text-white hover:bg-sky-800', !agreed && 'pointer-events-none opacity-50')}
          >
            <a
              href={agreed ? DONATE_URL : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!agreed}
              tabIndex={agreed ? 0 : -1}
              onClick={() => void copyComment(comment)}
            >
              Copy Comment and Donate
              <ExternalLink />
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
