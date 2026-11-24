import { CITE_BADGE, PILL_BUTTON } from '@/components/cite-badge';
import { InfoPopover } from '@/components/info-popover';
import { PdfCite, type PdfDocument } from '@/components/pdf-viewer';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DOCUMENT_KINDS } from '@/lib/format';
import { CATEGORY_LABELS } from '@/lib/openaudit-card';
import { TOPIC_INFO, TOPIC_LABELS } from '@/lib/topics';
import { cn } from '@/lib/utils';
import type { Document, EvalResult, Topic } from '@openaudit/spec';
import { TextQuote } from 'lucide-react';
import type { ReactNode } from 'react';

// Small parts shared by the model, card and eval pages.

/** Shows review status (badges and warnings). Off until people review extractions. */
export const SHOW_REVIEW_STATUS = false;

/** Marks values an LLM extracted that no person has checked. */
export function ReviewBadge({ reviewed }: { reviewed: boolean }) {
  if (reviewed || !SHOW_REVIEW_STATUS) return null;
  return (
    <Badge
      variant="outline"
      className="border-amber-300 bg-amber-50 text-[10px] text-amber-800"
      title="An LLM extracted this from the document. No person has checked it yet."
    >
      Not reviewed
    </Badge>
  );
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Badge variant="outline" className={cn('bg-white text-[10px] font-normal text-slate-600', className)}>
      {children}
    </Badge>
  );
}

export function DocumentKind({ kind }: { kind: Document['kind'] }) {
  return <Tag className={kind === 'blog' ? '' : 'border-sky-200 bg-sky-50 text-sky-800'}>{DOCUMENT_KINDS[kind]}</Tag>;
}

export { TOPIC_LABELS };

/** A snippet's category: a topic, else a category of older snippets. */
export function categoryLabel(category: string): string {
  return TOPIC_LABELS[category as Topic] ?? CATEGORY_LABELS[category] ?? category;
}

export { TOPIC_INFO };

/** The topic's name. A hover on it shows the topic's details. */
export function TopicLabel({ topic, className }: { topic: Topic; className?: string }) {
  const label = TOPIC_LABELS[topic] ?? topic;
  const name = cn('shrink-0 text-left font-medium text-slate-800', className);
  if (!TOPIC_INFO[topic]) return <span className={name}>{label}</span>;
  return (
    <InfoPopover
      label={label}
      trigger={label}
      triggerClassName={cn(
        name,
        'relative z-10 no-underline decoration-slate-400 hover:text-slate-800 hover:underline',
      )}
    >
      {TOPIC_INFO[topic]}
    </InfoPopover>
  );
}

/** The topics shown in a `TopicLine`; a hover shows all. */
const TOPIC_LINE_MAX = 1;

/** The topics as one line of text, with center dots between them. With more than
 * `TOPIC_LINE_MAX`: those first, then "+N", and a hover shows all. */
export function TopicLine({ topics, className }: { topics: Topic[]; className?: string }) {
  if (!topics.length) return null;
  const labels = topics.map((t) => TOPIC_LABELS[t] ?? t);
  const more = labels.length - TOPIC_LINE_MAX;
  if (more <= 0) return <p className={cn('mt-1 text-[10px] text-slate-500', className)}>{labels.join(' · ')}</p>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <p
          tabIndex={0}
          className={cn('relative z-10 mt-1 w-fit cursor-default text-[10px] text-slate-500 outline-none', className)}
        >
          {labels.slice(0, TOPIC_LINE_MAX).join(' · ')} <span className="text-slate-400">+{more}</span>
        </p>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-64">
        {labels.join(' · ')}
      </TooltipContent>
    </Tooltip>
  );
}

export { Section } from '@/components/section';

/**
 * A card's source, as a small button that opens our saved PDF at the page and marks the quote.
 * With `children` (the text the source supports), the text works as the button too. With no
 * saved PDF, the quote shows on hover.
 */
export function Cite({
  page,
  pdfPage,
  quote,
  pdf,
  children,
  className,
  stretch,
  label,
  anchor,
}: {
  page?: string;
  pdfPage?: number;
  quote?: string;
  pdf?: PdfDocument;
  children?: ReactNode;
  className?: string;
  /** Make the whole nearest positioned parent open the PDF. */
  stretch?: boolean;
  /** Show a pill button with this label. */
  label?: string;
  /** The element to mark when the PDF opens, if not the one clicked. */
  anchor?: () => Element | null;
}) {
  // A leading number is a page ("12", "12-13"); a section number ("3.2", "1. Introduction") is not.
  const at = pdfPage ?? Number(page?.match(/^\d+(?![.\d])/)?.[0] ?? 0);
  if (pdf && at && (page || quote))
    return (
      <PdfCite
        target={{ ...pdf, page: at, pageLabel: page, quote }}
        className={className}
        stretch={stretch}
        label={label}
        anchor={anchor}
      >
        {children}
      </PdfCite>
    );
  const title = [quote && `“${quote}”`, page && `p. ${page}`].filter(Boolean).join(' ');
  if (label && (page || quote))
    return (
      <span title={title} className={cn(PILL_BUTTON, 'cursor-help', className)}>
        <TextQuote />
        {label}
      </span>
    );
  const badge = (page || quote) && (
    <span title={title} className={cn(CITE_BADGE, 'cursor-help text-slate-400')}>
      <TextQuote className="size-3.5" />
    </span>
  );
  if (!children) return badge || null;
  return (
    <span className={className}>
      {children} {badge}
    </span>
  );
}

/** A result's run settings, as a short list. */
export function settingsText(r: EvalResult) {
  const s = r.settings;
  return [
    s.reasoningEffort && `effort ${s.reasoningEffort}`,
    s.tools !== undefined && (s.tools ? 'tools' : 'no tools'),
    s.passAtK && `pass@${s.passAtK}`,
    s.harness,
    s.safeguards !== undefined && (s.safeguards ? 'safeguards on' : 'safeguards off'),
    s.helpfulOnly && 'helpful-only',
    s.surface,
    s.otherModels,
    s.other,
  ]
    .filter(Boolean)
    .join(', ');
}
