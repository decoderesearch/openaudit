'use client';

import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { useRef, type ReactElement, type ReactNode } from 'react';

/** A hover card that stays open on a click of its trigger. */
export function VoteHover({
  trigger,
  side,
  className,
  children,
}: {
  trigger: ReactElement;
  side?: 'right' | 'bottom';
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  return (
    <HoverCard>
      <HoverCardTrigger ref={ref} asChild>
        {trigger}
      </HoverCardTrigger>
      <HoverCardContent
        side={side}
        align="center"
        sideOffset={side === 'right' ? 8 : undefined}
        className={className}
        onPointerDownOutside={(e) => {
          if (ref.current?.contains(e.target as Node)) e.preventDefault();
        }}
      >
        {children}
      </HoverCardContent>
    </HoverCard>
  );
}
