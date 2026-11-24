'use client';

import { PILL_BUTTON } from '@/components/cite-badge';
import Link from '@/components/link';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { FileText } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';

/** Who can get an eval's samples: label, hover text and pill colour. */
const ACCESS: Record<string, [string, string, string]> = {
  public: ['public', 'Anyone can get the samples.', 'bg-emerald-50 text-emerald-700'],
  gated: ['gated', "Anyone can get the samples after they agree to the source's terms.", 'bg-sky-50 text-sky-700'],
  held_out: ['held out', 'The maintainer keeps the samples back.', 'bg-amber-50 text-amber-700'],
  lab_internal: ['lab internal', 'Only the lab has the samples.', 'bg-rose-50 text-rose-700'],
};

type Eval = { slug: string; displayName: string; description: string | null; access: string };

/**
 * A table row that shows its eval on mouse hover or on a click. A click that selects text or hits
 * a link or button does not open it.
 */
export function EvalRow({ eval: e, className, children }: { eval: Eval; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const later = (fn: () => void, ms: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  };
  const keep = () => clearTimeout(timer.current);
  const hide = () => later(() => setOpen(false), 150);
  const [label, why, colour] = ACCESS[e.access] ?? [e.access.replaceAll('_', ' '), '', 'bg-slate-100 text-slate-700'];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <tr
          className={cn('cursor-default', open && 'bg-slate-50', className)}
          onPointerEnter={(ev) => ev.pointerType === 'mouse' && later(() => setOpen(true), 300)}
          onPointerLeave={(ev) => ev.pointerType === 'mouse' && (open ? hide() : keep())}
          onClick={(ev) => {
            if ((ev.target as HTMLElement).closest('a, button') || getSelection()?.toString()) return;
            keep();
            setOpen(true);
          }}
        >
          {children}
        </tr>
      </PopoverAnchor>
      <PopoverContent
        side="left"
        align="start"
        sideOffset={8}
        onPointerEnter={keep}
        onPointerLeave={hide}
        onOpenAutoFocus={(ev) => ev.preventDefault()}
        onCloseAutoFocus={(ev) => ev.preventDefault()}
      >
        <div className="flex items-start justify-between gap-x-2">
          <div className="font-medium text-slate-800">{e.displayName}</div>
          <span
            title={why}
            className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[9px]/[12px] font-medium uppercase', colour)}
          >
            {label}
          </span>
        </div>
        {e.description && <p className="mt-1.5 leading-relaxed">{e.description}</p>}
        <Link href={`/evaluations/${e.slug}`} className={cn(PILL_BUTTON, 'mt-2.5')}>
          <FileText />
          Eval page
        </Link>
      </PopoverContent>
    </Popover>
  );
}
