'use client';

import type { EvalListRow } from '@/components/catalog/eval-browser';
import { BestWorst, Leaders } from '@/components/catalog/leaders';
import { TOPIC_LABELS } from '@/components/catalog/parts';
import { EvalLink } from '@/components/eval-link';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { monthYear } from '@/lib/card-heading';
import { cn } from '@/lib/utils';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { useRouter } from 'nextjs-toploader/app';
import type { MouseEvent } from 'react';

/** What each kind of eval tests, for a hover on the kind. */
const KIND_INFO: Record<EvalListRow['kind'], string> = {
  model: 'Tests an AI model for unsafe behavior, for example help with weapons or lies under pressure.',
  method: 'Tests how well a safety method, for example a probe or a sparse autoencoder, does its safety job.',
};

/** The home hero's "Evaluation of the Day": its name, topic, creator and date (with "Needs Update"
 * when most of a model eval's models are newer than it), and summary. Then a
 * model eval's best and worst 3, or a method eval's best 3 with medals. A click that is not on a
 * link or a text selection opens the eval. */
export function EvalOfTheDay({ row: r, className }: { row: EvalListRow; className?: string }) {
  const router = useRouter();
  const href = `/evaluations/${r.slug}`;
  const open = (ev: MouseEvent) =>
    !(ev.target as Element).closest('a') && !getSelection()?.toString() && router.push(href);
  const topic = r.topics[0] && ((TOPIC_LABELS as Record<string, string>)[r.topics[0]] ?? r.topics[0]);
  const date = monthYear(r.date);
  // A model eval that most of its models came out after.
  const old = r.kind === 'model' && (r.newer ?? 0) * 2 > r.count;
  return (
    <section
      aria-label="Evaluation of the Day"
      onClick={open}
      className={cn(
        'group/eval flex cursor-pointer flex-col gap-y-3 rounded-2xl bg-white p-4 text-left shadow-xl ring-1 ring-sky-950/10 transition-shadow hover:ring-sky-300 sm:p-5',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-x-3 text-[10px] font-bold tracking-wider uppercase">
        <span className="flex items-center gap-x-1.5 text-sky-700">
          <CalendarDays aria-hidden className="size-3.5" />
          Evaluation of the Day
        </span>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help text-slate-400 underline decoration-dotted underline-offset-2">
                {r.kind === 'model' ? 'Model Evaluation' : 'Method Evaluation'}
              </span>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              sideOffset={4}
              className="max-w-64 text-xs font-normal tracking-normal normal-case"
            >
              {KIND_INFO[r.kind]}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex min-w-0 flex-col gap-y-0.5">
        <span className="flex min-w-0 items-baseline gap-x-2">
          <EvalLink
            slug={r.slug}
            side="left"
            className="min-w-0 truncate text-base font-semibold text-slate-800 group-hover/eval:text-sky-800 group-hover/eval:underline sm:text-lg"
          >
            {r.label}
          </EvalLink>
          {topic && (
            <span className="shrink-0 text-[10px] font-bold tracking-wide text-slate-400 uppercase">{topic}</span>
          )}
        </span>
        {(r.creator || date || old) && (
          <span className="flex min-w-0 items-center justify-between gap-x-3">
            <span className="truncate text-xs text-slate-500">
              {r.creator}
              {r.creator && date && ' · '}
              {date && <span className="text-slate-400">{date}</span>}
            </span>
            {old && (
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="shrink-0 cursor-help rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold tracking-wide text-rose-700 uppercase">
                      Needs Update
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4} className="max-w-64 text-xs">
                    {r.newer} of the {r.count} models were released after this evaluation, so positive results are
                    not reliable.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </span>
        )}
        {r.summary && <p className="mt-1.5 line-clamp-2 text-xs/snug text-slate-600">{r.summary}</p>}
      </div>
      {r.kind === 'model' ? (
        <BestWorst
          best={r.best}
          worst={r.worst}
          ranked={false}
          warnBest
          className="[&_ol_a]:font-medium [&_ol_a]:text-slate-600"
        />
      ) : (
        <Leaders
          leaders={r.top ?? r.best}
          medals
          scores={false}
          barClassName="h-2"
          nameClassName="text-xs"
          className="gap-y-2 [&_a]:font-medium [&_a]:text-slate-600"
        />
      )}
      <span className="-mt-1 flex items-center gap-x-1 self-end text-[11px] font-semibold text-sky-700 group-hover/eval:underline">
        Open Evaluation
        <ArrowRight aria-hidden className="size-3" />
      </span>
    </section>
  );
}
