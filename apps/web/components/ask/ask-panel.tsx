'use client';

import { MessageBody } from '@/components/ask/message';
import { readScreen } from '@/components/ask/read-screen';
import { startAskTour } from '@/components/ask/start-tour';
import { pageKind, splitTours, toursFor, type AskTour } from '@/lib/ask/pages';
import { cn } from '@/lib/utils';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart, type UIMessage } from 'ai';
import { ArrowUp, LoaderCircle, Play, RotateCcw, Square, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

// The chat panel. Each question carries the page path and what the reader sees (`readScreen`); the
// server loads the page's catalog data. Under `lg` the panel fills the screen.

const TOOL_LABELS: Record<string, string> = {
  search_catalog: 'Searching the site',
  get_model: 'Reading a model page',
  get_system_card: 'Reading a system card',
  get_eval: 'Reading an evaluation page',
  get_organization: 'Reading an organization page',
};

/** A first suggestion: a question to send, or a link to open. */
type Suggestion = string | { label: string; href: string };

/** Suggestions to start with, for each kind of page (`pageKind`). Each must make sense on all pages
 * of its kinds: an evaluation page can be of a model eval or of a method eval. */
const SUGGESTIONS: [kinds: string[], suggestions: Suggestion[]][] = [
  [['home'], ['What is OpenAudit, in short?', 'How do I read the % on each model?']],
  [
    ['model'],
    [
      "Sum up this model's safety results.",
      'What does its Deploymeter score mean?',
      'On which evaluations did it do worst?',
    ],
  ],
  [
    ['model system card', 'system card or report', 'system cards'],
    [
      'What are the most important safety findings here?',
      'Explain the safety framework verdicts in simple words.',
      'How is this different from what OpenAudit found?',
    ],
  ],
  [['evaluation'], ['What does this evaluation test?', 'Who did best and worst on it?', 'How is it scored?']],
  [
    ['models list', 'evaluations list'],
    [
      'What does the % on each model mean?',
      'Why do some models say "Requires Newer Model Evaluation Types"?',
      'How do I compare two models?',
    ],
  ],
  [['model comparison'], ['Sum up how these models differ.', 'Which of these models did best, and on what?']],
  [
    ['topics list'],
    ['Which topics matter most for AI safety?', 'What is the difference between a model eval and a method eval?'],
  ],
  [['topic'], ['What does this topic test?', 'Which models do worst on this topic?']],
  [['organizations list'], ['How are commitment points scored?', 'What are the latest incidents?']],
  [
    ['organization', 'organization incidents', 'organization departures', 'organization models'],
    ["Sum up this organization's commitments and incidents.", 'How are commitment points scored?'],
  ],
  [
    ['commitments dashboard'],
    [
      'How are commitment points scored?',
      'What do Intent, None and Dropped mean?',
      'Which commitments do the fewest organizations meet?',
    ],
  ],
  [
    ['commitment'],
    ['What does this commitment require?', 'Which organizations do best on it?', 'How are commitment points scored?'],
  ],
  [
    ['organization commitment', 'organization commitments'],
    ['Why did this organization get these points?', 'How are commitment points scored?'],
  ],
  [['incident'], ['Sum up this incident.', 'Where does this information come from?']],
  [
    ['methods list'],
    [
      'What is the difference between a probe, a lens and an SAE?',
      'What do the medals and bars mean?',
      'How can I submit my own method?',
    ],
  ],
  [
    ['method'],
    [
      'What does this method do, in simple words?',
      'Which variant is best, and on what?',
      'How can I submit my own variant?',
    ],
  ],
  [['method variant'], ['What does this variant do differently?', 'How did it score on the method evaluations?']],
  [['method leaderboard'], ['Which method leads, and on which evaluation?', 'How are these scores made?']],
  [
    ['method variant results on a method evaluation'],
    ['What do these results mean?', 'How does it compare to the other variants?'],
  ],
  [['run'], ['What do these scores mean?', 'How do I read this run?']],
  [['features'], ['What is the main problem that OpenAudit solves?']],
  [['faqs'], ['How is the Deploymeter score made?', 'Who funds OpenAudit?']],
  [['contribute'], ["I'm new to safety research. Where do I start?", 'How do I submit an evaluation?']],
];
const DEFAULT_SUGGESTIONS: Suggestion[] = [
  { label: 'Open FAQs', href: '/faqs' },
  'Do I need technical or research experience to contribute to OpenAudit?',
];

const suggestions = (path: string) =>
  SUGGESTIONS.find(([kinds]) => kinds.includes(pageKind(path)))?.[1] ?? DEFAULT_SUGGESTIONS;

/** The tours to offer first: the tours that show this kind of page, else the home page's tours on a
 * page with the default suggestions. */
const firstTours = (path: string): AskTour[] => {
  const tours = toursFor(path);
  if (tours.length || SUGGESTIONS.some(([kinds]) => kinds.includes(pageKind(path)))) return tours;
  return toursFor('/');
};

const small = () => !window.matchMedia('(min-width: 64rem)').matches;

export function AskPanel({
  id,
  open,
  onClose,
  embedded = false,
  head,
}: {
  id: string;
  open: boolean;
  onClose: () => void;
  /** Sized to sit inside another panel (the navbar menu), not as a fixed overlay. */
  embedded?: boolean;
  /** Above the title bar. */
  head?: ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/ask' }), []);
  const { messages, sendMessage, setMessages, status, stop, error, clearError } = useChat({ transport });
  const busy = status === 'submitted' || status === 'streaming';
  const tours = firstTours(path);

  const ask = (text: string) => {
    clearError();
    const full = `${path}${location.search}`;
    sendMessage({ text }, { body: { path: full, screen: readScreen(full) } });
  };
  const submit = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    ask(text);
  };
  const reset = () => {
    if (busy) stop();
    setMessages([]);
    clearError();
    setInput('');
    inputRef.current?.focus();
  };
  const startTour = (tour: string) => {
    onClose();
    startAskTour(tour, router);
  };

  useEffect(() => {
    if (open && !small()) inputRef.current?.focus();
  }, [open]);
  // The panel covers the page (small screens) or drops from the navbar: a link in an answer closes it.
  const shownPath = useRef(path);
  useEffect(() => {
    if (path !== shownPath.current && (small() || embedded)) onClose();
    shownPath.current = path;
  }, [path, onClose, embedded]);
  // Follow the answer as it streams in.
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, status, open]);

  return (
    <div
      id={id}
      role="dialog"
      aria-label="Ask OpenAudit"
      data-ask-skip
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
      hidden={!open}
      className={cn(
        'flex flex-col overflow-hidden bg-white [&[hidden]]:hidden',
        embedded
          ? 'h-[24rem] w-full rounded-lg border border-slate-200'
          : 'fixed inset-0 z-50 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] lg:inset-auto lg:right-4 lg:bottom-18 lg:z-40 lg:h-[min(600px,calc(100dvh-8rem))] lg:w-[420px] lg:rounded-lg lg:border lg:border-sky-800 lg:p-0 lg:shadow-xl lg:shadow-slate-900/10',
      )}
    >
      {head}
      <div className="flex shrink-0 items-center gap-x-2 border-b border-slate-200 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-800">Ask OpenAudit</div>
        </div>
        <button
          type="button"
          onClick={reset}
          disabled={messages.length === 0}
          aria-label="Start over"
          title="Start over"
          className="rounded-sm p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-default disabled:text-slate-200 disabled:hover:bg-transparent"
        >
          <RotateCcw className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-sm p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
        {messages.length === 0 ? (
          <div className="py-1">
            <div className="flex flex-col items-start gap-y-1.5">
              {suggestions(path).map((s) => {
                const label = typeof s === 'string' ? s : s.label;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => (typeof s === 'string' ? ask(s) : router.push(s.href))}
                    className="rounded-md border border-slate-200 px-2 py-1 text-left text-xs text-slate-600 transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800"
                  >
                    {label}
                  </button>
                );
              })}
              {tours.map((t) => (
                <TourButton key={t.id} tour={t} onTour={startTour} />
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => <Turn key={m.id} message={m} onTour={startTour} />)
        )}
        {status === 'submitted' && <div className="my-1.5 text-xs text-slate-400">Thinking…</div>}
        {error && <Failure error={error} />}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-slate-200 p-2">
        <div className="flex items-center gap-x-1.5 rounded-md border border-slate-300 bg-white p-2.5 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/40">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Ask a question"
            aria-label="Ask a question"
            className="field-sizing-content max-h-28 min-w-0 flex-1 resize-none bg-transparent text-base leading-relaxed text-slate-700 placeholder:text-slate-400 focus:outline-none lg:text-[13px]"
          />
          <button
            type="button"
            onClick={busy ? stop : submit}
            disabled={!busy && input.trim().length === 0}
            aria-label={busy ? 'Stop' : 'Send'}
            className="mb-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-700 text-white transition-colors hover:bg-slate-800 disabled:cursor-default disabled:bg-slate-200 lg:size-6"
          >
            {busy ? <Square className="size-2.5 fill-current" /> : <ArrowUp className="size-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function Turn({ message, onTour }: { message: UIMessage; onTour: (tour: string) => void }) {
  if (message.role === 'user') {
    const text = message.parts.map((p) => (p.type === 'text' ? p.text : '')).join('');
    return (
      <div className="my-2 flex justify-end">
        <div className="max-w-[85%] rounded-lg rounded-br-sm bg-sky-50 px-2.5 py-1.5 text-[13px] leading-relaxed whitespace-pre-wrap text-slate-700">
          {text}
        </div>
      </div>
    );
  }
  // Each step of the answer starts with a `step-start` part. A step that calls a tool is a lookup:
  // it shows only as its label while it runs, not its text. The other steps are the answer.
  const steps: UIMessage['parts'][] = [[]];
  for (const p of message.parts) {
    if (p.type === 'step-start') steps.push([]);
    else steps[steps.length - 1].push(p);
  }
  const answer = steps
    .filter((step) => !step.some(isToolUIPart))
    .flatMap((step) => step.flatMap((p) => (p.type === 'text' && p.text.trim() ? [p.text.trim()] : [])))
    .join('\n\n');
  const running = message.parts.filter(
    (p) => isToolUIPart(p) && (p.state === 'input-streaming' || p.state === 'input-available'),
  );
  const { text, tours } = splitTours(answer);
  return (
    <div className="my-2">
      {running.map((p, i) => (
        <div key={i} className="my-1 flex items-center gap-x-1.5 text-xs text-slate-400">
          <LoaderCircle className="size-3 animate-spin" />
          {TOOL_LABELS[p.type.replace(/^tool-/, '')] ?? 'Looking this up'}…
        </div>
      ))}
      <MessageBody text={text} />
      {tours.map((t) => (
        <TourButton key={t.id} tour={t} onTour={onTour} className="mt-2" />
      ))}
    </div>
  );
}

function TourButton({
  tour,
  onTour,
  className,
}: {
  tour: AskTour;
  onTour: (tour: string) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onTour(tour.id)}
      className={cn(
        'flex items-center gap-x-1.5 rounded-full px-3.5 py-1.5 text-left text-xs font-semibold text-white transition-colors',
        tour.slate ? 'bg-slate-600 hover:bg-slate-500' : 'bg-emerald-700 hover:bg-emerald-600',
        className,
      )}
    >
      <Play aria-hidden className="size-3 shrink-0 fill-current" />
      Start Tutorial: {tour.label}
    </button>
  );
}

/** A refusal from the route arrives as its JSON body; show its sentence. */
function Failure({ error }: { error: Error }) {
  let detail: string | null = null;
  try {
    const parsed: unknown = JSON.parse(error.message);
    if (parsed && typeof parsed === 'object' && 'error' in parsed) detail = String(parsed.error);
  } catch {}
  return (
    <div className="my-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs leading-relaxed text-amber-900">
      {detail ?? 'The assistant could not be reached. Check your connection and try again.'}
    </div>
  );
}
