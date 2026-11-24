'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDate } from '@/lib/org-research';
import { releasedAfter } from '@/lib/release-dates';
import { cn } from '@/lib/utils';
import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';

/** An amber triangle when the model came out after the eval (`releasedAfter`). A hover or focus
 * shows the warning; a tap too, on a phone. Nothing otherwise. It is above a row's full-size link. */
export function ReleaseWarning({
  model,
  evalDate,
  className,
}: {
  model?: string | null;
  evalDate?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!releasedAfter(model, evalDate)) return null;
  const text = `The model was released (${formatDate(model)}) after the eval (${formatDate(evalDate)}). The eval data can be in the model's training data, so the results may not be reliable.`;
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={text}
          onClick={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
          className={cn('relative z-10 inline-flex cursor-help align-[-2px] text-amber-500', className)}
        >
          <TriangleAlert aria-hidden className="size-3.5" strokeWidth={2.25} />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-left font-normal">{text}</TooltipContent>
    </Tooltip>
  );
}
