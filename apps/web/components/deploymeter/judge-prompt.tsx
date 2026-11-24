import Link from '@/components/link';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/** A button that opens the panel's system prompts in a popover. A click opens and closes it. */
export function JudgePrompt({
  version,
  judge,
  guess,
  className,
  inModal,
}: {
  version: string;
  judge: string;
  guess: string | null;
  className?: string;
  /** In a modal: render the popover in place, so that it scrolls. */
  inModal?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger className={cn('text-sky-800 hover:underline', className)}>Judge Prompt</PopoverTrigger>
      <PopoverContent
        align="end"
        portal={!inModal}
        className="flex max-h-[min(36rem,var(--radix-popover-content-available-height))] w-[40rem] max-w-[calc(100vw-2rem)] flex-col gap-y-2"
      >
        <div className="flex items-baseline justify-between gap-x-3">
          <p className="font-semibold text-slate-800">
            The judge prompt <span className="font-mono font-normal text-slate-500">{version}</span>
          </p>
          <Link href="/judges#prompts" className="shrink-0 text-[11px] text-sky-800 hover:underline">
            All versions
          </Link>
        </div>
        <pre className="min-h-0 flex-1 overflow-auto overscroll-contain rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed whitespace-pre-wrap text-slate-700">
          {judge}
        </pre>
        {guess && (
          <details className="shrink-0">
            <summary className="cursor-pointer text-[11px] font-medium text-sky-800 hover:underline">
              The guess prompt: a second call asks the judge to guess the developer
            </summary>
            <pre className="mt-1.5 rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed whitespace-pre-wrap text-slate-700">
              {guess}
            </pre>
          </details>
        )}
      </PopoverContent>
    </Popover>
  );
}
