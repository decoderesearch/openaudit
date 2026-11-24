'use client';

import { BAND_TEXT } from '@/components/catalog/place-text';
import { safeShare, SafetyBar } from '@/components/catalog/score';
import { CARD_LIST, MODEL_CARD_HEAD, SnippetTitle } from '@/components/catalog/snippet-feed';
import { ModelPicker } from '@/components/compare/model-picker';
import { Meter } from '@/components/deploymeter/meter';
import { EvalLink } from '@/components/eval-link';
import Link from '@/components/link';
import { bestOf, COMPARE_MAX, compareHref, compareLatestHref, modelNameOf } from '@/lib/compare';
import { CHAT_GROUP_STYLES, CHAT_GROUPS, shortCount } from '@/lib/feed';
import { placeBand, placeTitle, scoreText } from '@/lib/leaders';
import { ordinal } from '@/lib/methods';
import { EVALUATIONS_HASH } from '@/lib/openaudit-card';
import type { CompareModel } from '@/lib/server/compare';
import type { FeedEval, SnippetFeedEntry } from '@/lib/server/snippet-feed';
import { HIDDEN_TOPICS, TOPIC_LABELS, topicSlug } from '@/lib/topics';
import { cn } from '@/lib/utils';
import type { Topic } from '@openaudit/spec';
import { MessageSquareWarning } from 'lucide-react';
import { useRouter } from 'nextjs-toploader/app';
import { useEffect, useRef, useState, useTransition, type CSSProperties, type ReactNode, type RefObject } from 'react';

/** Under `sm`, a row's label is a line above its cells, and the columns scroll. From `sm` up, the
 * label is a column at the left, and it stays in view when the columns scroll. */
const LABEL =
  'col-span-full min-w-0 border-t border-slate-200 pt-2 text-[10px] font-semibold tracking-wide text-slate-500 uppercase sm:sticky sm:left-0 sm:z-[1] sm:col-span-1 sm:bg-white sm:py-2 sm:pr-3 sm:text-xs sm:font-medium sm:tracking-normal sm:text-slate-600 sm:normal-case';
/** `isolate`: a cell's own layers (as the Deploymeter's) stay under the sticky head. */
const CELL =
  'isolate min-w-0 rounded-md px-2 py-1.5 text-xs text-slate-700 sm:rounded-none sm:border-t sm:border-slate-100 sm:py-2';
const BEST = 'bg-emerald-50';
/** From `lg` up, the columns' head stays under the navbar and the breadcrumbs. */
const HEAD = 'bg-white lg:sticky lg:top-[calc(5.25rem+env(safe-area-inset-top))] lg:z-[2]';
/** The stuck head's line. A shadow: no change of height. The right part covers the column gap. */
const STUCK = 'lg:shadow-[0.25rem_0_0_white,0_1px_0_var(--color-slate-200),0.25rem_1px_0_var(--color-slate-200)]';
const NONE = <span className="text-slate-300">—</span>;
const NOT_RUN = <span className="text-slate-300">Not run</span>;

type Column = { name: string; model: CompareModel | null };

/** The models of the URL side by side. A remove changes the URL with no load; a pick loads the
 * page for the new models. `names` and `models`: from the URL, in its order. */
export function CompareView({
  names,
  models,
  choices,
}: {
  names: string[];
  models: (CompareModel | null)[];
  choices: SnippetFeedEntry[];
}) {
  const router = useRouter();
  const columns = () => names.map((name, i) => ({ name, model: models[i] ?? null }));
  const [cols, setCols] = useState<Column[]>(columns);
  const [picking, setPicking] = useState<{ index: number; name: string } | null>(null);
  // Each model that a load sent. A pick of only these models needs no load.
  const [known, setKnown] = useState(() => new Map(columns().map((c) => [c.name, c.model])));
  // Each load of the page, after a pick, sends new `models`: the view starts again from them.
  const [from, setFrom] = useState(models);
  if (from !== models) {
    setFrom(models);
    setCols(columns());
    setKnown(new Map([...known, ...columns().map((c) => [c.name, c.model] as const)]));
    setPicking(null);
  }
  const [, start] = useTransition();
  const grid = useRef<HTMLDivElement>(null);
  const stuck = useStuck(grid);
  const slots = Math.max(2, Math.min(COMPARE_MAX, cols.length + 1));
  const shown = Array.from({ length: slots }, (_, i) => cols[i]?.model ?? null);
  const label = (name: string) => choices.find((c) => modelNameOf(c.href) === name)?.label ?? null;

  const remove = (i: number) => {
    const next = cols.filter((_, j) => j !== i);
    setCols(next);
    history.replaceState(null, '', compareHref(next.map((c) => c.name)));
  };
  const pick = (i: number, name: string) => {
    const next = cols.map((c) => c.name);
    next[i] = name;
    const list = next.filter(Boolean);
    if (list.every((n) => known.has(n))) {
      setCols(list.map((n) => ({ name: n, model: known.get(n) ?? null })));
      history.replaceState(null, '', compareHref(list));
      return;
    }
    setPicking({ index: i, name });
    start(() => router.push(compareHref(list), { scroll: false }));
  };

  return (
    <div className="-mx-4 overflow-x-auto border-y border-slate-200 bg-white px-3 pb-4 sm:mx-0 sm:rounded-lg sm:border-x lg:overflow-visible">
      <div
        ref={grid}
        style={{ '--n': slots } as CSSProperties}
        className="grid grid-cols-[repeat(var(--n),minmax(9.5rem,1fr))] gap-x-1 sm:grid-cols-[9rem_repeat(var(--n),minmax(10rem,1fr))] lg:grid-cols-[10rem_repeat(var(--n),minmax(8.5rem,calc((100%_-_10rem)/3_-_0.25rem)))]"
      >
        <div className={cn(HEAD, stuck && STUCK, 'hidden sm:sticky sm:left-0 sm:z-[2] sm:block')} />
        {Array.from({ length: slots }, (_, i) => {
          const col = cols[i];
          const busy = picking?.index === i;
          const name = busy ? picking.name : (col?.name ?? null);
          return (
            <div key={i} className={cn(HEAD, stuck && STUCK, 'flex min-w-0 flex-col gap-y-1.5 px-1 pt-3 pb-3')}>
              <ModelPicker
                index={i}
                current={name}
                label={name && label(name)}
                choices={choices}
                taken={cols.filter((_, j) => j !== i).map((c) => c.name)}
                loading={busy}
                onPick={(n) => pick(i, n)}
                onRemove={col && !busy ? () => remove(i) : undefined}
              />
              {col?.model && !busy && <ModelHead model={col.model} />}
              {col && !col.model && !busy && <span className="px-1 text-xs text-slate-400">No OpenAudit card</span>}
            </div>
          );
        })}

        {shown.some(Boolean) ? (
          <Rows models={shown} />
        ) : (
          <p className="col-span-full border-t border-slate-200 py-6 text-sm text-slate-500">
            Choose 2 or more models.{' '}
            {choices.length > 1 && (
              <Link href={compareLatestHref(choices)} className="text-sky-700 hover:underline">
                Compare the 2 newest cards
              </Link>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

/** True when the grid's top is above the line where its head sticks, so the head is stuck. */
function useStuck(ref: RefObject<HTMLDivElement | null>) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const grid = ref.current;
    const head = grid?.children[1];
    if (!grid || !head) return;
    const check = () => {
      const s = getComputedStyle(head);
      setOn(s.position === 'sticky' && grid.getBoundingClientRect().top < parseFloat(s.top));
    };
    check();
    addEventListener('scroll', check, { passive: true });
    addEventListener('resize', check);
    return () => {
      removeEventListener('scroll', check);
      removeEventListener('resize', check);
    };
  }, [ref]);
  return on;
}

/** A column's model: its org and its name. */
function ModelHead({ model: m }: { model: CompareModel }) {
  return (
    <div className="flex min-w-0 flex-col px-1">
      <Link
        href={m.org.href}
        className="max-w-full self-start truncate text-[9px] leading-3 font-semibold tracking-wide text-slate-400 uppercase hover:text-sky-700"
      >
        {m.org.label}
      </Link>
      <Link
        href={m.href}
        className="max-w-full self-start truncate text-sm font-semibold text-slate-800 hover:text-sky-800 hover:underline"
      >
        {m.label}
      </Link>
    </div>
  );
}

function Rows({ models }: { models: (CompareModel | null)[] }) {
  const each = (show: (m: CompareModel) => ReactNode) => models.map((m) => (m ? show(m) : null));
  const value = <T,>(get: (m: CompareModel) => T) => models.map((m) => (m ? get(m) : undefined));
  const evals = evalRows(models);
  const topics = topicRows(models);
  const wins = models.map((m, i) => (m ? evals.filter((row) => row.best[i]).length : null));

  return (
    <>
      <Section title="Overview" first />
      <Row
        label="Deploymeter"
        best={bestOf(
          value((m) => m.meter),
          'max',
        )}
        cells={each((m) => (
          <Meter score={m.meter} judges={m.judges} href={m.href} model={m.label} large />
        ))}
      />
      <Row
        label="Judge Summary"
        cells={each((m) =>
          m.summary ? (
            <p title={m.summary} className="line-clamp-6 text-[11px] leading-snug text-slate-600">
              {m.summary}
            </p>
          ) : (
            NONE
          ),
        )}
      />
      <Row
        label="Flagged Chats"
        best={bestOf(
          value((m) => m.counts.high + m.counts.medium),
          'min',
        )}
        cells={each((m) => (
          <ChatCounts counts={m.counts} />
        ))}
      />
      <Row
        label="Incidents"
        cells={each((m) =>
          m.incidents ? (
            <span className="tabular-nums">{m.incidents}</span>
          ) : (
            <span className="text-slate-500">None</span>
          ),
        )}
      />

      {evals.length > 0 && (
        <>
          <Section
            title="Evaluations"
            cells={
              models.filter(Boolean).length > 1
                ? wins.map(
                    (n, i) =>
                      n !== null && (
                        <span key={i} className={n ? 'text-emerald-700' : 'text-slate-400'}>
                          Better on {n} {n === 1 ? 'Eval' : 'Evals'}
                        </span>
                      ),
                  )
                : undefined
            }
          />
          {evals.map((row) => (
            <Row
              key={row.slug}
              label={
                <EvalLink slug={row.slug} className="hover:text-sky-800 hover:underline">
                  {row.label}
                </EvalLink>
              }
              best={row.best}
              cells={models.map((m, i) => {
                const e = row.cells[i];
                return m ? e ? <EvalCell key={i} eval={e} /> : NOT_RUN : null;
              })}
            />
          ))}
        </>
      )}

      {topics.length > 0 && (
        <>
          <Section title="Topics" />
          {topics.map((row) => (
            <Row
              key={row.topic}
              label={TOPIC_LABELS[row.topic as Topic] ?? row.topic}
              best={row.best}
              cells={models.map((m, i) => (m ? <TopicCell key={i} model={m} topic={row.topic} /> : null))}
            />
          ))}
        </>
      )}
    </>
  );
}

/** A section's title. `first`: less space above. `cells`: a line for each column, at the title's
 * right. */
function Section({ title, first, cells }: { title: string; first?: boolean; cells?: ReactNode[] }) {
  const space = first ? 'mt-2' : 'mt-6';
  const line = 'border-b border-slate-300 pb-1';
  if (!cells)
    return (
      <h2 className={cn('col-span-full text-sm font-semibold text-slate-800', line, space)}>
        <span className="sticky left-0 inline-block">{title}</span>
      </h2>
    );
  return (
    <>
      <h2
        className={cn(
          'col-span-full text-sm font-semibold text-slate-800 sm:sticky sm:left-0 sm:z-[1] sm:col-span-1 sm:bg-white',
          line,
          space,
        )}
      >
        <span className="sticky left-0 inline-block sm:static">{title}</span>
      </h2>
      {cells.map((c, i) => (
        <div
          key={i}
          className={cn(
            'min-w-0 truncate px-2 text-[11px] font-medium sm:self-end',
            line,
            first ? 'sm:mt-2' : 'sm:mt-6',
          )}
        >
          {c}
        </div>
      ))}
    </>
  );
}

/** A row: its label, then a cell for each column. A `best` cell is green. */
function Row({ label, cells, best }: { label: ReactNode; cells: ReactNode[]; best?: boolean[] }) {
  return (
    <>
      <div className={LABEL}>
        <span className="sticky left-0 inline-flex flex-col sm:static">{label}</span>
      </div>
      {cells.map((c, i) => (
        <div key={i} className={cn(CELL, best?.[i] && BEST)}>
          {c}
        </div>
      ))}
    </>
  );
}

/** The high, medium, and low flagged chats, each by its icon's color. */
function ChatCounts({ counts }: { counts: CompareModel['counts'] }) {
  return (
    <span className="flex flex-wrap gap-x-2.5 gap-y-0.5">
      {CHAT_GROUPS.map((g) => (
        <span
          key={g}
          title={`${counts[g]} ${CHAT_GROUP_STYLES[g].label.toLowerCase()}`}
          className="flex items-center gap-x-0.5 tabular-nums"
        >
          <MessageSquareWarning aria-hidden className={cn('size-3', CHAT_GROUP_STYLES[g].icon)} />
          {shortCount(counts[g])}
        </span>
      ))}
    </span>
  );
}

/** A model's result on an eval, as a link to the run: its place among all models (else a bar), then
 * its high and medium flagged chats. */
function EvalCell({ eval: e }: { eval: FeedEval }) {
  const n = e.flags.high + e.flags.medium;
  return (
    <Link href={e.href} hover={false} className="group/eval flex items-center justify-between gap-x-2">
      {e.place ? (
        <span
          title={placeTitle(e.place)}
          className={cn(
            'text-sm leading-5 font-bold tabular-nums group-hover/eval:underline',
            BAND_TEXT[placeBand(e.place)],
          )}
        >
          {ordinal(e.place.rank)}
        </span>
      ) : e.result ? (
        <span title={scoreText(e.result)}>
          <SafetyBar result={e.result} className="h-1.5 w-14" />
        </span>
      ) : (
        NONE
      )}
      {n > 0 && (
        <span title={`${n} high or medium flagged chats`} className="flex shrink-0 items-center gap-x-0.5 tabular-nums">
          <MessageSquareWarning
            aria-label="Flagged chats"
            className={cn('size-3', CHAT_GROUP_STYLES[e.flags.high ? 'high' : 'medium'].icon)}
          />
          {shortCount(n)}
        </span>
      )}
    </Link>
  );
}

/** A model's flagged chats on a topic, as in the navbar's model rows: their number, then the first
 * chats and "N more". Both links open the model page's chats of the topic. "Not tested": no eval of
 * the model has the topic. */
function TopicCell({ model: m, topic }: { model: CompareModel; topic: string }) {
  const t = m.topicChats.find((x) => x.topic === topic);
  if (!m.tested.includes(topic)) return <span className="text-slate-300">Not tested</span>;
  if (!t?.total) return <span className="text-slate-400">No flagged chats</span>;
  const href = `${m.href}?topic=${topicSlug(topic as Topic)}#${EVALUATIONS_HASH}`;
  const more = t.total - t.chats.length;
  return (
    <div className="flex min-w-0 flex-col gap-y-0.5">
      <Link href={href} hover={false} className={cn(MODEL_CARD_HEAD, 'self-start')}>
        <MessageSquareWarning aria-hidden className="size-2.5" strokeWidth={2.5} />
        {shortCount(t.total)} {t.total === 1 ? 'Flagged Chat' : 'Flagged Chats'}
      </Link>
      <ul
        aria-label="Flagged chats"
        className={cn('flex min-w-0 flex-col gap-y-0.5 text-[11px] text-slate-600', CARD_LIST)}
      >
        {t.chats.map((s) => (
          <SnippetTitle key={s.id} snippet={s} />
        ))}
        {more > 0 && (
          <li>
            <Link
              href={href}
              hover={false}
              className="text-[10px] font-medium text-slate-400 hover:text-sky-800 hover:underline"
            >
              {shortCount(more)} more…
            </Link>
          </li>
        )}
      </ul>
    </div>
  );
}

/** Each eval that a model has a result on: the evals that the most models ran first, and the evals
 * with no safe direction last. `best`: the best place among the models, else the safest result. */
function evalRows(models: (CompareModel | null)[]) {
  const all = new Map<string, { slug: string; label: string; n: number; safe: boolean }>();
  for (const e of models.flatMap((m) => m?.evals.filter((x) => x.result) ?? [])) {
    const row = all.get(e.slug) ?? { slug: e.slug, label: e.label, n: 0, safe: false };
    const d = e.result?.safetyDirection;
    all.set(e.slug, { ...row, n: row.n + 1, safe: row.safe || (!!d && d !== 'neither') });
  }
  return [...all.values()]
    .sort((a, b) => +b.safe - +a.safe || b.n - a.n || a.label.localeCompare(b.label))
    .map((row) => {
      const cells = models.map((m) => m?.evals.find((e) => e.slug === row.slug));
      const scored = cells.map((e) => (e?.result ? e : undefined));
      const best = scored.every((e) => !e || e.place)
        ? bestOf(
            scored.map((e) => e?.place?.rank),
            'min',
          )
        : bestOf(
            scored.map((e) => (e?.result ? safeShare(e.result) : undefined)),
            'max',
          );
      return { ...row, cells, best };
    });
}

/** Each topic that a model has flagged chats on, or that its evals test: the topics with the most
 * high and medium chats first. `best`: the fewest high and medium chats, of the models with the
 * topic. */
function topicRows(models: (CompareModel | null)[]) {
  const topics = new Set(models.flatMap((m) => [...(m?.tested ?? []), ...(m?.topicChats.map((t) => t.topic) ?? [])]));
  const counted = (m: CompareModel | null, topic: string) =>
    m?.tested.includes(topic) ? (m.topicChats.find((t) => t.topic === topic)?.counted ?? 0) : undefined;
  const total = (topic: string) => models.reduce((n, m) => n + (counted(m, topic) ?? 0), 0);
  return [...topics]
    .filter((t) => t in TOPIC_LABELS && !HIDDEN_TOPICS.includes(t))
    .sort((a, b) => total(b) - total(a) || a.localeCompare(b))
    .map((topic) => ({
      topic,
      best: bestOf(
        models.map((m) => counted(m, topic)),
        'min',
      ),
    }));
}
