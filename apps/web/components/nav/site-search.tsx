'use client';

import Link from '@/components/link';
import { NAV_ITEM } from '@/components/nav/nav-menu';
import { SEARCH_MAX_CHARS, type SearchHit, type SearchResults } from '@/lib/search';
import { cn } from '@/lib/utils';
import { useWheelContain } from '@/lib/wheel-contain';
import { ExternalLink, Loader2, Search } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

/** Off: the navbar shows no search, on desktop or mobile. */
export const NAV_SEARCH = false;

const DEBOUNCE_MS = 250;
const EMPTY: SearchResults = { models: [], documents: [], evals: [], organizations: [] };
// On desktop, each group is a column. The weight sets its width, in units of 4.5rem.
const GROUPS: { key: keyof SearchResults; label: string; weight: number }[] = [
  { key: 'models', label: 'Models', weight: 4 },
  { key: 'documents', label: 'Documents', weight: 5 },
  { key: 'evals', label: 'Evals', weight: 4 },
  { key: 'organizations', label: 'Organizations', weight: 3 },
];

/** The navbar's "Search" button. A click puts the search box in its place, with the focus in it. A
 * click outside the box, Escape, or a new page puts the button back. */
export function SearchToggle() {
  const pathname = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const open = openAt === pathname;
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpenAt(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  if (!open)
    return (
      <button type="button" className={NAV_ITEM} onClick={() => setOpenAt(pathname)}>
        <Search />
        Search
      </button>
    );
  return (
    <div ref={boxRef} onKeyDown={(e) => e.key === 'Escape' && setOpenAt(null)}>
      <SiteSearch autoFocus align="end" className="w-56" />
    </div>
  );
}

/** `align`: "end" opens the results from the box's right edge, for a box near the window's right side. */
export default function SiteSearch({
  className,
  autoFocus,
  align = 'center',
}: {
  className?: string;
  autoFocus?: boolean;
  align?: 'center' | 'end';
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const optionId = (i: number) => `${id}-option-${i}`;

  const hits = useMemo(() => (results ? GROUPS.flatMap((g) => results[g.key]) : []), [results]);
  const q = query.trim();

  useEffect(() => {
    if (!q) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? (r.json() as Promise<SearchResults>) : EMPTY))
        .then((r) => {
          setResults(r);
          setActive(-1);
          setLoading(false);
        })
        .catch((e: unknown) => {
          if ((e as Error).name === 'AbortError') return;
          setResults(EMPTY);
          setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const onChange = (value: string) => {
    setQuery(value);
    setOpen(true);
    if (value.trim()) {
      setLoading(true);
    } else {
      setResults(null);
      setLoading(false);
    }
  };

  const close = () => {
    setOpen(false);
    setQuery('');
    setResults(null);
    setActive(-1);
  };

  const go = (hit: SearchHit) => {
    close();
    if (hit.external) window.location.assign(hit.path);
    else router.push(hit.path);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      if (!hits.length) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      const next = active < 0 && step < 0 ? hits.length - 1 : (active + step + hits.length) % hits.length;
      setActive(next);
      requestAnimationFrame(() => {
        const list = listRef.current;
        const el = document.getElementById(optionId(next));
        if (!list || !el) return;
        if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop;
        else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight)
          list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight;
      });
    } else if (e.key === 'Enter') {
      const hit = hits[active] ?? hits[0];
      if (open && hit) {
        e.preventDefault();
        go(hit);
      }
    } else if (e.key === 'Escape') {
      if (open) setOpen(false);
      else e.currentTarget.blur();
    }
  };

  const shown = open && q !== '' && (results !== null || loading);
  useWheelContain(listRef, shown);
  const groups = results ? GROUPS.filter((g) => results[g.key].length) : [];
  const columns = {
    '--cols': groups.map((g) => `${g.weight}fr`).join(' '),
    '--width': `${Math.max(28, 4.5 * groups.reduce((sum, g) => sum + g.weight, 0))}rem`,
  } as React.CSSProperties;
  const offset = Object.fromEntries(
    GROUPS.map((g, n) => [g.key, GROUPS.slice(0, n).reduce((sum, p) => sum + (results?.[p.key].length ?? 0), 0)]),
  ) as Record<keyof SearchResults, number>;

  return (
    <div ref={boxRef} className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-slate-500" />
      <input
        type="text"
        role="combobox"
        aria-label="Search"
        aria-expanded={shown}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={shown && active >= 0 ? optionId(active) : undefined}
        placeholder="Search"
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        maxLength={SEARCH_MAX_CHARS}
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="h-8 w-full rounded-full border-[1.5px] border-slate-300 bg-slate-50 px-7 text-center text-sm font-medium text-slate-800 outline-none placeholder:text-slate-500 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
      />
      {loading && (
        <Loader2
          aria-label="Searching"
          className="absolute top-1/2 right-3 size-3.5 -translate-y-1/2 animate-spin text-slate-400"
        />
      )}
      {shown && (
        <div
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          aria-label="Search results"
          style={columns}
          className={cn(
            'absolute top-full z-30 mt-2 max-h-[min(70vh,28rem)] w-[min(28rem,90vw)] overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg',
            align === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2',
            hits.length > 0 &&
              'lg:grid lg:w-[min(var(--width),calc(100vw-2rem))] lg:grid-cols-(--cols) lg:divide-x lg:divide-slate-100',
          )}
        >
          {!results ? (
            <p className="px-3 py-2 text-xs text-slate-500">Searching…</p>
          ) : !hits.length ? (
            <p className="px-3 py-2 text-xs text-slate-500">{loading ? 'Searching…' : 'No results.'}</p>
          ) : (
            groups.map((g) => (
              <div key={g.key} role="group" aria-label={g.label} className="min-w-0">
                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                  {g.label}
                </p>
                {results[g.key].map((hit, n) => {
                  const i = offset[g.key] + n;
                  return (
                    <Link
                      key={hit.path}
                      id={optionId(i)}
                      role="option"
                      aria-selected={i === active}
                      href={hit.path}
                      rel={hit.external ? 'nofollow' : undefined}
                      onClick={close}
                      onMouseEnter={() => setActive(i)}
                      className={cn('block px-3 py-1.5', i === active && 'bg-slate-100')}
                    >
                      <span className="flex items-center gap-x-1 text-xs text-slate-800">
                        <span className="truncate">{hit.title}</span>
                        {hit.external && (
                          <ExternalLink
                            aria-label="Opens the publisher's page"
                            className="size-3 shrink-0 text-slate-400"
                          />
                        )}
                      </span>
                      {hit.detail && <span className="block truncate text-[11px] text-slate-500">{hit.detail}</span>}
                    </Link>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
