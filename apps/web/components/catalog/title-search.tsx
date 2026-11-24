'use client';

import { INSET_TITLE } from '@/components/box-title';
import { InfoPopover } from '@/components/info-popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Search, X } from 'lucide-react';
import type { ReactNode } from 'react';

/** A box's title (`INSET_TITLE`, a little larger) after `icon`. `info`: shown from a help icon at its right. */
export function BoxTitle({ title, icon, info }: { title: string; icon?: ReactNode; info?: ReactNode }) {
  return (
    <h2
      className={cn(
        INSET_TITLE,
        'flex min-w-0 shrink-0 items-center gap-x-1.5 text-xs [&_svg]:size-3.5 [&_svg]:shrink-0',
      )}
    >
      {icon}
      <span className="truncate">{title}</span>
      {info && (
        <InfoPopover label={title} contentClassName="w-72 text-xs font-normal tracking-normal normal-case">
          {info}
        </InfoPopover>
      )}
    </h2>
  );
}

/** The input of a `SearchToggle`. Escape calls `onClose`. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  onClose,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onClose: () => void;
  className?: string;
}) {
  return (
    <Input
      type="search"
      autoFocus
      aria-label={placeholder}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className={cn('h-6 max-w-56 min-w-0 flex-1 bg-white text-xs sm:h-6 md:text-xs', className)}
    />
  );
}

/** A search toggle for a box's head, with the box's other buttons at its right (`children`). When
 * the search is open, its input is at the left of the toggle; a click on the toggle closes it and
 * clears it. `plain`: the toggle is only its icon, in slate. `start`: the toggle is at the left, after
 * the title, and the input is at its right. `detached`: no input; the caller shows a `SearchInput`. */
export function SearchToggle({
  open,
  onOpenChange,
  value,
  onChange,
  placeholder,
  plain,
  start,
  detached,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  plain?: boolean;
  start?: boolean;
  detached?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const close = () => {
    onOpenChange(false);
    onChange('');
  };
  const input = !detached && (
    <SearchInput value={value} onChange={onChange} placeholder={placeholder} onClose={close} />
  );
  const toggle = (
    <button
      type="button"
      aria-label={open ? 'Close search' : 'Show search'}
      aria-pressed={open}
      onClick={() => (open ? close() : onOpenChange(true))}
      className={cn(
        'flex size-6 shrink-0 cursor-pointer items-center justify-center transition-colors',
        plain
          ? 'text-slate-500 hover:text-slate-800'
          : open
            ? 'rounded-full border border-sky-700 bg-sky-50 text-sky-800'
            : 'rounded-full border border-slate-200 bg-white text-slate-500 hover:text-slate-800',
      )}
    >
      {open ? <X className="size-3.5" /> : <Search className="size-3.5" />}
    </button>
  );
  return (
    <span className={cn('flex min-w-0 flex-1 items-center gap-2', start ? 'justify-start' : 'justify-end', className)}>
      {open && !start && input}
      {toggle}
      {open && start && input}
      {children}
    </span>
  );
}
