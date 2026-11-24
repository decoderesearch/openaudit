'use client';

import { InfoPopover } from '@/components/info-popover';
import { openSubmitForm } from '@/components/nav/report-dialog';
import { Button } from '@/components/ui/button';
import { SITE_NAME } from '@/lib/env';
import { cn } from '@/lib/utils';
import { CirclePlus } from 'lucide-react';

/** The "Beta" mark beside the logo. Hover or tap shows the note, with a button to the Submit form. */
export function BetaBadge({ className }: { className?: string }) {
  return (
    <InfoPopover
      label="Beta"
      trigger="Beta"
      triggerClassName={cn(
        'cursor-pointer text-[10px] leading-none font-bold tracking-wide text-amber-700 uppercase no-underline hover:text-amber-800',
        className,
      )}
      contentClassName="flex w-64 flex-col items-start gap-y-3 text-xs leading-5 text-slate-700"
    >
      <p>{SITE_NAME} is in public beta. Data and code may be incorrect.</p>
      <Button type="button" variant="outline" size="xs" onClick={() => openSubmitForm('other')}>
        <CirclePlus />
        Report an Issue
      </Button>
    </InfoPopover>
  );
}
