import { EvalStatusTag } from '@/components/catalog/eval-status';
import { TopicSnippets, type SnippetView } from '@/components/catalog/openaudit-card-client';
import { TopicLine } from '@/components/catalog/parts';
import { PLACE_OF, PlaceText, STAT_LINK, STAT_ROW_HOVER } from '@/components/catalog/place-text';
import { ReleaseWarning } from '@/components/catalog/release-warning';
import { ScoreBar } from '@/components/catalog/score';
import { EvalLink } from '@/components/eval-link';
import Link from '@/components/link';
import { OriginTag } from '@/components/runs/parts';
import type { EvalPlace } from '@/lib/server/eval-ranks';
import type { LatestRun } from '@/lib/server/latest-runs';
import { runPath } from '@/lib/server/runs';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

/** The succeeded runs that a card version used: the eval with its topics below it, and the result
 * with the model's place among the models (from `places`, by eval id, when it is of this run), else
 * a bar. The worst place among the models is first; runs with no place go last. With `snippets`,
 * then the eval's flagged chats. A click on a row opens its run page, and a click on the result
 * opens the eval's page. `extra` rows (2 columns) go after them. */
export function CardRunTable({
  runs,
  places = {},
  snippets,
  extra,
  className,
}: {
  runs: LatestRun[];
  places?: Record<string, EvalPlace>;
  snippets?: SnippetView[];
  extra?: ReactNode;
  className?: string;
}) {
  const placeOf = (r: LatestRun) => (places[r.run.evalId]?.href === runPath(r.run) ? places[r.run.evalId] : undefined);
  // 1 is the last place, 0 the first.
  const worse = (r: LatestRun) => {
    const p = placeOf(r);
    return p ? (p.rank - 1) / Math.max(1, p.of - 1) : -1;
  };
  const done = runs.filter((r) => r.run.status === 'succeeded').sort((a, b) => worse(b) - worse(a));
  return (
    <div className={cn('overflow-x-auto rounded-md border border-slate-200 bg-white', className)}>
      <table className="w-full text-left text-xs">
        <tbody className="divide-y divide-slate-100">
          {done.map((r) => {
            const { run, eval: e, result } = r;
            const place = placeOf(r);
            return (
              <tr key={run.id} className={cn('group relative cursor-pointer', STAT_ROW_HOVER)}>
                <td className="w-full px-4 py-3 align-middle">
                  <Link href={runPath(run)} tabIndex={-1} aria-hidden className="absolute inset-0" />
                  <EvalLink
                    slug={e.slug}
                    href={runPath(run)}
                    hover={false}
                    className="relative text-[13px] font-semibold text-slate-800"
                  >
                    {e.displayName}
                  </EvalLink>
                  {run.origin === 'import' && <OriginTag run={run} />}
                  <EvalStatusTag status={e.status} className="relative z-10 ml-1.5" />
                  <ReleaseWarning model={r.released.model} evalDate={r.released.eval} className="ml-1.5" />
                  <TopicLine topics={e.topics} className="mt-0.5 text-slate-400" />
                </td>
                <td className={cn('w-44 px-4 py-3 align-middle', snippets && 'w-20 pr-3 pl-0')}>
                  {result ? (
                    // The bottom padding is the room for the metric line under the bar.
                    <Link
                      href={`/evaluations/${e.slug}`}
                      className={cn('flex', place ? 'justify-end' : 'pb-[13px]', STAT_LINK)}
                    >
                      {place ? (
                        <PlaceText place={place} className="text-sm leading-4" ofClassName={PLACE_OF} />
                      ) : (
                        <ScoreBar result={result} />
                      )}
                    </Link>
                  ) : (
                    <span className="text-slate-400">No result</span>
                  )}
                </td>
                {snippets && (
                  <td className="relative z-10 w-[4.75rem] py-3 pr-3 align-middle">
                    <TopicSnippets
                      snippets={snippets.filter((s) => s.evalName === e.displayName)}
                      evalName={e.displayName}
                    />
                  </td>
                )}
              </tr>
            );
          })}
          {extra}
        </tbody>
      </table>
    </div>
  );
}
