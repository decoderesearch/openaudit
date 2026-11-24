import { EvalLink } from '@/components/eval-link';
import Link from '@/components/link';
import { AccessTag } from '@/components/methods/subject-board';
import { FLUSH, ROW, TABLE, TABLE_BOX, THEAD } from '@/components/methods/table';
import { Eyebrow, Page, PageTitle } from '@/components/page';
import { Panel } from '@/components/panel';
import { formatValue, variantPath, type BoardVariant } from '@/lib/methods';
import { LEADERBOARD_TASKS, methodLeaderboard, type EvalBoardView } from '@/lib/server/method-leaderboards';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

type Props = { params: Promise<{ task: string }>; searchParams: Promise<{ method?: string }> };

const taskOf = (slug: string) => LEADERBOARD_TASKS.find((t) => t.slug === slug);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const task = taskOf((await params).task);
  return {
    title: task?.title ?? 'Leaderboard',
    description: task?.about,
    robots: { index: false, follow: false },
  };
}

export default async function LeaderboardPage({ params, searchParams }: Props) {
  const [{ task: slug }, { method }] = await Promise.all([params, searchParams]);
  const task = taskOf(slug);
  if (!task) notFound();
  const boards = await methodLeaderboard(task, method);
  const methods = [...new Map(boards.flatMap((b) => b.methods).map((m) => [m.slug, m])).values()];
  const chip = (active: boolean) =>
    cn(
      'rounded-full border px-2.5 py-0.5 text-xs',
      active ? 'border-sky-700 bg-sky-50 text-sky-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
    );
  return (
    <Page>
      <div className="min-w-0">
        <Eyebrow>Leaderboard</Eyebrow>
        <PageTitle>{task.title}</PageTitle>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">{task.about}</p>
      </div>
      {methods.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Detectors">
          <Link href="?" className={chip(!method)}>
            All Detectors
          </Link>
          {methods.map((m) => (
            <Link key={m.slug} href={`?method=${m.slug}`} className={chip(method === m.slug)}>
              {m.displayName}
            </Link>
          ))}
        </div>
      )}
      {!boards.length && <p className="text-sm text-slate-600">No eval on this task has results from two detectors.</p>}
      {boards.map((b) => (
        <EvalBoard key={b.eval.slug} board={b} />
      ))}
    </Page>
  );
}

function VariantName({ variant: v }: { variant: BoardVariant }) {
  return (
    <Link href={variantPath(v.method.slug, v.slug)} className="font-medium text-sky-800 hover:underline">
      {v.displayName}
    </Link>
  );
}

function EvalBoard({ board: b }: { board: EvalBoardView }) {
  const metric = b.metric.displayName;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex flex-wrap items-baseline gap-x-2 text-base font-semibold text-slate-800">
        <EvalLink slug={b.eval.slug} className="text-sky-800 hover:underline">
          {b.eval.displayName}
        </EvalLink>
        <span className="text-xs font-normal text-slate-500">
          Version {b.version} · {metric} · {b.models.length} models · {b.detectors.length} detectors
        </span>
      </h2>
      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel
          title="Detectors"
          info={`Each detector's median ${metric} over the models that it has a result for, best first. "Best on" counts the models where it ranks first of two or more.`}
        >
          <div className={cn(TABLE_BOX, FLUSH)}>
            <table className={TABLE}>
              <thead className={THEAD}>
                <tr>
                  <th className="py-2 pl-4 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Detector</th>
                  <th className="px-3 py-2 font-medium">Access</th>
                  <th className="px-3 py-2 text-right font-medium">Median</th>
                  <th className="px-3 py-2 text-right font-medium">Models</th>
                  <th className="py-2 pr-4 pl-3 text-right font-medium">Best On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {b.detectors.map((d, i) => (
                  <tr key={d.variant.id} className={ROW}>
                    <td className="py-2 pl-4 text-slate-500 tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2">
                      <VariantName variant={d.variant} />
                    </td>
                    <td className="px-3 py-2">
                      <AccessTag access={d.variant.access} />
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right font-medium tabular-nums',
                        b.detectors.length > 1 &&
                          d.median === b.detectors[0].median &&
                          'bg-emerald-50 font-semibold text-emerald-900',
                      )}
                    >
                      {formatValue(d.median)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600 tabular-nums">{d.count}</td>
                    <td className="py-2 pr-4 pl-3 text-right text-slate-600 tabular-nums">{d.firsts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel
          title="Best Detector for Each Model"
          info={`For each model: the detector with the best ${metric}, and the next best. The margin is the gap between them.`}
        >
          <div className={cn(TABLE_BOX, FLUSH)}>
            <table className={TABLE}>
              <thead className={THEAD}>
                <tr>
                  <th className="py-2 pl-4 font-medium">Model</th>
                  <th className="px-3 py-2 font-medium">Best</th>
                  <th className="px-3 py-2 text-right font-medium">{metric}</th>
                  <th className="px-3 py-2 font-medium">Next Best</th>
                  <th className="px-3 py-2 text-right font-medium">Margin</th>
                  <th className="py-2 pr-4 pl-3 text-right font-medium">Detectors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {b.models.map((m) => {
                  const s = b.subjects[m.subject];
                  const [best, next] = m.ranked;
                  return (
                    <tr key={m.subject} className={ROW}>
                      <td className="py-2 pl-4">
                        {s?.href ? (
                          <Link href={s.href} className="font-medium text-sky-800 hover:underline">
                            {s.label}
                          </Link>
                        ) : (
                          (s?.label ?? m.subject)
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <VariantName variant={best.variant} />
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{formatValue(best.value)}</td>
                      <td className="px-3 py-2">{next ? <VariantName variant={next.variant} /> : '–'}</td>
                      <td className="px-3 py-2 text-right text-slate-600 tabular-nums">
                        {next ? formatValue(Math.abs(best.value - next.value)) : '–'}
                      </td>
                      <td className="py-2 pr-4 pl-3 text-right text-slate-600 tabular-nums">{m.ranked.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </section>
  );
}
