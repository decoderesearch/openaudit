import { InfoPopover } from '@/components/info-popover';
import Link from '@/components/link';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { modelModePath, type ModelMode } from '@/lib/model-mode';
import { cn } from '@/lib/utils';
import { ExternalLink, FileText, Info, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';

/** A button in the row at the top right of a model page. */
export const ACTION =
  'inline-flex items-center gap-x-1.5 rounded-full border border-slate-200 bg-background px-3 py-1 text-xs font-medium whitespace-nowrap text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 data-[state=open]:bg-slate-100 data-[state=open]:text-slate-900 [&>svg]:size-3.5';

export type DocumentLink = { id: string; title: string; detail: string; href: string };

/** A fact about the model's OpenAudit card. `model`: the full model ID. */
export type CardFact = { label: string; value: string; about: string; model?: string | null };

/** The buttons at the top right of a model page: `compare`, `info`, then a link to the other mode
 * (System Card, or back to OpenAudit), then `history`. `path`: the model page. `systemCard`: false
 * when the model has no system card, so there is no System Card link. */
export function ModelActions({
  path,
  mode,
  compare,
  info,
  history,
  systemCard = true,
}: {
  path: string;
  mode: ModelMode;
  compare?: ReactNode;
  info?: ReactNode;
  history?: ReactNode;
  systemCard?: boolean;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {compare}
      {info}
      {mode !== 'openaudit' ? (
        <Link href={path} className={ACTION}>
          <ShieldCheck aria-hidden />
          OpenAudit
        </Link>
      ) : (
        systemCard && (
          <Link href={modelModePath(path, 'system-card')} className={ACTION}>
            <FileText aria-hidden />
            System Card
          </Link>
        )
      )}
      {history}
    </div>
  );
}

const LABEL = 'text-[10px] font-semibold tracking-wide text-slate-500 uppercase';

/** "Metadata": on a click, the card's facts, the model's documents and its Hugging Face page (`hub`:
 * the model ID), in a column with a line between them. A fact's `about` shows on hover of the help
 * icon at the right of its label. */
export function ModelInfo({ facts, documents, hub }: { facts: CardFact[]; documents: DocumentLink[]; hub?: string }) {
  return (
    <Popover>
      <PopoverTrigger className={ACTION}>
        <Info aria-hidden />
        Metadata
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-80 flex-col divide-y divide-slate-100 py-1 text-xs">
        {facts.map((f) => (
          <div key={f.label} className="flex flex-col gap-y-0.5 py-2.5">
            <span className={cn(LABEL, 'flex items-center gap-x-1')}>
              {f.label}
              <InfoPopover label={f.label} iconClassName="size-3">
                {f.about}
              </InfoPopover>
            </span>
            <span className="pl-2 font-medium text-slate-800">{f.value}</span>
            {f.model && <span className="pl-2 font-mono text-[10px] text-slate-400">{f.model}</span>}
          </div>
        ))}
        {documents.length > 0 && (
          <div className="flex flex-col gap-y-1 py-2.5">
            <span className={LABEL}>Documents</span>
            <ul className="flex flex-col gap-y-1.5 pl-2">
              {documents.map((d) => (
                <li key={d.id} className="flex flex-col">
                  <Link href={d.href} className="font-medium text-sky-800 hover:underline">
                    {d.title}
                  </Link>
                  <span className="text-slate-500">{d.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {hub && (
          <div className="flex flex-col gap-y-1 py-2.5">
            <span className={LABEL}>Hugging Face</span>
            <a
              href={`https://huggingface.co/${hub}`}
              target="_blank"
              rel="noreferrer nofollow"
              className="inline-flex items-center gap-x-1 pl-2 font-mono text-sky-800 hover:underline"
            >
              <span className="break-all">{hub}</span>
              <ExternalLink aria-hidden className="size-3 shrink-0" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
