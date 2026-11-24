'use client';

import { ACTION } from '@/components/catalog/model-actions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

/** A dropdown at the top right of a page that opens when the URL fragment is one of `anchors`. */
export function HashMenu({
  name,
  anchors,
  className,
  children,
}: {
  name: string;
  anchors: string[];
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const check = () => {
      if (anchors.includes(decodeURIComponent(window.location.hash.slice(1)))) setOpen(true);
    };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, [anchors]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={cn(ACTION, 'group bg-white')}>
        {name}
        <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={8}
        className={cn(
          'max-h-[min(36rem,var(--radix-popover-content-available-height))] overflow-auto overscroll-contain p-0',
          className,
        )}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
