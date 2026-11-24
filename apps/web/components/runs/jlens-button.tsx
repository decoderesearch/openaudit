'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NEXT_PUBLIC_NEURONPEDIA_URL } from '@/lib/env';
import {
  DEFAULT_JLENS_MODEL,
  jlensDescription,
  jlensModelFor,
  jlensRefusal,
  jlensShareBody,
  type JlensOption,
  type JlensSource,
} from '@/lib/jlens';
import { useJlensModels } from '@/lib/jlens-models';
import { cn } from '@/lib/utils';
import { ChevronDown, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import { useId, useMemo, useRef, useState } from 'react';

const LOADER_HTML = (label: string) =>
  '<!doctype html><meta charset="utf-8"><title>Opening J-Lens&hellip;</title>' +
  '<style>body{font-family:system-ui,sans-serif;color:#334155;display:flex;flex-direction:column;align-items:center;' +
  'justify-content:center;gap:12px;height:100vh;margin:0}div{width:28px;height:28px;border:3px solid #cbd5e1;' +
  'border-top-color:#0369a1;border-radius:50%;animation:s 1s linear infinite}p{margin:0;font-size:14px}' +
  'small{color:#64748b}@keyframes s{to{transform:rotate(360deg)}}</style>' +
  `<div></div><p>Opening J-Lens on ${label.replace(/[&<>]/g, '')}&hellip;</p>` +
  '<small>Neuronpedia reads the transcript with J-Lens. This can take up to a minute.</small>';

const SHARE_URL = `${NEXT_PUBLIC_NEURONPEDIA_URL}/api/lens/share`;

/** Opens a tab with a loading page, which posts the share itself and stays until Neuronpedia
 * replies. False if the browser blocks the tab. */
function postInTab(label: string, share: string): boolean {
  const tab = window.open('', '_blank');
  if (!tab) return false;
  const doc = tab.document;
  doc.write(LOADER_HTML(label));
  doc.close();
  const form = doc.createElement('form');
  form.method = 'post';
  form.action = SHARE_URL;
  const input = doc.createElement('input');
  input.type = 'hidden';
  input.name = 'share';
  input.value = share;
  form.append(input);
  doc.body.append(form);
  form.submit();
  tab.opener = null;
  return true;
}

export const TOOL_CALL_WARNING =
  'Neuronpedia does not fully support tool calls yet. The tool definitions are not sent, so the ' +
  'model reads calls to tools it was not told about.';

/**
 * The "Interpretability" menu. Its item opens the transcript in Neuronpedia's J-Lens: a form
 * posts it to Neuronpedia in a new tab, which runs J-Lens and then shows the share. The J-Lens
 * model is the one in Neuronpedia's list that matches `names` (our model's name and aliases), else
 * an earlier version of it, else the default, with a note. It sends `full` (with thinking), or `bare` (without) with a note: when
 * the model does not read `<think>` tags, or when only `bare` fits. A refusal disables the item and
 * shows below it. `compact`: small, for one line of text. `disabled`: why the button is gray and does not open;
 * it shows on hover.
 */
export function JlensButton({
  names,
  source,
  full,
  bare,
  hasToolCalls,
  compact,
  disabled,
}: {
  names: string[];
  source: JlensSource;
  full: JlensOption;
  bare?: JlensOption;
  hasToolCalls: boolean;
  compact?: boolean;
  disabled?: string;
}) {
  const formId = useId();
  const form = useRef<HTMLFormElement>(null);
  const share = useRef<HTMLInputElement>(null);
  const [warning, setWarning] = useState(false);
  const models = useJlensModels();
  const checking = models === undefined;
  const { model, same, earlier } = jlensModelFor(names, models ?? [DEFAULT_JLENS_MODEL]);
  const { option, note } = useMemo(() => {
    const fit = (o: JlensOption): JlensOption =>
      o.refusal ? o : { messages: o.messages, refusal: jlensRefusal(o.messages, model.tokenLimit, model.charLimit) };
    const f = fit(full);
    const b = bare && fit(bare);
    if (b && !model.thinkTags)
      return { option: b, note: `Sends the transcript without thinking. ${model.label} uses another thinking format.` };
    if (b && f.refusal && !b.refusal)
      return { option: b, note: 'Sends the transcript without thinking. With thinking, it is too long.' };
    return { option: f, note: null };
  }, [full, bare, model]);
  // While the models load, only a refusal that does not depend on the model shows.
  const refusal = checking ? (bare ? null : full.refusal) : option.refusal;
  const title = same
    ? `Read the transcript with J-Lens on ${model.label}, on Neuronpedia.`
    : `Replay the transcript on ${model.label}${earlier ? `, an earlier version of ${source.modelName},` : ''} and read it with J-Lens, on Neuronpedia.`;
  const size = compact
    ? 'h-5 gap-0.5 border-[0.5px] py-0 text-[10px] sm:h-5 has-[>svg]:pr-1.5 has-[>svg]:pl-2.5 [&_svg]:size-3'
    : 'h-9 py-1.5 text-[13px] sm:h-9 has-[>svg]:pr-3.5 has-[>svg]:pl-4';
  const logo = compact ? 'mr-0.5 size-3' : 'mr-0.5 size-3.5';

  if (disabled)
    return (
      // A disabled button gets no hover events, so the reason is on its wrapper.
      <span title={disabled} className="inline-flex shrink-0 cursor-not-allowed">
        <Button
          variant="outline"
          size="sm"
          disabled
          className={cn(
            'gap-1 rounded-full border-slate-300 bg-slate-100 font-semibold text-slate-500 shadow-none disabled:opacity-100',
            size,
          )}
        >
          <Image
            src="/neuronpedia-logo.png"
            alt=""
            width={14}
            height={14}
            className={cn(logo, 'opacity-40 grayscale')}
          />
          <span className="opacity-50">Interpretability</span>
          <ChevronDown className="size-3.5 opacity-50" />
        </Button>
      </span>
    );

  return (
    <div className="flex shrink-0">
      {/* Used only when the browser blocks the loading tab. */}
      <form
        ref={form}
        id={formId}
        method="post"
        action={SHARE_URL}
        target="_blank"
        className="hidden"
        onSubmit={(e) => {
          e.preventDefault();
          // Made at submit, not at each render: the transcript can be megabytes.
          const description = jlensDescription({ ...source, model, same });
          const body = JSON.stringify(jlensShareBody(model, option.messages, description));
          setWarning(false);
          if (postInTab(model.label, body)) return;
          if (share.current) share.current.value = body;
          e.currentTarget.submit();
        }}
      >
        <input ref={share} type="hidden" name="share" />
      </form>
      {/* Not modal: the tool call dialog opens from an item. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'gap-1 rounded-full border-sky-700 bg-white font-semibold text-sky-800 shadow-none hover:bg-sky-50 hover:text-sky-900 data-[state=open]:bg-sky-50',
              size,
            )}
          >
            <Image src="/neuronpedia-logo.png" alt="" width={14} height={14} className={logo} />
            Interpretability
            <ChevronDown className="size-3.5 text-sky-800" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-96">
          <DropdownMenuItem
            className="cursor-pointer font-medium"
            title={title}
            disabled={checking || !!refusal}
            onSelect={() => (hasToolCalls ? setWarning(true) : form.current?.requestSubmit())}
          >
            <ExternalLink />
            <span>Open in Jacobian Lens{!same && <span className="text-amber-700"> ({model.label})</span>}</span>
          </DropdownMenuItem>
          {refusal && <p className="px-2 pb-1.5 pl-8 text-[11px] text-rose-700">{refusal}</p>}
          {!refusal && checking && (
            <p className="px-2 pb-1.5 pl-8 text-[11px] text-slate-500">Getting the J-Lens models from Neuronpedia…</p>
          )}
          {!checking && !same && !earlier && (
            <p className="px-2 pb-1.5 pl-8 text-[11px] text-amber-700">
              Neuronpedia has no J-Lens for {source.modelName}. It opens on {model.label}.
            </p>
          )}
          {!refusal && !checking && note && <p className="px-2 pb-1.5 pl-8 text-[11px] text-slate-500">{note}</p>}
        </DropdownMenuContent>
      </DropdownMenu>
      {hasToolCalls && (
        <Dialog open={warning} onOpenChange={setWarning}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tool calls</DialogTitle>
              <DialogDescription>{TOOL_CALL_WARNING}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" form={formId}>
                Open anyway
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
