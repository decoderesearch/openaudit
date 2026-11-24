'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CircleHelp } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';

/** A question-mark icon (or `trigger`) that shows `children` on hover (desktop) or tap (touch).
 * `click`: only on a click or tap. `triggerClassName`: added to the trigger's classes. */
export function InfoPopover({
  label,
  children,
  trigger,
  click,
  triggerClassName,
  iconClassName = 'size-4',
  contentClassName,
}: {
  label: string;
  children: ReactNode;
  trigger?: ReactNode;
  click?: boolean;
  triggerClassName?: string;
  iconClassName?: string;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // A hover does not move the focus into the popover; a click or a key does.
  const byHover = useRef(false);
  const show = () => {
    clearTimeout(closeTimer.current);
    byHover.current = !open;
    setOpen(true);
  };
  // A short delay lets the pointer move from the icon to the popover.
  const hide = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        byHover.current = false;
        setOpen(o);
      }}
    >
      <PopoverTrigger
        aria-label={trigger ? undefined : `About ${label}`}
        className={cn(
          trigger
            ? cn(
                'text-sky-800 underline decoration-dotted underline-offset-2 hover:text-sky-900',
                click ? 'cursor-pointer' : 'cursor-help',
              )
            : 'inline-flex text-slate-400 transition-colors hover:text-slate-600',
          triggerClassName,
        )}
        onPointerEnter={(e) => !click && e.pointerType === 'mouse' && show()}
        onPointerLeave={(e) => !click && e.pointerType === 'mouse' && hide()}
      >
        {trigger ?? <CircleHelp className={iconClassName} />}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={contentClassName}
        onOpenAutoFocus={(e) => byHover.current && e.preventDefault()}
        onPointerEnter={click ? undefined : show}
        onPointerLeave={click ? undefined : hide}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
