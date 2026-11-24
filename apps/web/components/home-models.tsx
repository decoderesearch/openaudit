'use client';

import { EvalsTooOld } from '@/components/catalog/evals-too-old';
import { CARD_NAME, SnippetFeedCard } from '@/components/catalog/snippet-feed';
import { SearchInput, SearchToggle } from '@/components/catalog/title-search';
import { boxed, InfiniteFeed } from '@/components/infinite-feed';
import Link from '@/components/link';
import { MenuPageLink } from '@/components/nav/nav-menu';
import { NewestModelsNote } from '@/components/newest-models-note';
import { newest } from '@/lib/home-sorts';
import { searchModels } from '@/lib/search-match';
import type { AllModels, OtherModel } from '@/lib/server/home-models';
import type { SnippetFeedEntry } from '@/lib/server/snippet-feed';
import { cn } from '@/lib/utils';
import { useMemo, useState } from 'react';

/** The box of a home page column: a slate fade, darker at the top, so that the column's start shows. */
export const HOME_BOX = 'bg-linear-to-b from-slate-200 to-slate-100';
/** The head of a home page column, with a `MenuPageLink` at its left. */
export const HOME_HEAD = 'h-auto px-3 pt-3 pb-3 sm:px-3';
/** The part of a home page column that scrolls, below its `HOME_HEAD`. */
export const HOME_SCROLL = 'pt-3';
/** A `MenuPageLink` in a `HOME_HEAD`: larger than in the menus. */
export const HOME_BUTTON = 'h-7 px-4 text-[13px]';

/** An "N Evaluations" link for a home column's head. On phones it jumps to the page's evaluations
 * section (`anchor`); on wider screens it opens the page (`href`). `count`: the evaluations. */
export function HomeEvalsLink({ href, anchor, count }: { href: string; anchor: string; count?: number }) {
  return (
    <h2 className="flex shrink-0">
      <MenuPageLink href={anchor} count={count} className={cn(HOME_BUTTON, 'lg:hidden')}>
        Evaluations
      </MenuPageLink>
      <MenuPageLink href={href} count={count} className={cn(HOME_BUTTON, 'max-lg:hidden')}>
        Evaluations
      </MenuPageLink>
    </h2>
  );
}

/** A model with its newest OpenAudit card, or a model with none: its name, and `EvalsTooOld` when
 * that applies. */
type HomeModel = ({ kind: 'card' } & SnippetFeedEntry) | ({ kind: 'model' } & OtherModel);

const renderEntry = boxed(
  (m: HomeModel) =>
    m.kind === 'card' ? (
      <SnippetFeedCard entry={m} dated brief />
    ) : (
      <span className="flex min-w-0 flex-col gap-y-1.5">
        <Link href={m.href} hover={false} className={cn(CARD_NAME, 'self-start')}>
          {m.label}
        </Link>
        {m.evalsTooOld && <EvalsTooOld />}
      </span>
    ),
  (m) => (m.kind === 'card' ? 'Open Results' : 'Open Model'),
);

/** The home page's models, each in a white box: first those with an OpenAudit card, the newest
 * first, then the rest. All come from the server at one time, so a search shows at once. */
export function HomeModels({
  models,
  count,
  evalCount,
  className,
}: {
  models: AllModels;
  count?: number;
  evalCount?: number;
  className?: string;
}) {
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const close = () => (setSearching(false), setQuery(''));
  const shown = useMemo(
    () =>
      searchModels<HomeModel>(
        [
          ...models.cards.toSorted(newest).map((c) => ({ kind: 'card' as const, ...c })),
          ...models.others.map((m) => ({ kind: 'model' as const, ...m })),
        ],
        query,
      ),
    [models, query],
  );
  return (
    <InfiniteFeed
      title="Models"
      inset
      cards
      chain
      wheelFrom="left"
      hideEnd
      headClassName={cn(HOME_HEAD, 'flex-wrap gap-y-2.5')}
      boxClassName={HOME_BOX}
      scrollClassName={HOME_SCROLL}
      actions={
        <>
          <HomeEvalsLink href="/models" anchor="/models#model-evaluations" count={evalCount} />
          {searching && (
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search models"
              onClose={close}
              className="h-7 w-full max-w-none flex-none sm:h-7"
            />
          )}
        </>
      }
      insetHead={
        <div className="flex min-w-0 flex-1 items-center gap-x-1">
          <h2 className="flex shrink-0">
            <MenuPageLink href="/models" count={count} className={HOME_BUTTON}>
              Models
            </MenuPageLink>
          </h2>
          <SearchToggle
            plain
            start
            detached
            open={searching}
            onOpenChange={setSearching}
            value={query}
            onChange={setQuery}
            placeholder="Search models"
          />
        </div>
      }
      lead={!query.trim() && <NewestModelsNote className="mx-3 mb-2" />}
      all={shown}
      empty={query.trim() ? 'No models match your search.' : 'No models.'}
      renderEntry={renderEntry}
      className={className}
    />
  );
}
