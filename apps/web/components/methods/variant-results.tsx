'use client';

import { ACTION } from '@/components/catalog/model-actions';
import Link from '@/components/link';
import { Choice } from '@/components/methods/suite-results-view';
import { FLUSH, ROW, scrollAfter12, TABLE, TABLE_BOX, THEAD } from '@/components/methods/table';
import { Panel } from '@/components/panel';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Boxes, ChevronDown, Download } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

export type ArtifactRow = {
  id: string;
  href: string;
  name: string;
  /** The model and site: the first choice. */
  base: string;
  /** Param key to its text, for the choices. */
  params: Record<string, string>;
  /** The matched value (L0), as text. */
  x: string | null;
  /** One cell for each eval: the value as text. */
  values: (string | null)[];
  /** The files to download (`download` in lib/methods). */
  downloads: { name: string; href: string; from: string; size: string }[];
};

/** The value of the "All" option of a choice. */
const ALL = '\u0000all';

/**
 * A "Downloads / Artifacts" button that opens a variant's artifacts, one row each, with menus: the model, then each param that
 * differs. Each choice starts at "All", and keeps only the options that have artifacts under the
 * choices before it. A choice with one option, or with fewer than 2 artifacts for each option on
 * average, does not show.
 */
export function VariantArtifacts({
  info,
  rows,
  bases,
  keys,
  metric,
  jobs,
}: {
  info: ReactNode;
  rows: ArtifactRow[];
  /** Base to its lines of text, as `Gemma 2 2B`, `resid_post.12`. */
  bases: Record<string, string[]>;
  keys: { key: string; label: string }[];
  /** The name of the matched value, if the method matches on one. */
  metric: string | null;
  jobs: { slug: string; label: string }[];
}) {
  const [choices, setChoices] = useState<Record<string, string>>({});
  const order = useMemo(() => [{ key: '', label: 'Model' }, ...keys], [keys]);
  const view = useMemo(() => {
    const valueOf = (r: ArtifactRow, k: string) => (k ? (r.params[k] ?? '') : r.base);
    let pool = rows;
    const options: Record<string, string[]> = {};
    const picked: Record<string, string> = {};
    for (const { key } of order) {
      const values = [...new Set(pool.map((r) => valueOf(r, key)))];
      if (values.length < 2 || values.length * 2 > pool.length) {
        options[key] = [];
        continue;
      }
      const value = values.includes(choices[key]) ? choices[key] : ALL;
      options[key] = [ALL, ...values];
      picked[key] = value;
      if (value !== ALL) pool = pool.filter((r) => valueOf(r, key) === value);
    }
    return { pool, options, picked };
  }, [rows, order, choices]);
  const choose = (key: string, value: string) => setChoices((c) => ({ ...c, [key]: value }));
  const side = order.filter(({ key }) => view.options[key].length > 1);
  const files = rows.some((r) => r.downloads.length > 0);

  return (
    <Popover>
      <PopoverTrigger className={ACTION}>
        <Boxes aria-hidden />
        Downloads / Artifacts
        <ChevronDown aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={16} className="w-max max-w-[calc(100vw-2rem)] overflow-hidden p-0">
        <Panel
          title="Downloads / Artifacts"
          info={info}
          className="rounded-none border-0"
          action={
            side.length > 0 &&
            side.map(({ key, label }) => (
              <Choice
                key={key || 'model'}
                label={label}
                value={view.picked[key]}
                options={view.options[key].map((v) => ({
                  value: v,
                  label: v === ALL ? 'All' : key ? v : (bases[v] ?? [v]).join(' · '),
                }))}
                onValueChange={(v) => choose(key, v)}
                on={view.picked[key] !== ALL}
              />
            ))
          }
        >
          <div className={cn(TABLE_BOX, FLUSH, 'min-w-0', scrollAfter12(view.pool.length))}>
            <table className={TABLE}>
              <thead className={THEAD}>
                <tr>
                  <th className="px-4 py-2 font-medium">Artifact</th>
                  {metric && <th className="px-2 py-2 text-right font-medium">{metric}</th>}
                  {jobs.map((j) => (
                    <th key={j.slug} className="px-2 py-2 text-right font-medium">
                      {j.label}
                    </th>
                  ))}
                  {files && <th className="px-4 py-2 font-medium">Download</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {view.pool.map((a) => (
                  <tr key={a.id} className={ROW}>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <Link href={a.href} className="font-medium text-sky-800 hover:underline">
                        {a.name}
                      </Link>
                    </td>
                    {metric && (
                      <td className="px-2 py-2 text-right text-slate-600 tabular-nums">
                        {a.x ?? <span className="text-slate-300">—</span>}
                      </td>
                    )}
                    {a.values.map((v, i) => (
                      <td
                        key={jobs[i].slug}
                        className="px-2 py-2 text-right whitespace-nowrap text-slate-800 tabular-nums"
                      >
                        {v ?? <span className="text-slate-300">—</span>}
                      </td>
                    ))}
                    {files && (
                      <td className="px-4 py-2 whitespace-nowrap">
                        {a.downloads.length > 0 ? (
                          <span className="flex flex-col gap-y-0.5">
                            {a.downloads.map((d) => (
                              <a
                                key={d.name}
                                href={d.href}
                                title={`${d.name}, from the ${d.from}`}
                                className="inline-flex items-center gap-x-1 text-sky-800 hover:underline"
                                rel="nofollow"
                              >
                                <Download className="size-3" aria-hidden />
                                {d.size}
                                <span className="text-[11px] text-slate-400">{d.from}</span>
                              </a>
                            ))}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </PopoverContent>
    </Popover>
  );
}
