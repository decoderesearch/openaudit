'use client';

import { copyToClipboard } from '@/components/copy-text';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Copy } from 'lucide-react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

/** A prompt for a coding agent, with a button under it in the same box that copies it.
 * `children`: more buttons, to its right. `buttonClassName`: the copy button's colors. */
export function CopyPrompt({
  text,
  children,
  buttonClassName = 'bg-emerald-700 hover:bg-emerald-800',
}: {
  text: string;
  children?: ReactNode;
  buttonClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 px-4 pt-2.5 pb-3.5">
      <pre className="overflow-x-auto text-xs/relaxed whitespace-pre-wrap text-slate-700">{text}</pre>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className={cn('h-7 text-xs text-white sm:h-7', buttonClassName)}
          onClick={() =>
            copyToClipboard(text).then(
              () => toast.success('Copied the agent prompt'),
              () => toast.error('Could not copy the agent prompt'),
            )
          }
        >
          <Copy aria-hidden className="size-3" />
          Copy Prompt
        </Button>
        {children}
      </div>
    </div>
  );
}
