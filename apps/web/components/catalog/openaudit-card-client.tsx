'use client';

import { FLAGGED_CHATS_ID, useFlaggedTopic } from '@/components/catalog/flagged-topic';
import { ACTION } from '@/components/catalog/model-actions';
import { categoryLabel, Cite, TOPIC_LABELS } from '@/components/catalog/parts';
import { PLACE_OF, PlaceText, STAT_LINK } from '@/components/catalog/place-text';
import { ScoreBar, type Score } from '@/components/catalog/score';
import { EvalLink } from '@/components/eval-link';
import { SnippetHover, type RunRef, type SnippetRef } from '@/components/evidence-hover';
import Link from '@/components/link';
import { RunLink, type PdfDocument } from '@/components/pdf-viewer';
import { useNewEval } from '@/components/runs/new-eval-context';
import { SampleLabel } from '@/components/sample-label';
import { FlagLabel } from '@/components/snippet-summary';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Place } from '@/lib/leaders';
import { isCounted, SEVERITIES, SEVERITY_COLORS } from '@/lib/openaudit-card';
import type { RowState } from '@/lib/runs/eval-table';
import { sampleLabel } from '@/lib/sample-label';
import { cn } from '@/lib/utils';
import type { Topic } from '@openaudit/spec';
import {
  BookCheck,
  Check,
  ChevronDown,
  ChevronRight,
  History as HistoryIcon,
  Lock,
  MessageSquareWarning,
  Plus,
} from 'lucide-react';
import { useRouter } from 'nextjs-toploader/app';
import { useId, type ReactNode } from 'react';

export type VersionOption = { number: number; status: string; date: string; aggregator: string };

const HISTORY_TITLE = 'py-1 text-[10px] font-semibold tracking-wide text-slate-500 uppercase';

/** A version that is not a card version, such as an eval version: a link. */
export type HistoryLink = { label: string; href: string; current: boolean; latest: boolean };

/** The "History" menu: the newest published is the default; another opens with `?v=<n>`. `links`:
 * a section above the card versions, titled `links.title`. `label`: plain text with a caret in
 * place of the History button. */
export function VersionHistory({
  path,
  current,
  latest,
  versions,
  links,
  label,
}: {
  path: string;
  current: number | null;
  latest: number | null;
  versions: VersionOption[];
  links?: { title: string; items: HistoryLink[] };
  label?: ReactNode;
}) {
  const router = useRouter();
  return (
    <DropdownMenu>
      {label ? (
        <DropdownMenuTrigger className="inline-flex items-center gap-x-0.5 hover:text-slate-700 [&[data-state=open]>svg]:rotate-180">
          {label}
          <ChevronDown className="size-3" aria-hidden />
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger className={ACTION}>
          <HistoryIcon aria-hidden />
          History
          <ChevronDown aria-hidden />
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent align={label ? 'start' : 'end'}>
        {links && (
          <>
            <DropdownMenuLabel className={HISTORY_TITLE}>{links.title}</DropdownMenuLabel>
            {links.items.map((l) => (
              <DropdownMenuItem key={l.href} onSelect={() => router.push(l.href)} className="text-xs">
                <Check className={cn('size-3.5', !l.current && 'invisible')} aria-hidden />
                <span className="tabular-nums">{l.label}</span>
                {l.latest && <span className="ml-auto pl-2 text-emerald-700">Latest</span>}
              </DropdownMenuItem>
            ))}
            {versions.length > 0 && <DropdownMenuSeparator />}
          </>
        )}
        {versions.map((v) => (
          <DropdownMenuItem
            key={v.number}
            onSelect={() => router.push(v.number === latest ? path : `${path}?v=${v.number}`)}
            className="text-xs"
          >
            <Check className={cn('size-3.5', v.number !== current && 'invisible')} aria-hidden />
            <span className="tabular-nums">
              V{v.number} · {v.date} · {v.aggregator}
            </span>
            {v.number === latest && <span className="ml-auto pl-2 text-emerald-700">Latest</span>}
            {v.status !== 'published' && <span className="ml-auto pl-2 text-amber-700 capitalize">{v.status}</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** `date`: when its run started (ISO). `tokens`: about the tokens of its transcript (`jlensTokens`). */
export type SnippetView = SnippetRef & { date?: string; tokens?: number | null };

const bySeverity = (a: SnippetView, b: SnippetView) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity);

const PILL =
  'flex w-full min-w-0 items-center justify-between gap-x-1 rounded-md py-1.5 pr-1.5 pl-2 whitespace-nowrap transition-colors [&[data-state=open]>svg]:rotate-180';
const POPOVER_LIST =
  'flex w-80 max-w-[calc(100vw-2rem)] max-h-[min(28rem,var(--radix-popover-content-available-height))] flex-col overflow-hidden p-0';

const CHATS_ICON = <MessageSquareWarning className="size-3 shrink-0" />;
const RUNS_ICON = <BookCheck className="size-3 shrink-0" />;

/** The icon, then the count. Its words are the hover title, and what screen readers get. */
function PillLabel({ count, words, icon }: { count: number; words: [string, string]; icon: ReactNode }) {
  const text = `${count} ${words.join(' ')}`;
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden title={text} className="flex min-w-0 items-center gap-x-1">
        {icon}
        <span className="text-xs/none font-semibold tabular-nums">{count}</span>
      </span>
    </>
  );
}

/** A pill that opens or closes a card on a click. With a count of 0: a grey pill with no card,
 * unless `openEmpty`. */
function PillHover({
  count,
  words,
  icon,
  className,
  cardClassName,
  openEmpty,
  children,
}: {
  count: number;
  words: [string, string];
  icon: ReactNode;
  className: string;
  cardClassName: string;
  openEmpty?: boolean;
  children: (anchor: () => HTMLElement | null) => ReactNode;
}) {
  const id = useId();
  const anchor = () => document.getElementById(id);
  if (!count && !openEmpty)
    return (
      <span className={cn(PILL, 'bg-slate-100/70 text-slate-400')}>
        <PillLabel count={count} words={words} icon={icon} />
      </span>
    );
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button id={id} type="button" className={cn(PILL, className)}>
          <PillLabel count={count} words={words} icon={icon} />
          <ChevronDown className="size-3 shrink-0 transition-transform" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn(POPOVER_LIST, cardClassName)}>
        {children(anchor)}
      </PopoverContent>
    </Popover>
  );
}

/** The most characters of the feed's eval line: the sample id gets what the eval name leaves. */
const FEED_LINE_MAX = 50;

/** A flagged chat in a list: its reason, then its severity, eval, attempt and category. The row
 * links to the attempt (`anchor`: the element to mark) and shows the conversation on hover, a
 * little over the list's right edge. `feed`: its flag label (`FlagLabel`, no icon) above, as no
 * group header shows it; the reason in 3 lines at most; under it the eval and attempt; no hover
 * card. `ref` and `index`: for a virtual list, which measures the row. A lock: the reader cannot
 * open the reply. */
export function FlaggedChat({
  snippet: s,
  anchor,
  feed,
  model,
  side = 'right',
  ref,
  index,
}: {
  snippet: SnippetView;
  ref?: React.Ref<HTMLLIElement>;
  index?: number;
  anchor?: () => HTMLElement | null;
  feed?: boolean;
  /** The side of the row where the chat viewer shows. */
  side?: 'left' | 'right';
  /** The model's name, at the right of the title. */
  model?: string;
}) {
  const lock = (className: string) =>
    s.locked && <Lock aria-label="Restricted" className={cn('size-3 shrink-0 text-slate-400', className)} />;
  const titled = feed || model;
  const label = (
    <span className="sr-only">
      {s.evalName} · sample {sampleLabel(s.sample)}
    </span>
  );
  return (
    <li
      ref={ref}
      data-index={index}
      data-snippet={s.id}
      className="group/row relative flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-sky-50/60"
    >
      <div className="min-w-0 flex-1">
        {titled && (
          <p className="mb-0.5 flex items-center gap-x-2 text-[10px]">
            {feed ? <FlagLabel flag={s.severity} title={s.title} locked={s.locked} noIcon /> : lock('')}
            {model && <span className="ml-auto shrink-0 text-slate-400">{model}</span>}
          </p>
        )}
        <p
          title={feed ? s.reason : undefined}
          className={cn(
            'text-xs text-slate-700',
            feed ? 'line-clamp-3' : 'font-medium',
            !titled && s.locked && 'flex gap-x-1',
          )}
        >
          {!titled && lock('mt-0.5')}
          <span>{s.reason}</span>
        </p>
        <div className={cn('mt-1 text-[10px] text-slate-400', feed && 'flex gap-x-1 whitespace-nowrap')}>
          {feed ? (
            <>
              <span className="shrink-0">{s.evalName}</span>·
              <SampleLabel
                sample={s.sample}
                max={Math.max(16, FEED_LINE_MAX - s.evalName.length - (s.sample.epoch ? 4 : 0))}
                className="min-w-0 truncate"
              />
            </>
          ) : (
            <>
              <span className={cn('font-medium capitalize', SEVERITY_COLORS[s.severity].text)}>
                {s.severity} Severity
              </span>{' '}
              · {s.evalName} <SampleLabel sample={s.sample} /> · {categoryLabel(s.category)}
            </>
          )}
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-slate-400 group-hover/row:text-sky-700" aria-hidden />
      {feed ? (
        <RunLink
          href={s.href}
          snippet={s.id}
          anchor={anchor}
          className="absolute inset-0 data-cite-active:-outline-offset-2"
        >
          {label}
        </RunLink>
      ) : (
        <SnippetHover
          snippet={s}
          anchor={anchor}
          side={side}
          sideOffset={-8}
          bare
          className="absolute inset-0 data-cite-active:-outline-offset-2"
        >
          {label}
        </SnippetHover>
      )}
    </li>
  );
}

/** The snippets in groups by title, the group with the most severe snippet first. Untitled snippets
 * are a group with the title ''. */
function byTitle(snippets: SnippetView[]): [string, SnippetView[]][] {
  const groups = new Map<string, SnippetView[]>();
  for (const s of [...snippets].sort(bySeverity)) {
    const key = s.title ?? '';
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  return [...groups];
}

/** What a pill's list is, at the top of its hover card. */
function HoverNote({ children }: { children: ReactNode }) {
  return <p className="shrink-0 bg-slate-50 px-3 py-2 text-[11px] leading-snug text-slate-500">{children}</p>;
}

/** A topic's or an eval's flagged chats. The count skips low severity, amber; with no others, it
 * counts the low ones, grey. In a `FlaggedTopicProvider`, a click filters the Flagged Chats column
 * to `topic` or `evalName` only, and a second click shows all again. Else a click opens the chats
 * in groups by title (each title a sticky header), most severe first, low too. */
export function TopicSnippets({
  snippets,
  topic,
  evalName,
}: {
  snippets: SnippetView[];
  topic?: string;
  evalName?: string;
}) {
  const shared = useFlaggedTopic();
  const counted = snippets.filter(isCounted).length;
  const n = counted || snippets.length;
  const words: [string, string] = [
    n === 1 ? 'Flagged Chat' : 'Flagged Chats',
    counted || !n ? 'High/Mid Severity' : 'Low Severity',
  ];
  const className = counted
    ? 'bg-slate-100 text-amber-700 hover:bg-slate-200'
    : 'bg-slate-100/70 text-slate-500 hover:bg-slate-200/70';
  if (shared && (topic || evalName)) {
    if (!snippets.length)
      return (
        <span className={cn(PILL, 'bg-slate-100/70 text-slate-400')}>
          <PillLabel count={n} words={words} icon={CHATS_ICON} />
        </span>
      );
    const on = topic ? shared.topic === topic && !shared.evalName : shared.evalName === evalName && !shared.topic;
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={() => {
          shared.setTopic(on ? null : (topic ?? null));
          shared.setEvalName(on ? null : (evalName ?? null));
          if (!on) document.getElementById(FLAGGED_CHATS_ID)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }}
        className={cn(PILL, className, on && 'ring-2 ring-sky-500 ring-inset')}
      >
        <PillLabel count={n} words={words} icon={CHATS_ICON} />
        <ChevronRight className="size-3 shrink-0" aria-hidden />
      </button>
    );
  }
  return (
    <PillHover
      count={n}
      openEmpty={snippets.length > 0}
      words={words}
      icon={CHATS_ICON}
      className={className}
      cardClassName="w-[30rem]"
    >
      {(anchor) => (
        <>
          <div className="overflow-y-auto overscroll-contain">
            {byTitle(snippets).map(([title, group]) => (
              <section key={title}>
                {title && (
                  <h3 className="sticky top-0 z-10 bg-slate-50 px-4 py-1.5">
                    <FlagLabel flag={group[0].severity} title={title} />
                  </h3>
                )}
                <ul className="flex flex-col divide-y divide-slate-100">
                  {group.map((s) => (
                    <FlaggedChat key={s.id} snippet={s} anchor={anchor} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </PillHover>
  );
}

const EVALS_PILL = 'bg-slate-100 text-slate-600 hover:bg-slate-200';

type ResultRowsProps<T> = {
  rows: T[];
  name: (row: T) => ReactNode;
  result: (row: T) => Score | null | undefined;
  place?: (row: T) => Place | undefined;
  evalHref?: (row: T) => string | undefined;
};

/** Evals and their results, one row each: the name (`name`, a link that covers the row) at the
 * left, the model's place (`place`) or else the bar at the right. With `evalHref`, a click on the
 * result opens the eval's page. */
function ResultRows<T>({ rows, name, result, place, evalHref }: ResultRowsProps<T>) {
  return (
    <table className="w-full table-fixed text-xs">
      <tbody className="divide-y divide-slate-100">
        {rows.map((row, i) => {
          const r = result(row);
          const p = place?.(row);
          const href = evalHref?.(row);
          const bar = r && (
            <ScoreBar
              result={r}
              top={p && <PlaceText place={p} className="block text-center text-sm leading-5" ofClassName={PLACE_OF} />}
            />
          );
          return (
            <tr
              key={i}
              className="group/row relative has-[a,button]:cursor-pointer has-[a,button]:not-has-[.stat-link:hover]:hover:bg-sky-50/60"
            >
              <td className="px-3 py-3.5 align-middle">{name(row)}</td>
              <td className="w-44 px-3 py-3.5 align-middle">
                {r ? (
                  // The bottom padding is the room for the metric line under the bar.
                  href ? (
                    <Link href={href} className={cn('flex pb-[13px]', STAT_LINK)}>
                      {bar}
                    </Link>
                  ) : (
                    <div className="flex pb-[13px]">{bar}</div>
                  )
                ) : (
                  <span className="text-slate-400">No result</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const NOT_RUN_STATE: Partial<Record<RowState, string>> = { running: 'Running', requested: 'Waiting for approval' };

const LIST_HEAD =
  'sticky top-0 z-10 border-y border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] font-bold tracking-wide text-slate-500 uppercase';

const RUN_NAME = 'font-medium text-sky-800 group-hover/row:underline after:absolute after:inset-0';

/** A topic's eval runs and system card results. On a click: a table of our runs and their results
 * (a row opens the run in the side panel and the table stays open), then the recommended evals of
 * the topic not run yet, each with a "Queue Run" button, then the system card results ("Unverified
 * Runs"; a row opens its page in the PDF). The pill counts only our runs, and is amber with none.
 * `noEvals`: no active eval covers the topic, with no runs a note says so. */
export function TopicRuns({
  topic,
  runs,
  results = [],
  noEvals,
}: {
  topic: Topic;
  runs: RunRef[];
  results?: SystemResult[];
  noEvals?: boolean;
}) {
  const newEval = useNewEval();
  const notRun = newEval?.evals.filter((e) => e.topics.includes(topic)) ?? [];
  const n = runs.length;
  return (
    <>
      <PillHover
        count={n}
        words={['Evaluation', n === 1 ? 'Run' : 'Runs']}
        icon={RUNS_ICON}
        className={n ? EVALS_PILL : 'bg-amber-50 text-amber-800 hover:bg-amber-100'}
        cardClassName="w-[26rem]"
        openEmpty
      >
        {(anchor) => (
          <>
            {!n && <HoverNote>We have not run an evaluation of this topic yet.</HoverNote>}
            <div className="overflow-y-auto overscroll-contain">
              {n > 0 && (
                <ResultRows
                  rows={runs}
                  result={(r) => r.result}
                  place={(r) => r.place}
                  evalHref={(r) => (r.evalSlug ? `/evaluations/${r.evalSlug}` : undefined)}
                  name={(r) => (
                    <>
                      {r.evalSlug ? (
                        <EvalLink slug={r.evalSlug} href={r.href} side="left" sideOffset={24} className={RUN_NAME}>
                          {r.evalName}
                        </EvalLink>
                      ) : (
                        <Link href={r.href} className={RUN_NAME}>
                          {r.evalName}
                        </Link>
                      )}
                      {r.limited && <span className="ml-1.5 text-[10px] text-slate-400">limited</span>}
                      {r.samples != null && (
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {r.samples.toLocaleString('en-US')} {r.samples === 1 ? 'Chat' : 'Chats'} Tested
                        </div>
                      )}
                    </>
                  )}
                />
              )}
              {notRun.length > 0 && (
                <section>
                  <h3 className={LIST_HEAD}>Not Run Yet</h3>
                  <ul className="flex flex-col divide-y divide-slate-100 text-xs">
                    {notRun.map((e) => (
                      <li key={e.evalId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <EvalLink slug={e.slug} className="min-w-0 truncate font-medium text-sky-800 hover:underline">
                          {e.displayName}
                        </EvalLink>
                        {NOT_RUN_STATE[e.state] ? (
                          <span className="shrink-0 text-slate-500">{NOT_RUN_STATE[e.state]}</span>
                        ) : (
                          newEval?.open && (
                            <Button size="xs" className="shrink-0" onClick={() => newEval.open?.(e.evalId)}>
                              <Plus />
                              Queue Run
                            </Button>
                          )
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {results.length > 0 && (
                <section>
                  <h3 className={LIST_HEAD}>Unverified Runs</h3>
                  <p className="px-3 pt-2 text-[11px] leading-snug text-slate-500">
                    Private evals that the AI developer or their auditors ran.
                  </p>
                  <ResultRows
                    rows={results}
                    result={(r) => r.result}
                    name={(r) => (
                      <>
                        <Cite
                          pdf={r.pdf}
                          {...r.source}
                          stretch
                          anchor={anchor}
                          className="font-medium text-sky-800 group-hover/row:underline"
                        >
                          {r.name}
                        </Cite>
                        {r.details && (
                          <span className="mt-0.5 block text-[10px]/[13px] text-slate-400">{r.details}</span>
                        )}
                      </>
                    )}
                  />
                </section>
              )}
            </div>
            {noEvals && !n && (
              <p className="shrink-0 border-t border-slate-200 px-3 py-2 text-xs text-slate-600">
                We don&apos;t have an evaluation available for {TOPIC_LABELS[topic] ?? topic}.
              </p>
            )}
          </>
        )}
      </PillHover>
    </>
  );
}

/** A result that a system card reports, with its page in the card's PDF. `details`: its settings. */
export type SystemResult = {
  name: string;
  details?: string;
  result: Score;
  pdf?: PdfDocument;
  source?: { page?: string; pdfPage?: number; quote?: string };
};
