import { parseLiteral } from '@/lib/py-literal';
import { cn } from '@/lib/utils';
import { Bot, ChevronRight, Settings, User, Wrench, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Text size of a chat: 'xs' in hover cards, 'sm' on pages. */
export type ChatSize = 'xs' | 'sm';

const PROSE: Record<ChatSize, string> = {
  xs: 'markdown text-xs/relaxed text-slate-700',
  sm: 'markdown text-[13px]/normal text-slate-700',
};
const PRE_BASE = 'overflow-auto font-mono whitespace-pre-wrap text-slate-700';
const PRE: Record<ChatSize, string> = {
  xs: cn(PRE_BASE, 'text-[10px]/normal'),
  sm: cn(PRE_BASE, 'text-[10.5px]/snug'),
};
const LABEL: Record<ChatSize, string> = { xs: 'text-[11px]', sm: 'text-[11px]' };

const MARKDOWN: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer nofollow">
      {children}
    </a>
  ),
};

/** Text as Markdown, with GitHub tables and lists. */
export function ChatMarkdown({ text, size, className }: { text: string; size: ChatSize; className?: string }) {
  return (
    <div className={cn(PROSE[size], className)}>
      <Markdown remarkPlugins={[remarkGfm]} components={MARKDOWN}>
        {text}
      </Markdown>
    </div>
  );
}

/** A tool result that is one list or dict (JSON or Python), with indents, or markup such as HTML,
 * as is. Else undefined. */
export function toolValue(text: string): string | undefined {
  const trimmed = text.trim();
  if (/^<[!?a-z]/i.test(trimmed)) return trimmed;
  const value = parseLiteral(trimmed);
  return value !== null && typeof value === 'object' ? JSON.stringify(value, null, 2) : undefined;
}

/** Preformatted text, for example a tool result. */
export function ChatPre({ text, size }: { text: string; size: ChatSize }) {
  return <pre className={PRE[size]}>{text}</pre>;
}

/** A tool call: its name in a chip, and its arguments as indented text. */
export function ToolCallView({ name, args, size }: { name?: string; args: string; size: ChatSize }) {
  return (
    <div className="my-1 rounded bg-slate-200">
      <div className={cn('flex items-center gap-x-1 px-2 pt-1 text-slate-500', LABEL[size])}>
        <Wrench className="size-3" aria-hidden />
        Assistant Tool Call
        {name && <span className="rounded bg-white/70 px-1 font-mono text-slate-700">{name}</span>}
      </div>
      <pre className={cn(PRE[size], 'pt-0.5 pr-2 pb-1.5 pl-6')}>{args}</pre>
    </div>
  );
}

/**
 * Thinking, closed. `fixed`: always open, with no control to close it. `label`: for example
 * 'Thinking Summary'. `note` shows at the right while it is closed.
 */
export function ThinkingView({
  label = 'Thinking',
  note,
  size,
  fixed,
  children,
}: {
  label?: string;
  note?: ReactNode;
  size: ChatSize;
  fixed?: boolean;
  children: ReactNode;
}) {
  const head = cn(
    'flex items-center gap-x-1 px-3 py-1.5 font-medium tracking-wide text-slate-500 uppercase',
    size === 'xs' ? 'text-[9px]' : 'text-[10px]',
  );
  if (fixed)
    return (
      <div className="my-1 rounded bg-slate-200">
        <p className={head}>{label}</p>
        <div className="px-3 pb-2 text-slate-600">{children}</div>
      </div>
    );
  return (
    <details className="group/thinking my-1 rounded bg-slate-200">
      <summary className={cn(head, 'cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden')}>
        <ChevronRight className="size-3 shrink-0 transition-transform group-open/thinking:rotate-90" aria-hidden />
        {label}
        {note && (
          <span className="ml-auto pl-3 font-normal tracking-normal text-slate-400 normal-case group-open/thinking:hidden">
            {note}
          </span>
        )}
      </summary>
      <div className="pr-3 pb-2 pl-7 text-slate-600">{children}</div>
    </details>
  );
}

const ROLES: Record<string, { icon: LucideIcon; label: string; bubble: string }> = {
  system: { icon: Settings, label: 'System', bubble: 'bg-white' },
  user: { icon: User, label: 'User', bubble: 'bg-white' },
  assistant: { icon: Bot, label: 'Assistant', bubble: '' },
  tool: { icon: Wrench, label: 'Tool Call - Result', bubble: 'bg-white' },
};
/** The roles whose messages show at the right, as in a chat app. */
const RIGHT = new Set(['user', 'system']);
export const isRightRole = (role: string) => RIGHT.has(role);

/**
 * A message as a chat bubble: the role icon and label (or `label`), `meta` (for example the
 * model), and at the right `actions`, else the message number. `flagged`: rose, for the reply
 * that a snippet cites. `flagId`: its `data-flagged`, to find it. `anchor`: its `data-anchor`, for
 * a link to it; with `data-linked` set, it has a sky border. Put bubbles on a gray background.
 */
export function ChatBubble({
  role,
  label: labelText,
  index,
  meta,
  flagged,
  flagId,
  anchor,
  actions,
  size,
  className,
  bodyClassName,
  ref,
  children,
}: {
  role: string;
  label?: string;
  index: number;
  meta?: ReactNode;
  flagged?: boolean;
  flagId?: string;
  anchor?: string;
  actions?: ReactNode;
  size: ChatSize;
  className?: string;
  bodyClassName?: string;
  ref?: React.Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  const { icon: Icon, bubble, label } = ROLES[role] ?? { ...ROLES.assistant!, label: role };
  return (
    <div
      ref={ref}
      data-message={index}
      data-flagged={flagged ? flagId : undefined}
      data-anchor={anchor}
      className={cn(
        'max-w-[90%] rounded-lg',
        size === 'xs' ? 'px-2 py-1.5' : 'px-3 py-2',
        RIGHT.has(role) ? 'self-end' : 'self-start',
        flagged ? 'border border-rose-300 bg-rose-50/60 ring-1 ring-rose-300' : bubble,
        !flagged && !bubble && 'pl-1.5',
        'data-[linked]:border data-[linked]:border-sky-600',
        className,
      )}
    >
      <div className={cn('flex items-center gap-x-1 text-slate-500', LABEL[size])}>
        <Icon className="size-3" aria-label={role} />
        <span>{labelText ?? label}</span>
        {meta}
        {actions ? (
          <span className="ml-auto flex items-center pl-3">{actions}</span>
        ) : (
          <span className="ml-auto pl-3 text-slate-400">message {index}</span>
        )}
      </div>
      <div className={cn('mt-0.5 overflow-auto pl-4', bodyClassName)}>{children}</div>
    </div>
  );
}
