'use client';

import { cn } from '@/lib/utils';
import { HoverCard as HoverCardPrimitive } from 'radix-ui';
import * as React from 'react';

function HoverCard({
  openDelay = 150,
  closeDelay = 100,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Root>) {
  return <HoverCardPrimitive.Root data-slot="hover-card" openDelay={openDelay} closeDelay={closeDelay} {...props} />;
}

function HoverCardTrigger({ ...props }: React.ComponentProps<typeof HoverCardPrimitive.Trigger>) {
  return <HoverCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />;
}

/** True under `sm`. A card only renders when it opens, in the browser. */
const narrow = () => typeof window !== 'undefined' && window.matchMedia('(width < 40rem)').matches;

/** Under `sm`, a card opens below its trigger and stays in the screen, as there is no room at the side. */
function HoverCardContent({
  className,
  align = 'start',
  sideOffset = 4,
  container,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Content> &
  Pick<HoverCardPrimitive.HoverCardPortalProps, 'container'>) {
  const phone = narrow();
  return (
    <HoverCardPrimitive.Portal container={container}>
      <HoverCardPrimitive.Content
        data-slot="hover-card-content"
        align={align}
        sideOffset={sideOffset}
        {...props}
        {...(phone && { side: 'bottom', align: 'center', collisionPadding: 8 })}
        className={cn(
          'z-50 w-80 max-w-[calc(100vw-2rem)] rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-md outline-hidden',
          className,
        )}
      />
    </HoverCardPrimitive.Portal>
  );
}

export { HoverCard, HoverCardContent, HoverCardTrigger };
