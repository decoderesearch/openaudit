'use client';

import { ACTION } from '@/components/catalog/model-actions';
import { copyToClipboard } from '@/components/copy-text';
import { Panel } from '@/components/panel';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { MethodPrompt } from '@openaudit/spec';
import { ChevronDown, Copy, MessageSquareText } from 'lucide-react';
import { toast } from 'sonner';

/** One prompt, word for word, with a copy button, its note and its source. */
export function PromptText({ prompt }: { prompt: MethodPrompt }) {
  return (
    <div className="flex flex-col gap-y-2">
      <div className="flex items-center justify-between gap-x-3">
        <h3 className="text-xs font-semibold text-slate-700">{prompt.name}</h3>
        <button
          type="button"
          onClick={() =>
            copyToClipboard(prompt.text).then(
              () => toast.success(`Copied the ${prompt.name.toLowerCase()}`),
              () => toast.error(`Could not copy the ${prompt.name.toLowerCase()}`),
            )
          }
          className="inline-flex cursor-pointer items-center gap-x-1 text-[11px] text-sky-800 hover:underline"
        >
          <Copy className="size-3" aria-hidden />
          Copy
        </button>
      </div>
      <pre className="max-h-[50vh] overflow-y-auto rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px]/relaxed whitespace-pre-wrap text-slate-700">
        {prompt.text}
      </pre>
      {(prompt.note || prompt.sourceUrl) && (
        <p className="text-[11px] text-slate-500">
          {prompt.note}
          {prompt.sourceUrl && (
            <>
              {prompt.note && ' '}
              <a href={prompt.sourceUrl} className="text-sky-800 hover:underline" rel="nofollow">
                Source
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
}

/** A "Prompt" button that opens the variant's prompts. */
export function VariantPrompts({ prompts }: { prompts: MethodPrompt[] }) {
  const title = prompts.length > 1 ? 'Prompts' : 'Prompt';
  return (
    <Popover>
      <PopoverTrigger className={ACTION}>
        <MessageSquareText aria-hidden />
        {title}
        <ChevronDown aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={16} className="w-[40rem] max-w-[calc(100vw-2rem)] p-0">
        <Panel title={title} className="rounded-none border-0">
          <div className="flex flex-col gap-y-4 px-4 py-3">
            {prompts.map((p) => (
              <PromptText key={p.name} prompt={p} />
            ))}
          </div>
        </Panel>
      </PopoverContent>
    </Popover>
  );
}
