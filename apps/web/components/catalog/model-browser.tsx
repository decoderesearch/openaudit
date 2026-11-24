'use client';

import { INSET_TITLE } from '@/components/box-title';
import { EvalCountsRow, sortModels, type ModelSort, type ModelTableRow } from '@/components/catalog/model-list';
import { ModelSortControl } from '@/components/catalog/model-sort';
import { ModelStats } from '@/components/catalog/model-stats';
import { Tag } from '@/components/catalog/parts';
import Link from '@/components/link';
import { LinkChips } from '@/components/link-chips';
import { filterItems } from '@/components/nav/nav-menu';
import { Input } from '@/components/ui/input';
import { replaceUrlParam } from '@/lib/url-param';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/** The Models page's search bar and list. The search box filters `rows` and the sort orders them,
 * here, with no page load, and keep the URL in step. Under `lg`, a row of model links
 * replaces them, and the list shows only during a search from the URL, with `data-searching` on the
 * root (see `FEED_PAGE`). `embedded`: on another page, so the list shows at all widths, with a
 * title and a button that shows the search box in its top row, no sort, and no URL changes. `bare`:
 * with `embedded`, no border. `inOrg`: the rows are of one organization, so no org names.
 * `allHref`: with `embedded`, the "Models" title links to this page. `stats`: the rows are
 * `ModelCard`s. */
export function ModelBrowser({
  rows,
  sort: initialSort = 'openaudit',
  q: initialQ = '',
  organization,
  embedded,
  bare,
  inOrg,
  allHref,
  stats,
  className,
}: {
  rows: ModelTableRow[];
  allHref?: string;
  stats?: boolean;
  sort?: ModelSort;
  q?: string;
  organization?: string;
  embedded?: boolean;
  bare?: boolean;
  inOrg?: boolean;
  className?: string;
}) {
  const [sort, setSort] = useState(initialSort);
  const [q, setQ] = useState(initialQ);
  const shown = useMemo(
    () =>
      sortModels(
        filterItems(rows, q, (r) => r.search ?? r.displayName),
        sort,
      ),
    [rows, sort, q],
  );
  const params = new URLSearchParams(
    Object.entries({ q: q.trim(), sort: sort === 'openaudit' ? undefined : sort }).filter(
      (e): e is [string, string] => !!e[1],
    ),
  );

  const search = (v: string) => {
    setQ(v);
    if (!embedded) replaceUrlParam('q', v.trim() || undefined);
  };
  const [finding, setFinding] = useState(!!initialQ);
  const closeSearch = () => {
    setFinding(false);
    search('');
  };

  const searching = !!q.trim() || !!organization;
  const full = searching || embedded;

  return (
    <div
      data-searching={searching || undefined}
      className={cn('flex min-h-0 min-w-0 flex-col', full ? 'flex-1' : 'max-lg:flex-none lg:flex-1', className)}
    >
      {!full && (
        <LinkChips
          label="Models"
          chips={shown.map((r) => ({ key: r.id, label: r.displayName, href: r.path }))}
          className="lg:hidden"
        />
      )}
      {!embedded && (
        <div className={cn('flex flex-wrap items-center gap-2 pb-2 lg:flex-nowrap', !full && 'max-lg:hidden')}>
          <Input
            type="search"
            aria-label="Search models"
            placeholder="Search Models"
            value={q}
            onChange={(e) => search(e.target.value)}
            className="h-7 min-w-40 flex-1 text-xs sm:h-7 md:text-xs lg:min-w-0"
          />
          <div className="flex flex-wrap items-center gap-2">
            {organization && (
              <Link
                href={`/models${params.size ? `?${params}` : ''}`}
                className="rounded-full border border-sky-700 bg-sky-50 px-2.5 py-0.5 text-xs text-sky-800"
              >
                Organization: {organization} ✕
              </Link>
            )}
            <div className="max-lg:hidden">
              <ModelSortControl
                value={sort}
                onChange={(v) => {
                  setSort(v);
                  replaceUrlParam('sort', v === 'openaudit' ? undefined : v);
                }}
              />
            </div>
          </div>
        </div>
      )}
      <div className={cn('flex min-h-0 flex-1 flex-col', !full && 'max-lg:hidden')}>
        {embedded ? (
          <ModelList
            rows={shown}
            showOrganization={!inOrg}
            scroll
            bare={bare}
            stats={stats}
            head={
              <>
                <h2 className={cn(INSET_TITLE, 'shrink-0', bare && 'text-xs')}>
                  {allHref ? (
                    <Link href={allHref} className="transition-colors hover:text-sky-700 hover:underline">
                      Models
                    </Link>
                  ) : (
                    'Models'
                  )}
                </h2>
                <span className="flex min-w-0 flex-1 items-center justify-end gap-x-2">
                  {finding && (
                    <Input
                      type="search"
                      autoFocus
                      aria-label="Search models"
                      placeholder="Search Models"
                      value={q}
                      onChange={(e) => search(e.target.value)}
                      onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
                      className="h-6 min-w-0 flex-1 text-[11px] sm:h-6 md:text-[11px]"
                    />
                  )}
                  <button
                    type="button"
                    aria-label="Show search"
                    aria-expanded={finding}
                    onClick={() => (finding ? closeSearch() : setFinding(true))}
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full transition-colors',
                      finding
                        ? 'bg-slate-200 text-slate-700'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
                    )}
                  >
                    <Search className="size-3.5" />
                  </button>
                </span>
              </>
            }
          />
        ) : shown.length ? (
          <ModelList rows={shown} showOrganization scroll />
        ) : (
          <p className="rounded-md border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">No models.</p>
        )}
      </div>
    </div>
  );
}

/** A model's org (with `showOrganization`) above its name, then its tags. The name's link covers the
 * nearest positioned box, and is sky and underlined when the `group` is hovered. */
function ModelName({ model: m, showOrganization }: { model: ModelTableRow; showOrganization: boolean }) {
  const relation = m.parentRelation !== 'finetune' && m.parentRelation;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-y-1">
      <div className="flex min-w-0 flex-col items-start">
        {showOrganization && (
          <Link
            href={m.organization.path}
            className="relative z-10 max-w-full truncate text-[9px] leading-3 font-semibold tracking-wide text-slate-400 uppercase hover:text-sky-700"
          >
            {m.organization.displayName}
          </Link>
        )}
        <Link
          href={m.path}
          className="max-w-full truncate text-sm font-semibold text-slate-800 group-hover:text-sky-700 group-hover:underline after:absolute after:inset-0"
        >
          {m.displayName}
        </Link>
      </div>
      {(relation || m.removedFromHub) && (
        <div className="flex items-center gap-x-1.5">
          {relation && <Tag>{relation}</Tag>}
          {m.removedFromHub && <Tag>removed from Hub</Tag>}
        </div>
      )}
    </div>
  );
}

/** A model in the two-column list, centered: its org, name and tags, then `ModelStats`, in one
 * link to the model page. On hover, as the org map's squares: a sky border, a shadow, and a
 * "View Report" tab under the box. */
function ModelCard({ model: m, showOrganization }: { model: ModelTableRow; showOrganization: boolean }) {
  const relation = m.parentRelation !== 'finetune' && m.parentRelation;
  return (
    <li className="group/model relative min-w-0 hover:z-10">
      <Link
        href={m.path}
        hover={false}
        className="flex flex-col items-center gap-y-1 rounded-md border border-transparent bg-white px-3 py-2 text-center transition-[border-color,box-shadow] duration-200 hover:border-sky-700 hover:shadow-md hover:shadow-sky-800/40"
      >
        <span className="flex max-w-full min-w-0 flex-col items-center">
          {showOrganization && (
            <span className="max-w-full truncate text-[8px] leading-3 font-semibold tracking-wide text-slate-400 uppercase">
              {m.organization.displayName}
            </span>
          )}
          <span className="max-w-full truncate text-[13px] leading-5 font-semibold text-slate-800">
            {m.displayName}
          </span>
        </span>
        {(relation || m.removedFromHub) && (
          <span className="flex items-center gap-x-1.5">
            {relation && <Tag>{relation}</Tag>}
            {m.removedFromHub && <Tag>removed from Hub</Tag>}
          </span>
        )}
        <ModelStats evals={m.evals} />
      </Link>
      {/* It covers the box's bottom border, so that the two look like one shape. */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-[calc(100%-1px)] left-1/2 -translate-x-1/2 rounded-b-md border-x border-b border-sky-700 bg-white px-2 pt-1 pb-1 text-[9px] leading-none font-semibold tracking-wide whitespace-nowrap text-slate-400 uppercase opacity-0 shadow-md shadow-sky-800/40 transition-opacity duration-200 group-hover/model:opacity-100"
      >
        View Report
      </span>
    </li>
  );
}

/** The list shows this many more rows each time the reader scrolls near its end. */
const ROWS_PAGE = 100;

/** Models, in the order given: the first `ROWS_PAGE`, then more as the reader scrolls. `scroll`:
 * the box scrolls in the page. `head`: a row at the top of the box, that does not scroll. `bare`:
 * with `head`, no border. The row dividers start at the names. `stats`:
 * in two columns of `ModelCard`s, with no dividers. */
function ModelList({
  rows,
  showOrganization,
  scroll,
  head,
  bare,
  stats,
}: {
  rows: ModelTableRow[];
  showOrganization: boolean;
  scroll?: boolean;
  head?: ReactNode;
  bare?: boolean;
  stats?: boolean;
}) {
  const [limit, setLimit] = useState(ROWS_PAGE);
  const [seen, setSeen] = useState(rows);
  if (rows !== seen) {
    setSeen(rows);
    setLimit(ROWS_PAGE);
  }
  const box = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const more = limit < rows.length;

  useEffect(() => {
    if (!more || !end.current) return;
    const observer = new IntersectionObserver(
      (hits) => hits.some((h) => h.isIntersecting) && setLimit((l) => l + ROWS_PAGE),
      { root: scroll ? box.current : null, rootMargin: '0px 0px 600px 0px' },
    );
    observer.observe(end.current);
    return () => observer.disconnect();
  }, [more, limit, scroll]);

  const list = (
    <div
      ref={box}
      className={cn(
        !head && 'rounded-md border border-slate-200 bg-white',
        scroll ? 'min-h-0 flex-1 overflow-auto' : 'overflow-x-auto',
      )}
    >
      {!rows.length && <p className="px-5 py-4 text-sm text-slate-500">No models.</p>}
      {stats ? (
        <ul className="grid grid-cols-2 gap-x-2 gap-y-1 px-3 pt-2 pb-5">
          {rows.slice(0, limit).map((m) => (
            <ModelCard key={m.id} model={m} showOrganization={showOrganization} />
          ))}
        </ul>
      ) : (
        <table className="w-full text-left text-sm">
          <tbody>
            {rows.slice(0, limit).map((m) => (
              <tr key={m.id} className="group align-middle transition-colors hover:bg-sky-50">
                <td className="relative max-w-0 py-3 pr-4 pl-6 [tr+tr>&]:before:absolute [tr+tr>&]:before:top-0 [tr+tr>&]:before:right-0 [tr+tr>&]:before:left-6 [tr+tr>&]:before:h-px [tr+tr>&]:before:bg-slate-100">
                  <div className="flex min-w-0 items-center gap-x-3">
                    <ModelName model={m} showOrganization={showOrganization} />
                    <EvalCountsRow evals={m.evals} href={m.path} model={m.displayName} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {more && <div ref={end} aria-hidden className="h-px" />}
    </div>
  );
  if (!head) return list;
  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-hidden bg-white',
        !bare && 'rounded-md border border-slate-200',
      )}
    >
      <div className="flex h-10 shrink-0 items-center justify-between gap-x-3 bg-slate-50 pr-2 pl-4">{head}</div>
      {list}
    </div>
  );
}
