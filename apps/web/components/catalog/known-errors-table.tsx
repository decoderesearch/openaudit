'use client';

import { reviewIssuesAction } from '@/app/evaluations/[slug]/known-errors/actions';
import Link from '@/components/link';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SelectNative } from '@/components/ui/select-native';
import { kindLabel, type IssueStatus, type KnownErrorItem } from '@/lib/sample-issues';
import { cn } from '@/lib/utils';
import { useRouter } from 'nextjs-toploader/app';
import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';

type Filter = IssueStatus | 'all';

const STATUS_STYLE: Record<IssueStatus, string> = {
  proposed: 'bg-sky-50 text-sky-800',
  confirmed: 'bg-amber-100 text-amber-800',
  rejected: 'bg-slate-100 text-slate-500',
};

const evalKey = (i: KnownErrorItem) => (i.eval ? `${i.eval.slug} ${i.eval.version}` : '');

/** Known errors. `slug`: of that eval; null: of all evals, with an eval column. `hiddenText`: in
 * place of a note that the reader cannot read. `admin`: a status and eval filter, and buttons to
 * confirm or reject the selected issues. */
export function KnownErrorsTable({
  slug,
  issues,
  hiddenText = 'Hidden by the dataset terms',
  admin,
}: {
  slug: string | null;
  issues: KnownErrorItem[];
  hiddenText?: string;
  admin: boolean;
}) {
  const proposed = issues.some((i) => i.status === 'proposed');
  const [filter, setFilter] = useState<Filter>(admin && proposed ? 'proposed' : 'confirmed');
  const [evalFilter, setEvalFilter] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const router = useRouter();
  const evals = useMemo(() => {
    const seen = new Map<string, { key: string; label: string; n: number }>();
    for (const i of issues) {
      if (!i.eval) continue;
      const key = evalKey(i);
      const e = seen.get(key) ?? { key, label: `${i.eval.name} (${i.eval.version})`, n: 0 };
      e.n += 1;
      seen.set(key, e);
    }
    return [...seen.values()];
  }, [issues]);
  const inEval = useMemo(() => issues.filter((i) => !evalFilter || evalKey(i) === evalFilter), [issues, evalFilter]);
  const shown = useMemo(() => inEval.filter((i) => filter === 'all' || i.status === filter), [inEval, filter]);
  const chosen = shown.filter((i) => picked.has(i.id));

  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const act = (status: IssueStatus) => {
    const ids = chosen.length ? chosen.map((i) => i.id) : shown.map((i) => i.id);
    if (!ids.length) return;
    if (!window.confirm(`Set ${ids.length} issue${ids.length === 1 ? '' : 's'} to ${status}?`)) return;
    start(async () => {
      const result = await reviewIssuesAction(slug, ids, status);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${result.changed} changed.`);
      setPicked(new Set());
      router.refresh();
    });
  };
  const count = (s: IssueStatus) => inEval.filter((i) => i.status === s).length;
  const cls = 'h-6 px-2 text-[11px]';
  const multi = slug === null;
  const columns = 4 + (admin ? 2 : 0) + (multi ? 1 : 0);

  return (
    <div className="flex flex-col gap-2">
      {admin && (
        <div className="flex flex-wrap items-center gap-2">
          {multi && (
            <SelectNative
              aria-label="Eval"
              value={evalFilter}
              onChange={(ev) => {
                setEvalFilter(ev.target.value);
                setPicked(new Set());
              }}
              className="h-7 w-auto text-xs sm:h-7 sm:text-xs"
            >
              <option value="">All evals ({issues.length})</option>
              {evals.map((e) => (
                <option key={e.key} value={e.key}>
                  {e.label} ({e.n})
                </option>
              ))}
            </SelectNative>
          )}
          <SegmentedControl
            label="Status"
            small
            value={filter}
            onValueChange={(v) => {
              setFilter(v);
              setPicked(new Set());
            }}
            options={[
              { value: 'proposed', label: `Proposed ${count('proposed')}` },
              { value: 'confirmed', label: `Confirmed ${count('confirmed')}` },
              { value: 'rejected', label: `Rejected ${count('rejected')}` },
              { value: 'all', label: 'All' },
            ]}
          />
          <span className="ml-auto text-[11px] text-slate-500">
            {chosen.length ? `${chosen.length} selected` : `No selection: the buttons act on all ${shown.length}`}
          </span>
          <Button size="sm" className={cls} disabled={pending || !shown.length} onClick={() => act('confirmed')}>
            Confirm
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cls}
            disabled={pending || !shown.length}
            onClick={() => act('rejected')}
          >
            Reject
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cls}
            disabled={pending || !shown.length}
            onClick={() => act('proposed')}
          >
            Reopen
          </Button>
        </div>
      )}
      {/* Under `sm`, each row is a card: the eval and the error, then the sample, the note and the
          count of failed models. */}
      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="w-full text-left text-xs max-sm:block">
          <thead className="bg-slate-50 text-[11px] text-slate-500 max-sm:hidden">
            <tr>
              {admin && (
                <th className="w-0 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={!!shown.length && chosen.length === shown.length}
                    onChange={(ev) => setPicked(new Set(ev.target.checked ? shown.map((i) => i.id) : []))}
                  />
                </th>
              )}
              {multi && <th className="px-3 py-2 font-medium">Eval</th>}
              <th className="px-3 py-2 font-medium">Sample</th>
              <th className="px-3 py-2 font-medium">Error</th>
              <th className="px-3 py-2 font-medium">Note</th>
              <th className="px-3 py-2 text-center font-medium whitespace-nowrap">Failed when found</th>
              {admin && <th className="px-3 py-2 font-medium">Status</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 max-sm:block">
            {shown.map((i) => (
              <tr
                key={i.id}
                className="bg-white align-top hover:bg-sky-50 max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-x-3 max-sm:gap-y-1 max-sm:px-3 max-sm:py-2.5 max-sm:*:p-0"
              >
                {admin && (
                  <td className="px-3 py-2 max-sm:col-span-2">
                    <input
                      type="checkbox"
                      aria-label={`Select ${i.sourceId}`}
                      checked={picked.has(i.id)}
                      onChange={() => toggle(i.id)}
                    />
                  </td>
                )}
                {multi && (
                  <td className="px-3 py-2 whitespace-nowrap max-sm:col-start-1 max-sm:row-start-1 max-sm:truncate">
                    {i.eval && (
                      <>
                        <Link
                          href={`/evaluations/${i.eval.slug}/known-errors`}
                          className="text-sky-800 hover:underline"
                        >
                          {i.eval.name}
                        </Link>
                        <div className="text-[10px] text-slate-400">{i.eval.version}</div>
                      </>
                    )}
                  </td>
                )}
                <td
                  className={cn(
                    'px-3 py-2 font-mono text-[11px] wrap-anywhere',
                    multi ? 'max-sm:col-span-2' : 'max-sm:col-start-1 max-sm:row-start-1',
                  )}
                >
                  <Link href={i.href} className="text-sky-800 hover:underline">
                    {i.sourceId}
                  </Link>
                  <div className="font-sans text-[10px] text-slate-400">{i.split.replaceAll('_', ' ')}</div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-slate-700 max-sm:col-start-2 max-sm:row-start-1 max-sm:text-right max-sm:font-medium">
                  {kindLabel(i.kind)}
                </td>
                <td className="px-3 py-2 text-slate-700 max-sm:col-span-2">
                  {i.note ?? <span className="text-slate-400 italic">{hiddenText}</span>}
                </td>
                <td className="px-3 py-2 text-center text-slate-500 tabular-nums max-sm:col-span-2 max-sm:text-left max-sm:text-[11px] max-sm:before:content-['Failed_when_found:_']">
                  {i.found ?? '—'}
                </td>
                {admin && (
                  <td className="px-3 py-2 max-sm:col-span-2">
                    <span className={cn('rounded-sm px-1.5 py-0.5 text-[10px] font-medium', STATUS_STYLE[i.status])}>
                      {i.status}
                    </span>
                    <div className="mt-0.5 text-[10px] text-slate-400">{i.source.replaceAll('_', ' ')}</div>
                  </td>
                )}
              </tr>
            ))}
            {!shown.length && (
              <tr className="bg-white">
                <td colSpan={columns} className="px-3 py-6 text-center text-slate-400">
                  No known errors here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
