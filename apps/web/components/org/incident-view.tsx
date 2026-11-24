import { ChatBubble, ChatPre, ThinkingView, ToolCallView } from '@/components/chat';
import Link from '@/components/link';
import { Markdown } from '@/components/markdown';
import { IncidentCategory } from '@/components/org/incident-category';
import { LogScrubber, type ScrubItem } from '@/components/org/log-scrubber';
import { MoreModels } from '@/components/org/more-models';
import { prisma } from '@/lib/db';
import { isPlaceholderModel } from '@/lib/model-links';
import {
  firstSourceDate,
  formatDate,
  hostOf,
  incidentDownloadPath,
  laterDisclosure,
  storyUrl,
} from '@/lib/org-research';
import { findOrganization, modelPath } from '@/lib/server/catalog';
import { getIncident } from '@/lib/server/org-research';
import { cn } from '@/lib/utils';
import type { IncidentLog, IncidentLogStep, OrgSource } from '@openaudit/spec';
import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';

/** An incident by its organization (a slug or alias) and its slug, with its models in its order.
 * `redirect`: the organization is not named by its slug. Null: no such incident. */
export async function loadIncident(owner: string, slug: string) {
  const named = await findOrganization(owner);
  if (!named) return null;
  const found = await getIncident(named.org.id, slug);
  if (!found) return null;
  const ids = found.incident.modelIds ?? [];
  const models = ids.length
    ? await prisma.model.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, displayName: true, hidden: true, organization: { select: { hidden: true } } },
      })
    : [];
  models.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  return { ...found, models, org: named.org, redirect: named.redirect };
}

export type FoundIncident = NonNullable<Awaited<ReturnType<typeof loadIncident>>>;

/** The space above a `LogScrubber` target: the navbar, and the scrubber's bar under `md`. From `lg`
 * up, the page's column scrolls, under the bars. */
const SCRUB_TARGET =
  'scroll-mt-[calc(7.5rem+env(safe-area-inset-top))] md:scroll-mt-[calc(4rem+env(safe-area-inset-top))] lg:scroll-mt-3';

/** A source list from the database: sources, or their URLs alone. */
const sourcesOf = (list: unknown): OrgSource[] =>
  (Array.isArray(list) ? list : []).flatMap((s) =>
    typeof s === 'string' ? [{ url: s }] : typeof s?.url === 'string' ? [s as OrgSource] : [],
  );

/** One incident: its category, title, facts and story link, a short description, then its
 * log excerpts or, when several stories cover it, a short timeline. */
export function IncidentView({ found }: { found: FoundIncident }) {
  const { incident: i, events, models, org } = found;
  const today = new Date().toISOString().slice(0, 10);
  const shown = events.filter((e) => e.date <= today);
  // The first source is the primary one (the lab's report, the paper, or the first story).
  const story = i.sources[0]?.url ?? storyUrl(i.sources, ...shown.map((e) => e.sources));
  const urls = new Set([...i.sources, ...shown.flatMap((e) => sourcesOf(e.sources))].map((s) => s.url));
  const logs = i.logs ?? [];
  const [first, ...others] = models;
  const start = formatDate(i.date, i.datePrecision);
  const end = formatDate(i.endDate);
  const disclosed = laterDisclosure({ date: i.date, disclosed: firstSourceDate(i.sources) });

  return (
    <article className="flex min-w-0 flex-col gap-y-4 lg:h-full">
      <header className="flex shrink-0 flex-col gap-y-1">
        <IncidentCategory category={i.primaryCategory} className="text-xs/4" />
        <h1 className="font-display text-base font-semibold break-words text-slate-800 sm:text-lg">{i.title}</h1>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span className="tabular-nums">{end ? `${start} – ${end}` : start}</span>
          {disclosed && (
            <>
              <Dot />
              <span className="tabular-nums">Disclosed {formatDate(disclosed)}</span>
            </>
          )}
          {story && (
            <>
              <Dot />
              <a
                href={story}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-x-1 hover:text-slate-700 hover:underline"
              >
                {hostOf(story)}
                <ExternalLink aria-hidden className="size-3" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </>
          )}
          {first && (
            <>
              <Dot />
              <span className="inline-flex gap-x-1">
                {hrefOf(first) ? (
                  <Link href={hrefOf(first)!} className="hover:text-slate-700 hover:underline">
                    {first.displayName}
                  </Link>
                ) : (
                  <span>{first.displayName}</span>
                )}
                <MoreModels models={others.map((m) => ({ key: m.id, label: m.displayName, href: hrefOf(m) }))} />
              </span>
            </>
          )}
          <Dot />
          <a href={incidentDownloadPath(org, i.slug)} download className="font-medium text-sky-800 hover:underline">
            {logs.length ? 'Download with Logs' : 'Download'}
          </a>
        </p>
      </header>

      {/* From `lg` up, only this part scrolls, so the head stays in view. */}
      <div className="flex min-w-0 flex-col gap-y-5 lg:[container-type:size] lg:relative lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
        <div id="summary" className={SCRUB_TARGET}>
          <Markdown text={i.description} className="max-w-3xl text-[13px]/normal text-slate-800" />
        </div>

        {logs.length > 0 && <IncidentLogs logs={logs} />}

        {logs.length === 0 && shown.length > 1 && urls.size > 1 && (
          <ol className="flex flex-col gap-y-1.5 text-sm">
            {shown.map((e) => {
              const href = sourcesOf(e.sources)[0]?.url;
              return (
                <li key={e.id} className="flex gap-x-3">
                  <span className="w-24 shrink-0 text-xs/5 text-slate-500 tabular-nums">
                    {formatDate(e.date, e.datePrecision)}
                  </span>
                  <span className="min-w-0 text-slate-700">
                    {href ? <OutLink href={href}>{e.title}</OutLink> : e.title}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {i.sources.length > 1 && (
          <ul className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {i.sources.map((s, k) => (
              <li key={s.url} className="inline-flex items-center gap-x-2">
                {k > 0 && <Dot />}
                <OutLink href={s.url}>{s.publisher ?? hostOf(s.url)}</OutLink>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

/** A model's page, or none for a hidden model or organization, or a placeholder name. */
const hrefOf = (m: FoundIncident['models'][number]) =>
  m.hidden || m.organization.hidden || isPlaceholderModel(m.name) ? undefined : modelPath(m);

const Dot = () => (
  <span className="text-slate-300" aria-hidden>
    ·
  </span>
);

function OutLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-sky-800 hover:underline">
      {children}
      <ExternalLink aria-hidden className="ml-1 inline size-3 -translate-y-px text-slate-400" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/** The excerpts, in a group for each source, with a scrubber. One excerpt has no scrubber or number. */
function IncidentLogs({ logs }: { logs: IncidentLog[] }) {
  const groups: IncidentLog[][] = [];
  for (const l of logs) {
    const last = groups.at(-1);
    if (last && last[0].source.url === l.source.url) last.push(l);
    else groups.push([l]);
  }
  const number = new Map(logs.map((l, k) => [l, k + 1]));
  if (logs.length === 1) return <Excerpt log={logs[0]} n={1} plain />;
  const items: ScrubItem[] = [
    { id: 'summary', label: 'Incident Summary' },
    ...logs.map((l, k) => ({ id: `log-${k + 1}`, label: l.title, n: k + 1 })),
  ];
  return (
    <div className="flex flex-col gap-y-4 md:grid md:grid-cols-[10rem_minmax(0,1fr)] md:gap-x-5 xl:grid-cols-[12rem_minmax(0,1fr)]">
      <LogScrubber items={items} />
      <div className="flex min-w-0 flex-col gap-y-6">
        {groups.map((g) => {
          const models = [...new Set(g.map((l) => l.model).filter(Boolean))];
          return (
            <div key={g[0].source.url} className="flex flex-col gap-y-4">
              {g.map((l) => (
                <Excerpt
                  key={number.get(l)}
                  log={l}
                  n={number.get(l)!}
                  model={models.length > 1 ? l.model : undefined}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** `plain`: no number at the left. */
function Excerpt({ log, n, model, plain }: { log: IncidentLog; n: number; model?: string; plain?: boolean }) {
  return (
    <div id={`log-${n}`} className={cn('flex gap-x-0.5', SCRUB_TARGET)}>
      {/* The number at the left, so that the text and the chat line up with the title. */}
      {!plain && <span className="w-[1.375rem] shrink-0 text-sm font-semibold text-slate-400 tabular-nums">{n}</span>}
      <div className="flex min-w-0 flex-1 flex-col gap-y-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{log.title}</h3>
          <Markdown text={log.description} className="mt-1 text-[13px] text-slate-600" />
          {(model || log.ocr) && (
            <p className="text-[11px] text-slate-400">
              {model}
              {model && log.ocr && ' · '}
              {log.ocr && 'Text read from a screenshot'}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-y-1.5 rounded-md bg-slate-100 p-2 sm:p-3">
          {log.steps.map((s, k) => (
            <Step key={k} step={s} index={k + 1} />
          ))}
        </div>
      </div>
    </div>
  );
}

const ROLE: Record<IncidentLogStep['role'], string> = {
  system: 'system',
  user: 'user',
  assistant: 'assistant',
  reasoning: 'assistant',
  tool_call: 'assistant',
  tool_result: 'tool',
  note: 'note',
};

/** One step: a note, thinking, a tool call, or a message as a chat bubble with the source's label. */
function Step({ step: s, index }: { step: IncidentLogStep; index: number }) {
  if (s.role === 'note') return <p className="px-1 text-xs text-slate-500 italic">{s.text}</p>;
  if (s.role === 'reasoning')
    return (
      <ThinkingView fixed size="sm" label={s.label ?? 'Thinking'}>
        <p className="text-[13px]/normal whitespace-pre-wrap">{s.text}</p>
      </ThinkingView>
    );
  if (s.role === 'tool_call') {
    // "Tool call (terminal.exec)" shows as "terminal.exec".
    const name = s.label?.replace(/^tool call\b\s*/i, '').replace(/^\((.*)\)$/, '$1');
    return <ToolCallView name={name || undefined} args={s.text} size="sm" />;
  }
  return (
    <ChatBubble role={ROLE[s.role]} label={s.label} index={index} size="sm" actions={<span />}>
      {s.role === 'tool_result' ? (
        <div className="max-h-80 overflow-auto">
          <ChatPre text={s.text} size="sm" />
        </div>
      ) : (
        <p className="text-[13px]/normal whitespace-pre-wrap text-slate-700">{s.text}</p>
      )}
    </ChatBubble>
  );
}
