'use client';

import Link from '@/components/link';
import { filterItems, MENU_LIST, MenuBlurHead, MenuPageLink, NavMenu, ROW_LINK } from '@/components/nav/nav-menu';
import type { NavTopics } from '@/lib/server/nav-topics';
import { otherEvalCounts } from '@/lib/topics';
import { cn } from '@/lib/utils';
import { Tags } from 'lucide-react';
import type { ReactNode } from 'react';

/** The navbar's Topics menu: each topic, with its number of evals of models, methods and auditors. */
export function TopicsMenu({ active }: { active: boolean }) {
  return (
    <NavMenu<NavTopics>
      label="Topics"
      icon={Tags}
      href="/topics"
      active={active}
      api="/api/nav-topics"
      noun="topics"
      width={640}
      inlineFilter
      body={TopicsBody}
    />
  );
}

function TopicsBody({
  data,
  filter,
  filterInput,
  onPick,
}: {
  data: NavTopics;
  filter: string;
  filterInput: ReactNode;
  onPick: () => void;
}) {
  const { topics = [] } = data;
  const found = filterItems(topics, filter, (t) => `${t.label} ${t.info}`);
  return (
    <div className="relative flex min-w-0 flex-col">
      <MenuBlurHead className="top-2.5 items-center justify-between gap-2 px-3">
        <MenuPageLink href="/topics" onPick={onPick}>
          Topics
        </MenuPageLink>
        {filterInput}
      </MenuBlurHead>
      <ul className={cn(MENU_LIST, 'grid grid-cols-2 gap-x-2 px-2 pt-10 pb-1')}>
        {found.length === 0 && <li className="px-2 py-2 text-slate-500">No topics match.</li>}
        {found.map((t) => (
          <li key={t.href} className="group relative flex flex-col gap-y-0.5 rounded-md px-2 py-2 hover:bg-slate-50">
            <span className="flex items-baseline justify-between gap-x-2">
              <Link href={t.href} onClick={onPick} className={cn(ROW_LINK, 'min-w-0 text-[13px] leading-4')}>
                {t.label}
              </Link>
              <span className="shrink-0 text-[10px] text-slate-400 tabular-nums">
                {[`${t.models} model evals`, otherEvalCounts(t)].filter(Boolean).join(' · ')}
              </span>
            </span>
            <span className="line-clamp-2 text-[11px] text-slate-500">{t.info}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
