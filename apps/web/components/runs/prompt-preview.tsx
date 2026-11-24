'use client';

import { ChatMarkdown } from '@/components/chat';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

/** The heading of a part in the dialog. */
const HEADING = 'text-[10px] font-semibold tracking-wide text-slate-500 uppercase';

const BOX = 'rounded-lg bg-slate-100 px-3 py-2 text-sm wrap-anywhere text-slate-800';

/** One prompt of an attempt. `parts`: its full text in the dialog. `markdown`: show the text as Markdown. */
export type PromptRow = {
  id: string;
  preview: string;
  parts: { heading: string; text: string; markdown?: boolean }[];
  choices?: string[];
};

/** The first prompt in 3 lines. A click opens a dialog with all the prompts. `label`: a heading
 * above the prompt, in the button. */
export function PromptRows({
  title,
  description,
  rows,
  label,
  className,
}: {
  title: string;
  description: ReactNode;
  rows: PromptRow[];
  label?: string;
  className?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            'group -mx-1.5 flex w-[calc(100%+0.75rem)] cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-slate-100',
            className,
          )}
        >
          <span className="flex min-w-0 flex-1 flex-col gap-y-1">
            {label && <span className={HEADING}>{label}</span>}
            <span className="line-clamp-3 text-xs wrap-anywhere text-slate-700">{rows[0]?.preview}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-slate-400 group-hover:text-slate-600" aria-hidden />
        </button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="-mx-6 flex min-h-0 flex-col gap-4 overflow-y-auto px-6">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-col gap-4">
              {r.parts.map((p, i) => (
                <section key={i} className="flex flex-col gap-1">
                  <h3 className={HEADING}>{p.heading}</h3>
                  {p.markdown ? (
                    <div className={BOX}>
                      <ChatMarkdown text={p.text} size="sm" />
                    </div>
                  ) : (
                    <div className={cn(BOX, 'whitespace-pre-wrap')}>{p.text}</div>
                  )}
                </section>
              ))}
              {!!r.choices?.length && (
                <section className="flex flex-col gap-1">
                  <h3 className={HEADING}>Choices</h3>
                  <ol className="list-[upper-alpha] rounded-lg bg-slate-100 py-2 pr-3 pl-9 text-sm text-slate-800">
                    {r.choices.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ol>
                </section>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
