'use client';

import { EvalStatusTag } from '@/components/catalog/eval-status';
import { ScoreBar, type Score } from '@/components/catalog/score';
import { ChatBubble, ChatMarkdown, ChatPre, ThinkingView, ToolCallView, toolValue } from '@/components/chat';
import { AttestationForm, forgetAttestation, useAttestation } from '@/components/eval-attestation';
import Link from '@/components/link';
import { RunLink } from '@/components/pdf-viewer';
import { WithheldReply } from '@/components/runs/hazard-note';
import { CHAT_SAMPLE, SnippetMeta, SnippetReason } from '@/components/snippet-summary';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { NEXT_PUBLIC_URL } from '@/lib/env';
import { attestationHeaders, type Attestation } from '@/lib/eval-attestation';
import type { Place } from '@/lib/leaders';
import { type SnippetResponse, type SnippetSeverity } from '@/lib/openaudit-card';
import { parseLiteral } from '@/lib/py-literal';
import type { SampleRef } from '@/lib/sample-label';
import { focusIndex, keepCentered } from '@/lib/snippet-focus';
import { cn } from '@/lib/utils';
import type { Hazard } from '@openaudit/spec';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';

const OPEN_EVENT = 'openaudit:evidence-card-open';
/** How much of a joined frame's right side the card covers, in pixels. */
const JOIN_COVER = 5;
/** With no `alignTo` box, how far a joined card's top is above the frame's top, in pixels. More
 * than the card's corner radius, so that the seam can span the frame. */
const JOIN_LIFT = 8;

/** A flagged case (snippet) of a run, with the attempt page it comes from. `topics`: its category,
 * then the topics it gets from its eval. */
export type SnippetRef = {
  id: string;
  href: string;
  evalName: string;
  ordinal: number;
  sample: SampleRef;
  category: string;
  topics: string[];
  severity: SnippetSeverity;
  /** The problem in 1 to 3 words. Older snippets have none. */
  title?: string | null;
  reason: string;
  /** A reader with no staff role can never read the reply. */
  locked?: boolean;
};

/** An eval run, with its headline result. `date`: as the page shows dates. `evalSlug`: the name
 * shows the eval's summary on hover. `place`: the model's place among the models on the eval. */
export type RunRef = {
  href: string;
  evalName: string;
  evalSlug?: string;
  evalStatus?: string | null;
  date: string;
  samples?: number | null;
  limited?: boolean;
  result?: Score | null;
  place?: Place;
};

export type ExcerptState =
  'loading' | 'error' | 'hidden' | 'ask' | { withheld: Hazard; summary: string | null } | SnippetResponse;

/** A snippet's excerpt. `load` gets it with the reader's statement, or with none to learn if the
 * reply is withheld; 'hidden': the dataset's terms do not let the reader see it; `withheld`: the
 * reply can give dangerous help (its level and summary); 'ask': the API needs the statement (a 428), so the
 * form shows. `conversation`: get all messages of the attempt too. */
export function useSnippetExcerpt(id: string, { conversation = false } = {}) {
  const [state, setState] = useState<ExcerptState | null>(null);
  const load = useCallback(
    async (a: Attestation | null) => {
      setState('loading');
      try {
        const url = `/api/snippets/${id}${conversation ? '?conversation=1' : ''}`;
        const res = await fetch(url, a ? { headers: attestationHeaders(a) } : {});
        if (res.status === 428) {
          if (a) forgetAttestation();
          setState('ask');
          return;
        }
        if (res.status === 403) {
          const body = (await res.json().catch(() => ({}))) as { hazard?: Hazard; summary?: string | null };
          setState(body.hazard ? { withheld: body.hazard, summary: body.summary ?? null } : 'hidden');
          return;
        }
        setState(res.ok ? ((await res.json()) as SnippetResponse) : 'error');
      } catch {
        setState('error');
      }
    },
    [id, conversation],
  );
  return { state, load };
}

// Encrypted reasoning that older snippets kept as thinking text.
function withoutCiphertext(text: string): string {
  return text.replace(/gAAAAA[\w=.-]{20,}…?/g, '').replace(/<thinking>\s*<\/thinking>\n?/g, '');
}

const THINKING = /<thinking>\n?([\s\S]*?)\n?<\/thinking>\n?/g;

// A tool call as the flagger read it: `[tool call send_email: {"to": "a"}]`, on its own line.
const TOOL_CALL = /^\[tool call ([^:\n]+): (.*)\]$/gm;

export type MessagePart = { kind: 'text' | 'thinking' | 'tool'; text: string; name?: string };

/** Splits a message into its text, its `<thinking>` blocks and its tool calls, in order. */
export function messageParts(text: string): MessagePart[] {
  const parts: MessagePart[] = [];
  const split = (re: RegExp, s: string, each: (m: RegExpExecArray) => MessagePart, rest: (s: string) => void) => {
    let at = 0;
    for (const m of s.matchAll(re)) {
      if (m.index > at) rest(s.slice(at, m.index));
      parts.push(each(m));
      at = m.index + m[0].length;
    }
    if (at < s.length) rest(s.slice(at));
  };
  split(
    THINKING,
    text,
    (m) => ({ kind: 'thinking', text: m[1]! }),
    (s) =>
      split(
        TOOL_CALL,
        s,
        (m) => ({ kind: 'tool', name: m[1]!, text: m[2]! }),
        (t) => parts.push({ kind: 'text', text: t }),
      ),
  );
  return parts.filter((p) => p.text.trim());
}

/** A JSON or Python value with two-space indents. Text that is not one (a cut excerpt) stays as it is. */
function prettyJson(text: string) {
  const value = parseLiteral(text.trim());
  return value === undefined ? text : JSON.stringify(value, null, 2);
}

/**
 * A message as Markdown. Thinking shows closed, above or between the text; tool calls, and a tool
 * result that is one list or dict, as indented JSON.
 */
function MessageBody({ text, role }: { text: string; role: string }) {
  const value = role === 'tool' ? toolValue(withoutCiphertext(text)) : undefined;
  if (value) return <ChatPre text={value} size="xs" />;
  return messageParts(withoutCiphertext(text)).map((p, i) =>
    p.kind === 'tool' ? (
      <ToolCallView key={i} name={p.name!} args={prettyJson(p.text)} size="xs" />
    ) : p.kind === 'thinking' ? (
      <ThinkingView key={i} size="xs">
        <ChatMarkdown text={p.text} size="xs" className="text-slate-600" />
      </ThinkingView>
    ) : (
      <ChatMarkdown key={i} text={p.text} size="xs" />
    ),
  );
}

export { focusIndex };

/**
 * The excerpt's exact quote and key messages, as chat bubbles. With the whole conversation, all
 * its messages show (no quote), and the nearest scroll box scrolls to the flagged reply.
 * `maxHeight`: the scroll height of each message ('' for none).
 */
export function ExcerptMessages({ excerpt, maxHeight = 'max-h-72' }: { excerpt: SnippetResponse; maxHeight?: string }) {
  const focus = focusIndex(excerpt);
  const focused = useRef<HTMLDivElement>(null);
  const whole = !!excerpt.conversation?.length;
  useEffect(() => {
    const el = focused.current;
    if (whole && el?.parentElement?.closest('[data-scroll]')) return keepCentered(el);
  }, [whole]);
  const messages = whole ? excerpt.conversation! : excerpt.messages;
  return (
    <div className="flex flex-col gap-2">
      {!whole && excerpt.quote && (
        <blockquote className="border-l-2 border-rose-300 pl-2 text-xs whitespace-pre-wrap text-slate-800">
          {excerpt.quote}
        </blockquote>
      )}
      {messages.map((m) => (
        <ChatBubble
          key={m.index}
          ref={m.index === focus ? focused : undefined}
          role={m.role}
          index={m.index}
          flagged={whole && m.index === focus}
          size="xs"
          bodyClassName={maxHeight}
        >
          <MessageBody text={m.text} role={m.role} />
        </ChatBubble>
      ))}
      {excerpt.evalCanary && (
        <span className="font-mono text-[10px] break-all text-slate-400">{excerpt.evalCanary}</span>
      )}
    </div>
  );
}

type Side = 'top' | 'right' | 'bottom' | 'left';

export const LINK =
  'text-sky-800 underline decoration-sky-800/40 decoration-dotted underline-offset-2 hover:decoration-solid';

function HoverHead({ details, aside, children }: { details: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-3 px-1.5 pt-0.5 pb-1.5">
      <div className="flex min-w-0 flex-col gap-0.5">{children}</div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
        <span className="pb-1">{details}</span>
        {aside}
      </div>
    </div>
  );
}

/** A hover card on a link. A click in the card keeps it open (for example for a form) until a
 * click outside it or Escape. Its height is capped; `body` scrolls. The link and "Open Sample" (for
 * a snippet, else "Open Details"; shown with `head`) open `href` in the side panel, with the message of `snippet` in rose. `triggerClassName`: the
 * link's style (default: an underlined text link). `anchor`: the element to mark, if not the link.
 * `page`: the links go to this page instead. `alignTo`: a selector of the link's box that the
 * card's top aligns to; `alignOffset` then moves the card from that top. `click`: a click on the
 * link opens or closes the card, not hover; "Open Sample" opens the link. `join`: a selector of
 * a frame next to the link; the card's near border then joins the frame, as one shape: `JOIN_COVER`
 * in from its right border, or on its bottom border with `side` 'bottom' (the frame has little room
 * under the text). With no `alignTo` box, the card's top (or left) is `JOIN_LIFT` past the frame's.
 * The card is in the `alignTo` box, so that the box's items can show
 * above it. */
function EvidenceCard({
  href,
  snippet,
  page,
  head,
  aside,
  className,
  bodyClassName,
  triggerClassName = LINK,
  anchor,
  side,
  sideOffset,
  alignOffset,
  alignTo,
  click = false,
  join,
  onOpen,
  trigger,
  children,
}: {
  href: string;
  snippet?: string;
  page?: string;
  head?: ReactNode;
  aside?: ReactNode;
  className?: string;
  bodyClassName?: string;
  triggerClassName?: string;
  anchor?: () => Element | null;
  side?: Side;
  sideOffset?: number;
  alignOffset?: number;
  alignTo?: string;
  click?: boolean;
  join?: string;
  onOpen?: () => void;
  trigger: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [boxOffset, setBoxOffset] = useState<number>();
  // The `alignTo` box clips the card, so the card's height is at most the box's room below its top.
  const [boxRoom, setBoxRoom] = useState<number>();
  const [joinOffset, setJoinOffset] = useState<number>();
  const [box, setBox] = useState<HTMLElement>();
  // Its place along the shared border: from the card's top, or (`below`) from its left.
  const [seam, setSeam] = useState<{ at: number; size: number }>();
  const below = side === 'bottom';
  const content = useRef<HTMLDivElement>(null);
  const id = useId();
  const pinned = useRef(false);
  // After a click on the link, the card stays closed until the pointer leaves the link.
  const clicked = useRef(false);
  const link = useRef<HTMLAnchorElement>(null);
  const close = () => {
    pinned.current = false;
    setOpen(false);
  };
  // One card at a time: a card that a click pinned closes when another opens.
  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
    const other = (e: Event) => {
      if ((e as CustomEvent<string>).detail === id) return;
      pinned.current = false;
      setOpen(false);
    };
    window.addEventListener(OPEN_EVENT, other);
    return () => window.removeEventListener(OPEN_EVENT, other);
  }, [open, id]);
  const frame = useCallback(() => (join ? (link.current?.parentElement?.querySelector(join) ?? null) : null), [join]);
  // The seam: a white strip on the shared border, where the card and the frame touch. The card
  // can move (for example, to stay on the screen), so this measures it on each frame.
  useEffect(() => {
    if (!open || !join) return;
    let raf = 0;
    const place = () => {
      const f = frame()?.getBoundingClientRect();
      const c = content.current?.getBoundingClientRect();
      let next: typeof seam;
      // Not when the card shows on the other side, or the two do not touch.
      if (f && c && below && Math.abs(c.top - (f.bottom - 1)) < 2) {
        const left = Math.max(f.left + 1, c.left + 7);
        const right = Math.min(f.right - 1, c.right - 7);
        if (right > left) next = { at: left - c.left - 1, size: right - left };
      } else if (f && c && !below && Math.abs(c.left - (f.right - 1 - JOIN_COVER)) < 2) {
        const top = Math.max(f.top + 1, c.top + 7);
        const bottom = Math.min(f.bottom - 1, c.bottom - 7);
        if (bottom > top) next = { at: top - c.top - 1, size: bottom - top };
      }
      setSeam((s) => (s && next && s.at === next.at && s.size === next.size ? s : next));
      raf = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(raf);
  }, [open, join, frame, below]);
  const show = () => {
    const box = alignTo ? link.current?.closest<HTMLElement>(alignTo) : null;
    const f = frame()?.getBoundingClientRect();
    const l = link.current?.getBoundingClientRect();
    setBox(box ?? undefined);
    setBoxOffset(
      !l
        ? undefined
        : box
          ? box.getBoundingClientRect().top - l.top + (alignOffset ?? 0)
          : f
            ? below
              ? f.left - l.left - JOIN_LIFT
              : f.top - l.top - JOIN_LIFT
            : undefined,
    );
    setBoxRoom(box ? box.getBoundingClientRect().height - (alignOffset ?? 0) : undefined);
    setJoinOffset(f && l ? (below ? f.bottom - 1 - l.bottom : f.right - 1 - JOIN_COVER - l.right) : undefined);
    setSeam(undefined);
    setOpen(true);
    onOpen?.();
  };
  const onClick = (e: React.MouseEvent) => {
    if (!click) {
      clicked.current = true;
      return close();
    }
    // A modified click opens the link, for example in a new tab.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    // Not a pick for a parent, for example a menu that closes on a link click.
    e.stopPropagation();
    // The top loading bar starts on each link click, and stays when no page loads.
    e.nativeEvent.stopImmediatePropagation();
    if (open) return close();
    pinned.current = true;
    show();
  };
  return (
    <HoverCard
      open={open}
      onOpenChange={(o) => {
        if (o) {
          if (!click && !clicked.current) show();
        } else if (!pinned.current) setOpen(false);
      }}
    >
      <HoverCardTrigger asChild>
        {page ? (
          <Link
            ref={link}
            href={page}
            hover={false}
            onClick={onClick}
            onPointerLeave={() => (clicked.current = false)}
            className={triggerClassName}
          >
            {trigger}
          </Link>
        ) : (
          <RunLink
            ref={link}
            href={href}
            snippet={snippet}
            anchor={anchor}
            onClick={onClick}
            onPointerLeave={() => (clicked.current = false)}
            className={triggerClassName}
          >
            {trigger}
          </RunLink>
        )}
      </HoverCardTrigger>
      <HoverCardContent
        ref={content}
        container={box}
        side={side}
        sideOffset={joinOffset ?? sideOffset}
        alignOffset={boxOffset ?? alignOffset}
        className={cn(
          'flex max-h-[min(40rem,var(--radix-hover-card-content-available-height))] flex-col gap-2',
          join && 'relative border-sky-700',
          className,
        )}
        style={boxRoom ? { maxHeight: `min(40rem, ${boxRoom}px)` } : undefined}
        onPointerDown={() => (pinned.current = true)}
        onPointerDownOutside={(e) => {
          // A click on the link closes the card itself.
          if (click && link.current?.contains(e.target as Node)) return e.preventDefault();
          close();
        }}
        onEscapeKeyDown={close}
      >
        {join && seam && (
          <span
            aria-hidden
            className={cn('pointer-events-none absolute bg-white', below ? '-top-px h-px' : '-left-1.5 w-[7px]')}
            style={below ? { left: seam.at, width: seam.size } : { top: seam.at, height: seam.size }}
          />
        )}
        {head && (
          <HoverHead
            aside={aside}
            details={
              page ? (
                <Link href={page} hover={false} onClick={close} className={CHAT_SAMPLE}>
                  {snippet ? 'Open Sample' : 'Open Details'}
                  <ArrowRight className="size-3.5" />
                </Link>
              ) : (
                <RunLink
                  href={href}
                  snippet={snippet}
                  anchor={anchor ?? (() => link.current)}
                  onClick={close}
                  className={CHAT_SAMPLE}
                >
                  {snippet ? 'Open Sample' : 'Open Details'}
                  <ArrowRight className="size-3.5" />
                </RunLink>
              )
            }
          >
            {head}
          </HoverHead>
        )}
        <div
          data-scroll
          className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain', bodyClassName)}
        >
          {children}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

/** A link to a flagged case. On hover: what happened, and the conversation after the reader's
 * statement. `className`, `anchor`: the link's style, the element to mark. `side`, `sideOffset`,
 * `alignOffset`, `alignTo`: where the card shows. `bare`: only the conversation (the link shows the rest and opens it).
 * `page`: the links go to this page, not the side panel. `width`: the card's width class.
 * `click`, `join`: a click opens the card, not hover; the card joins a frame (see `EvidenceCard`). */
export function SnippetHover({
  snippet: s,
  className,
  page,
  anchor,
  side,
  sideOffset,
  alignOffset,
  alignTo,
  bare,
  click,
  join,
  width = 'w-[740px]',
  children,
}: {
  snippet: SnippetRef;
  className?: string;
  page?: string;
  anchor?: () => Element | null;
  side?: Side;
  sideOffset?: number;
  alignOffset?: number;
  alignTo?: string;
  bare?: boolean;
  click?: boolean;
  join?: string;
  width?: string;
  children: ReactNode;
}) {
  const attestation = useAttestation();
  const { state, load } = useSnippetExcerpt(s.id, { conversation: true });
  const withheld = !!state && typeof state === 'object' && 'withheld' in state;
  return (
    <EvidenceCard
      href={s.href}
      snippet={s.id}
      page={page}
      triggerClassName={className}
      anchor={anchor}
      side={side}
      sideOffset={sideOffset}
      alignOffset={alignOffset}
      alignTo={alignTo}
      click={click}
      join={join}
      trigger={children}
      className={cn(width, bare ? 'p-0' : 'pb-0')}
      bodyClassName={cn(
        'min-h-[200px] px-3 py-2.5',
        withheld ? 'bg-rose-50' : 'bg-slate-100',
        bare ? 'rounded-md' : '-mx-3 rounded-b-md border-t border-slate-200',
      )}
      onOpen={() => {
        if (state === null || state === 'error' || (state === 'ask' && attestation)) void load(attestation);
      }}
      head={!bare && <SnippetReason title={s.title} reason={s.reason} severity={s.severity} />}
      aside={!bare && <SnippetMeta {...s} />}
    >
      {state && typeof state === 'object' && 'withheld' in state ? (
        <WithheldReply
          className="mx-1.5"
          level={state.withheld}
          summary={state.summary}
          url={`${NEXT_PUBLIC_URL}${s.href}`}
          name={`${s.evalName} ${s.sample.id}`}
        />
      ) : state === null || state === 'loading' ? (
        <div role="status" className="flex min-h-80 flex-1 flex-col items-center justify-center gap-y-2 text-slate-500">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          Loading Chat…
        </div>
      ) : !attestation || state === 'ask' ? (
        <AttestationForm onDone={(a) => void load(a)} />
      ) : state === 'error' ? (
        <p className="text-rose-700">Could not load the conversation.</p>
      ) : state === 'hidden' ? (
        <p className="text-slate-500">The dataset&apos;s terms do not let you read this conversation here.</p>
      ) : (
        <ExcerptMessages excerpt={state} maxHeight="" />
      )}
    </EvidenceCard>
  );
}

/** A link to an eval run. On hover: the eval, the run and its headline result. `className`: the
 * link's style. */
export function RunHover({ run: r, className, children }: { run: RunRef; className?: string; children: ReactNode }) {
  return (
    <EvidenceCard
      href={r.href}
      trigger={children}
      triggerClassName={className}
      className="w-96"
      head={
        <>
          <span className="flex flex-wrap items-center gap-x-1.5">
            <span className="font-semibold text-slate-800">{r.evalName}</span>
            <EvalStatusTag status={r.evalStatus} />
          </span>
          <span className="text-slate-500">
            Eval run · {r.date}
            {r.samples ? ` · ${r.samples.toLocaleString('en-US')} samples` : ''}
            {r.limited ? ' · limited' : ''}
          </span>
        </>
      }
    >
      {r.result ? (
        <div className="flex pb-4">
          <ScoreBar result={r.result} />
        </div>
      ) : (
        <span className="text-slate-400">No result</span>
      )}
    </EvidenceCard>
  );
}
