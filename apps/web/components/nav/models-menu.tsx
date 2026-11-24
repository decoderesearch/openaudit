'use client';

import { EvalsTooOld } from '@/components/catalog/evals-too-old';
import { SnippetFeedRow } from '@/components/catalog/snippet-feed';
import { SearchToggle } from '@/components/catalog/title-search';
import { lined } from '@/components/infinite-feed';
import Link from '@/components/link';
import { COLUMN_BLUR, COLUMN_HEAD, COLUMN_LIST, MenuEvals } from '@/components/nav/menu-evals';
import {
  filterItems,
  MENU_MAX_HEIGHT,
  MENU_TITLE,
  MenuBlurHead,
  MenuFeed,
  MenuIncidents,
  MenuPageLink,
  NavMenu,
  ROW_LINK,
} from '@/components/nav/nav-menu';
import { NewestModelsNote } from '@/components/newest-models-note';
import { MODEL_FEED_TITLES, NAV_MODEL_FEEDS } from '@/lib/feed';
import { formatShortDate } from '@/lib/org-research';
import { searchModels } from '@/lib/search-match';
import type { OtherModel } from '@/lib/server/home-models';
import type { NavFeedEntry, NavModels } from '@/lib/server/nav-models';
import type { SnippetFeedEntry } from '@/lib/server/snippet-feed';
import { useReveal } from '@/lib/use-reveal';
import { cn } from '@/lib/utils';
import { Bot } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

/** The width of the Models column and of the Model Evaluations column, in px. */
const COLUMN_WIDTH = 360;

/** The navbar's Models menu: the models with flagged chats (no filter), the model evals with their
 * worst and best models, and the newest entries of each feed in `NAV_MODEL_FEEDS`. */
export function ModelsMenu({ active }: { active: boolean }) {
  return (
    <NavMenu<NavModels>
      label="Models"
      icon={Bot}
      href="/models"
      active={active}
      api="/api/nav-models"
      noun="models"
      width={2 * COLUMN_WIDTH + 390 * NAV_MODEL_FEEDS.length}
      maxHeight={MENU_MAX_HEIGHT}
      inlineFilter
      body={ModelsBody}
    />
  );
}

function ModelsBody({ data, filter, onPick }: { data: NavModels; filter: string; onPick: () => void }) {
  // The browser can keep a response from before a deploy, in an older form, for a short time.
  const { feeds = {}, models = [], others = [], evals = [], evalCount = 0, evalTotal, counts } = data;
  const columns = [`${COLUMN_WIDTH}px`, `${COLUMN_WIDTH}px`, ...NAV_MODEL_FEEDS.map(() => 'minmax(0, 1fr)')];
  return (
    <div className="grid divide-x-4 divide-slate-100" style={{ gridTemplateColumns: columns.join(' ') }}>
      <Models cards={models.filter((m) => m.counts)} others={others} count={counts?.models} onPick={onPick} />
      <MenuEvals
        title="Model Evaluations"
        evals={evals.filter((e) => Array.isArray(e.worst)).sort((a, b) => a.label.localeCompare(b.label))}
        count={evalTotal || undefined}
        more={evalCount - evals.length}
        href="/models"
        onPick={onPick}
      />
      {NAV_MODEL_FEEDS.map((k) => (
        <Feed key={k} title={MODEL_FEED_TITLES[k]} entries={feeds[k] ?? []} filter={filter} onPick={onPick} />
      ))}
    </div>
  );
}

function Feed({
  title,
  entries,
  filter,
  onPick,
}: {
  title: string;
  entries: NavFeedEntry[];
  filter: string;
  onPick: () => void;
}) {
  const found = filterItems(entries, filter, (e) => `${e.label} ${e.org.label}`);
  return (
    <MenuFeed
      title={title}
      entries={found}
      href="/models"
      onPick={onPick}
      item={(e) => <FeedItem entry={e} onPick={onPick} />}
    />
  );
}

/** One model in a day, as on the Models page. */
function FeedItem({ entry: e, onPick }: { entry: NavFeedEntry; onPick: () => void }) {
  return (
    <>
      <Link href={e.href} onClick={onPick} className={cn(ROW_LINK, 'min-w-0')}>
        {e.label}
      </Link>
      <MenuIncidents incidents={e.incidents} onPick={onPick} />
      {e.evals.length > 0 && (
        <span className="mt-0.5 line-clamp-2 pl-3 text-[11px] text-slate-500">{e.evals.join(', ')}</span>
      )}
    </>
  );
}

/** A model with flagged chats, as on the Models page, in one column. */
const renderModel = lined((e: SnippetFeedEntry) => <SnippetFeedRow entry={e} noOrg />, { even: true });

type Row = ({ kind: 'card' } & SnippetFeedEntry) | ({ kind: 'model' } & OtherModel);

/** The rows that show at a time. */
const STEP = 60;

/** The models with flagged chats, newest first, with their Deploymeter, chats and evals, then the
 * other models. All come with the menu, so more rows and a search need no load. */
function Models({
  cards,
  others: all,
  count,
  onPick,
}: {
  cards: SnippetFeedEntry[];
  others: OtherModel[];
  count?: number;
  onPick: () => void;
}) {
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const box = useRef<HTMLUListElement>(null);
  const end = useRef<HTMLLIElement>(null);
  const rows = useMemo(
    (): Row[] => [
      ...searchModels(cards, query).map((c) => ({ kind: 'card' as const, ...c })),
      ...searchModels(all, query).map((m) => ({ kind: 'model' as const, ...m })),
    ],
    [cards, all, query],
  );
  const { shown } = useReveal(rows, STEP, box, end);
  const models = shown.filter((r) => r.kind === 'card');
  const others = shown.filter((r) => r.kind === 'model');

  return (
    <section aria-label="Models" className="relative flex min-w-0 flex-col">
      <MenuBlurHead className={COLUMN_HEAD} blur={COLUMN_BLUR}>
        <MenuPageLink href="/models" onPick={onPick} count={count} className="pl-4">
          Models
        </MenuPageLink>
        <SearchToggle
          plain
          open={searching}
          onOpenChange={setSearching}
          value={query}
          onChange={setQuery}
          placeholder="Search models"
        />
      </MenuBlurHead>
      {/* A link closes the panel. `next/link` prevents the default of each click, so do not test it. */}
      <ul ref={box} onClick={(ev) => (ev.target as Element).closest('a') && onPick()} className={COLUMN_LIST}>
        {!query.trim() && (
          <li className="px-3 pt-2.5 pb-2">
            <NewestModelsNote />
          </li>
        )}
        {rows.length === 0 && (
          <li className="py-2 pr-3 pl-5 text-slate-500">{query.trim() ? 'No models match.' : 'No models yet.'}</li>
        )}
        {models.map(renderModel)}
        {others.length > 0 && (
          <li className={cn(MENU_TITLE, 'border-t border-slate-100 px-5 pt-3 pb-1')}>Other Models</li>
        )}
        {others.map((m) => (
          <li key={m.key} className="group relative flex flex-col gap-y-0.5 px-5 py-1.5 hover:bg-sky-50">
            <span className="flex min-w-0 items-baseline gap-x-1.5">
              <Link href={m.href} className={cn(ROW_LINK, 'min-w-0 text-[13px] group-hover:underline')}>
                {m.label}
              </Link>
              {m.date && (
                <span className="shrink-0 text-[9px] font-bold tracking-wide text-slate-400 uppercase">
                  {formatShortDate(m.date)}
                </span>
              )}
            </span>
            {m.evalsTooOld && <EvalsTooOld />}
          </li>
        ))}
        <li ref={end} aria-hidden className="h-2" />
      </ul>
    </section>
  );
}
