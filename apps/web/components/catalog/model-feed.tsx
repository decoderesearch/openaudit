'use client';

import { EvalsTooOld } from '@/components/catalog/evals-too-old';
import { SnippetFeedRow } from '@/components/catalog/snippet-feed';
import { BoxTitle, SearchToggle } from '@/components/catalog/title-search';
import { CompareButton } from '@/components/compare/compare-button';
import { InfiniteFeed, lined } from '@/components/infinite-feed';
import Link from '@/components/link';
import { NewestModelsNote } from '@/components/newest-models-note';
import { SortMenu } from '@/components/sort-menu';
import { compareLatestHref } from '@/lib/compare';
import { MODEL_SORTS, sortCards, sortOf, type ModelSort } from '@/lib/home-sorts';
import { searchModels } from '@/lib/search-match';
import type { SnippetFeedEntry } from '@/lib/server/snippet-feed';
import { cn } from '@/lib/utils';
import { Bot } from 'lucide-react';
import { Suspense, use, useMemo, useState } from 'react';

/** A listed model with no OpenAudit card. `org`: shown after its name. `evalsTooOld`: see `EvalsTooOld`. */
export type UnauditedModel = {
  key: string;
  label: string;
  href: string;
  org?: { label: string; href: string };
  evalsTooOld?: boolean;
};
/** The rounded cost of a full audit of each unaudited model, by key. Null: no estimate. */
export type AuditCosts = Promise<Record<string, number | null>>;

type Entry = ({ kind: 'card' } & SnippetFeedEntry) | ({ kind: 'model'; date: string } & UnauditedModel);
const NONE: UnauditedModel[] = [];

/** The Models page's feed: each model with flagged chats, with its Deploymeter and evals, in the
 * order of the home page's models menu. The sort is in the URL (`sort`). `entries`: all the models;
 * a sort or search changes them here, with no load. `noOrg`: the models of one organization, so no
 * org names. `unaudited`: rows after the others, each with its cost from `costs` when that loads.
 * `note`: `NewestModelsNote` above the list. */
export function ModelFeed({
  entries,
  initial,
  title = 'Models',
  noOrg,
  unaudited = NONE,
  costs,
  note,
  className,
}: {
  entries: SnippetFeedEntry[];
  initial: ModelSort;
  title?: string;
  noOrg?: boolean;
  unaudited?: UnauditedModel[];
  costs?: AuditCosts;
  note?: boolean;
  className?: string;
}) {
  const [sort, setSort] = useState(initial);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const shown = useMemo(
    () =>
      searchModels<Entry>(
        [
          ...sortCards(entries, sort).map((e) => ({ kind: 'card' as const, ...e })),
          ...unaudited.map((m) => ({ kind: 'model' as const, ...m, date: '' })),
        ],
        query,
      ),
    [entries, unaudited, sort, query],
  );
  const renderEntry = useMemo(
    () =>
      lined(
        (e: Entry) =>
          e.kind === 'card' ? <SnippetFeedRow entry={e} tight noOrg={noOrg} /> : <NotAudited model={e} costs={costs} />,
        { roomy: true },
      ),
    [noOrg, costs],
  );
  const change = (next: ModelSort) => {
    setSort(next);
    const url = new URL(location.href);
    if (next === sortOf(MODEL_SORTS, null)) url.searchParams.delete('sort');
    else url.searchParams.set('sort', next);
    history.replaceState(null, '', url);
  };
  return (
    <InfiniteFeed
      title={title}
      inset
      insetHead={
        <span className="flex min-w-0 flex-1 items-center gap-x-1">
          <BoxTitle title={title} icon={<Bot aria-hidden />} />
          <SearchToggle
            plain
            start
            open={searching}
            onOpenChange={setSearching}
            value={query}
            onChange={setQuery}
            placeholder="Search models"
          />
        </span>
      }
      headClassName="pl-2 sm:pl-3"
      actions={
        <span className="flex shrink-0 items-center gap-x-2">
          <SortMenu sorts={MODEL_SORTS} value={sort} onPick={change} />
          {entries.length > 1 && <CompareButton href={compareLatestHref(entries)} />}
        </span>
      }
      lead={note && !query.trim() && <NewestModelsNote className="mx-3 mt-2.5 mb-1" />}
      all={shown}
      empty={query.trim() ? 'No models match your search.' : 'No models yet.'}
      hideEnd
      className={className}
      renderEntry={renderEntry}
    />
  );
}

/** A model with no audit: its name, "Not audited" or `EvalsTooOld`, and the cost of a full audit
 * once it loads. */
function NotAudited({ model: m, costs }: { model: UnauditedModel; costs?: AuditCosts }) {
  return (
    <div className={cn('flex flex-col gap-y-1', costs && 'min-h-[5.5rem]')}>
      <span className="flex min-w-0 items-baseline gap-x-2">
        <Link
          href={m.href}
          data-row-link
          className="min-w-0 truncate text-sm font-semibold text-slate-800 group-hover/row:text-sky-800 group-hover/row:underline after:absolute after:inset-0"
        >
          {m.label}
        </Link>
        {m.org && (
          <Link
            href={m.org.href}
            className="relative shrink-0 text-xs text-slate-500 hover:text-sky-700 hover:underline"
          >
            {m.org.label}
          </Link>
        )}
      </span>
      {m.evalsTooOld ? (
        <EvalsTooOld />
      ) : (
        <span className="text-[10px] font-bold tracking-wide text-slate-300 uppercase">Not audited</span>
      )}
      {costs && (
        <Suspense>
          <Cost costs={costs} model={m.key} />
        </Suspense>
      )}
    </div>
  );
}

function Cost({ costs, model }: { costs: AuditCosts; model: string }) {
  const usd = use(costs)[model];
  if (usd == null) return null;
  return (
    <span className="text-xs text-slate-500">
      Cost to Run Evaluations: <span className="font-medium">${usd.toLocaleString('en-US')}</span>
    </span>
  );
}
