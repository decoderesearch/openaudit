'use client';

import { INSET_TITLE } from '@/components/box-title';
import { PrefetchLink } from '@/components/org/prefetch';
import { SortMenu } from '@/components/sort-menu';
import { incidentDate, incidentPath, plainText, PRIMARY_CATEGORY_LABELS, type IncidentCard } from '@/lib/org-research';
import { cn } from '@/lib/utils';
import type { IncidentPrimaryCategory } from '@openaudit/spec';
import { Newspaper } from 'lucide-react';
import { useMemo, useState } from 'react';

type Filter = 'all' | IncidentPrimaryCategory;

/** An organization's incidents, newest first, under a filter by category. Each links to its page. */
export function IncidentList({ org, incidents }: { org: { slug: string }; incidents: IncidentCard[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const shown = filter === 'all' ? incidents : incidents.filter((i) => i.primaryCategory === filter);
  const filters = useMemo(() => {
    const out: Partial<Record<Filter, string>> = { all: 'Show All' };
    for (const c of Object.keys(PRIMARY_CATEGORY_LABELS) as IncidentPrimaryCategory[])
      if (incidents.some((i) => i.primaryCategory === c)) out[c] = PRIMARY_CATEGORY_LABELS[c];
    return out as Record<Filter, string>;
  }, [incidents]);
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex h-10 items-center justify-between gap-x-3 bg-slate-50 px-4 sm:px-5">
        <h1 className={cn(INSET_TITLE, 'flex items-center gap-x-1.5 text-xs tabular-nums')}>
          <Newspaper aria-hidden className="size-3.5 text-amber-600" strokeWidth={2.5} />
          {shown.length.toLocaleString('en-US')} {shown.length === 1 ? 'Incident' : 'Incidents'}
        </h1>
        {Object.keys(filters).length > 2 && (
          <SortMenu label="Filter incidents" sorts={filters} value={filter} onPick={setFilter} />
        )}
      </div>
      {shown.length ? (
        <ul>
          {shown.map((i) => (
            <li key={i.slug} className="border-t border-slate-100">
              <PrefetchLink
                href={incidentPath(org, i.slug)}
                className="flex flex-col gap-y-1 px-4 py-3 hover:bg-sky-50 sm:px-5"
              >
                <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-[10px]/4">
                  <span className="flex min-w-0 items-baseline gap-x-1.5 font-semibold tracking-wide uppercase">
                    <span className="truncate text-amber-600">{PRIMARY_CATEGORY_LABELS[i.primaryCategory]}</span>
                    {i.logs > 0 && <span className="shrink-0 text-slate-400">· Logs</span>}
                  </span>
                  <span className="shrink-0 text-slate-400 tabular-nums">{incidentDate(i)}</span>
                </span>
                <span className="text-[13px] font-semibold text-slate-800">{i.title}</span>
                <span className="line-clamp-2 text-xs text-slate-500">{plainText(i.summary)}</span>
              </PrefetchLink>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t border-slate-100 px-5 py-4 text-sm text-slate-500">No incidents.</p>
      )}
    </section>
  );
}
