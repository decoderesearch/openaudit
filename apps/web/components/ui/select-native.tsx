import { cn } from '@/lib/utils';
import * as React from 'react';

// A styled native <select>: the phone's own picker, and no portal.
function SelectNative({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      data-slot="select-native"
      className={cn(
        'h-10 w-full min-w-0 rounded-md border border-input bg-white px-3 text-base text-slate-700 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 sm:h-9 sm:text-sm',
        className,
      )}
      {...props}
    />
  );
}

export { SelectNative };
