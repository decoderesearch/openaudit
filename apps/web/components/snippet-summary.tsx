import { SampleLabel } from '@/components/sample-label';
import { CHAT_GROUP_STYLES, chatGroup } from '@/lib/feed';
import { SEVERITY_COLORS, type SnippetSeverity } from '@/lib/openaudit-card';
import type { SampleRef } from '@/lib/sample-label';
import { cn } from '@/lib/utils';
import { Lock, MessageSquareWarning } from 'lucide-react';

/** The style of the "Open Sample" link above the meta. */
export const CHAT_SAMPLE =
  'flex shrink-0 items-center gap-1 rounded-full bg-sky-700 px-2.5 py-0.5 font-medium whitespace-nowrap text-white transition-colors hover:bg-sky-800';

/** A flagged chat's title (else "High Severity"), in the severity's color, after its flag icon.
 * `locked`: the reader cannot see the chat; a lock shows after the flag. `noIcon`: no flag icon.
 * Use it wherever a flagged chat shows its title, so that all look the same. */
export function FlagLabel({
  flag,
  title,
  locked,
  noIcon,
  className,
}: {
  flag?: SnippetSeverity;
  title?: string | null;
  locked?: boolean;
  noIcon?: boolean;
  className?: string;
}) {
  if (!flag) return null;
  const { icon, text } = SEVERITY_COLORS[flag];
  const label = `${CHAT_GROUP_STYLES[chatGroup(flag)].label} Severity`;
  return (
    <span className={cn('flex items-center gap-x-1 text-[10px] font-bold tracking-wide uppercase', text, className)}>
      {!noIcon && <MessageSquareWarning aria-hidden className={cn('size-3 shrink-0', icon)} />}
      {locked && <Lock aria-label="Restricted" className="size-3 shrink-0 text-slate-400" />}
      <span className="min-w-0">{title || label}</span>
    </span>
  );
}

/** The summary, below its flag label (with no severity: its title, else "Transcript Summary").
 * `large`: larger, darker text. */
export function SnippetReason({
  title,
  reason,
  severity,
  large,
}: {
  title?: string | null;
  reason: string;
  severity?: SnippetSeverity;
  large?: boolean;
}) {
  return (
    <>
      {severity ? (
        <FlagLabel flag={severity} title={title} className={cn(large && 'text-[11px]')} />
      ) : (
        <span className={cn('text-[10px] font-medium tracking-wide text-slate-400 uppercase', large && 'text-[11px]')}>
          {title || 'Transcript Summary'}
        </span>
      )}
      <p className={cn('text-xs leading-snug text-slate-600', large && 'text-[13px] text-slate-700')}>{reason}</p>
    </>
  );
}

/** The eval, then the sample id below it. */
export function SnippetMeta({ evalName, sample }: { evalName: string; sample: SampleRef }) {
  return (
    <>
      <span className="whitespace-nowrap text-slate-600">{evalName}</span>
      <SampleLabel sample={sample} className="font-mono text-[10px] whitespace-nowrap text-slate-400" />
    </>
  );
}
