'use client';

import { EvalLink } from '@/components/eval-link';
import { Ranked } from '@/components/methods/condense';
import { ScoreRows } from '@/components/methods/score-rows';
import { Scorecard } from '@/components/methods/scorecard';
import { SeedCharts } from '@/components/methods/seed-charts';
import { SeedTable, seedPlace } from '@/components/methods/seed-table';
import { SparsityCharts } from '@/components/methods/sparsity-charts';
import { FLUSH } from '@/components/methods/table';
import { Panel, ResultsTitle, TitleName, TitlePlace } from '@/components/panel';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  baseParts,
  baseSlug,
  formatParam,
  matchKey,
  pickedText,
  scorecardView,
  seedCharts,
  seededViews,
  suitePlace,
  variantSeedView,
  type Choices,
  type MethodInput,
} from '@/lib/methods';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

export type SuiteInput = MethodInput & { method: MethodInput['method'] & { slug: string } };

/**
 * The results of one method on a set of evals: the results table and its charts when a suite has a
 * `matched` rule, and a table for each eval with seeded artifacts. A choice changes the page in
 * place, not the URL. `names`: each subject's display name. `evalPage`: the page names the eval, so
 * a seeded table is titled "Results". `brief`: no charts, and each seeded table is titled
 * "Evaluation Results · <eval>". `current`: on a variant's page, each title has that variant's
 * place, and each table has only its row; below it, charts of it by L0 against the others.
 * The results table is titled `title`. `eyebrow` and `sub`: as in `Panel`, for the results
 * table. `variantRows`: the results table has a row for each
 * variant, best first. `noBaselines`: the results table has no baselines. `noCharts`: no charts.
 * `footer`: under the last row of each table.
 */
export function SuiteResultsView({
  input,
  names,
  initial,
  evalPage,
  brief,
  current,
  title = 'Results',
  eyebrow,
  sub,
  variantRows,
  noBaselines,
  noCharts,
  footer,
}: {
  input: SuiteInput;
  names: Record<string, string>;
  initial: Choices;
  evalPage?: boolean;
  brief?: boolean;
  current?: { id: string; name: string };
  title?: ReactNode;
  eyebrow?: ReactNode;
  sub?: ReactNode;
  variantRows?: boolean;
  noBaselines?: boolean;
  noCharts?: boolean;
  footer?: ReactNode;
}) {
  const [choices, setChoices] = useState<Choices>(initial);
  const { method, params: defs, artifacts } = input;
  const view = useMemo(() => scorecardView(input, choices), [input, choices]);
  const seeded = useMemo(() => seededViews(input, choices), [input, choices]);
  const { match, bases, base, keys, options, picked, at, group, shown, rows, jobs } = view;
  if (!(match && at != null) && !seeded.length) return null;
  const xKey = matchKey(match);
  const defOf = new Map(defs.map((d) => [d.key, d]));
  const groupText = pickedText(keys, picked, defs);
  const choose = (next: Choices) => setChoices((c) => ({ ...c, ...next }));
  const ranked = noBaselines ? shown.filter((v) => !v.baseline) : shown;
  const tableRows = noBaselines ? rows.map((r) => ({ ...r, baselines: [] })) : rows;
  const charts = !current && !brief && !noCharts && match && xKey && at != null && base;
  const side = !!(evalPage && charts);

  return (
    <>
      {/* On one eval's page the table has one column, so the charts go at its right. */}
      <div className={side ? 'grid grid-cols-1 gap-4 lg:grid-cols-3' : 'contents'}>
        {match && at != null && (
          <Panel
            id={view.suite ? `suite-${view.suite.slug}` : undefined}
            eyebrow={eyebrow}
            title={
              current ? (
                <>
                  {title}
                  <TitlePlace place={suitePlace(rows, shown, current.id)} />
                </>
              ) : (
                title
              )
            }
            sub={sub}
            action={
              <>
                <Choice
                  label="Model"
                  value={base ? baseSlug(base) : ''}
                  options={bases.map((b) => {
                    const parts = baseParts(b, artifacts, method.compare, (s) => names[s] ?? s);
                    return { value: baseSlug(b), label: parts.join(' · '), short: parts[0] };
                  })}
                  onValueChange={(on) => choose({ on, ...Object.fromEntries(keys.map((k) => [k, undefined])) })}
                />
                {keys.map((k) => (
                  <Choice
                    key={k}
                    label={defOf.get(k)?.label ?? k}
                    value={picked[k] ?? ''}
                    options={options[k].map((v) => ({ value: v, label: formatParam(defOf.get(k), v) }))}
                    onValueChange={(v) => choose({ [k]: v })}
                  />
                ))}
                <Choice
                  label={match.metric.toUpperCase()}
                  value={String(at)}
                  options={match.targets.map((t) => ({ value: String(t), label: String(t) }))}
                  onValueChange={(v) => choose({ at: v })}
                />{' '}
              </>
            }
            info={
              !current && (
                <>
                  Each value is for artifacts on the same model and site, with the same{' '}
                  {groupText.length ? 'settings' : 'setup'}, at about the same {match.metric.toUpperCase()}. For each
                  variant, we read the value off the line through its artifacts. A dash: the variant has no artifacts on
                  both sides of that value. Green: first place.{' '}
                  {variantRows &&
                    (rows.length > 1
                      ? 'Rows go by mean rank over the evaluations, best first. '
                      : 'Rows go by rank, best first. ')}
                  {!noBaselines && 'Baselines are references, not ranked.'}
                </>
              )
            }
          >
            {variantRows && current ? (
              <Ranked>
                <ScoreRows
                  rows={tableRows}
                  variants={ranked}
                  method={method.slug}
                  empty={`No artifacts on both sides of this ${match.metric.toUpperCase()}`}
                  only={current.id}
                  className={cn(FLUSH, 'min-w-0')}
                />
              </Ranked>
            ) : variantRows ? (
              <ScoreRows
                rows={tableRows}
                variants={ranked}
                method={method.slug}
                empty={`No artifacts on both sides of this ${match.metric.toUpperCase()}`}
                evalPage={evalPage}
                className={cn(FLUSH, 'min-w-0')}
              />
            ) : (
              <Scorecard
                rows={tableRows}
                variants={ranked}
                method={method.slug}
                empty={`No artifacts on both sides of this ${match.metric.toUpperCase()}`}
                highlight={current?.id}
                className={cn(FLUSH, 'min-w-0')}
              />
            )}
            {footer}
            {current && xKey && base && (
              <div className="border-t border-slate-200">
                <SparsityCharts
                  jobs={jobs}
                  variants={shown}
                  artifacts={group}
                  xKey={xKey}
                  l0={at}
                  method={method.slug}
                  names={names}
                  defs={defs}
                  highlight={current.id}
                  heading={`Results by ${match.metric.toUpperCase()}`}
                />
              </div>
            )}
          </Panel>
        )}

        {charts ? (
          <Panel
            className={side ? 'lg:col-span-2' : undefined}
            title={`Results by ${match.metric.toUpperCase()}`}
            info={`Each point is one artifact. The dotted line is the ${match.metric.toUpperCase()} of the results table. Click a point to open the artifact.`}
          >
            <SparsityCharts
              jobs={jobs}
              variants={shown}
              artifacts={group}
              xKey={xKey}
              l0={at}
              method={method.slug}
              names={names}
              defs={defs}
            />
          </Panel>
        ) : null}
      </div>

      {seeded.map((s) => {
        const by = s.key ? (defOf.get(s.key)?.label ?? s.key) : 'Group';
        const one = current && variantSeedView(input, current.id, s.job.eval.slug);
        const lines = current && one ? seedCharts(one, input.variants, current.id) : [];
        return (
          <Panel
            key={s.job.eval.slug}
            id={`seeds-${s.job.eval.slug}`}
            eyebrow={current && 'Evaluation'}
            sub={current && s.job.eval.summary}
            title={
              evalPage ? (
                'Results'
              ) : current ? (
                <>
                  <EvalLink slug={s.job.eval.slug} className="text-sky-800 hover:underline">
                    {s.job.eval.displayName}
                  </EvalLink>
                  <TitlePlace place={seedPlace(s.rows, s.metrics, current.id)} />
                </>
              ) : brief ? (
                <ResultsTitle>
                  <EvalLink slug={s.job.eval.slug} className="text-sky-800 hover:underline">
                    {s.job.eval.displayName}
                  </EvalLink>
                </ResultsTitle>
              ) : (
                <TitleName>
                  <EvalLink slug={s.job.eval.slug} className="hover:text-sky-800 hover:underline">
                    {s.job.eval.displayName}
                  </EvalLink>
                </TitleName>
              )
            }
            info={
              !current && (
                <>
                  {s.job.eval.summary} Each variant has the same recipe, trained with {s.seeds} seeds. Each value is the
                  mean over the seeds. Hover a value for its standard error. Green: first place. Hover a metric name for
                  what it measures. Click a row for the results of its variant at each{' '}
                  {s.key ? by.toLowerCase() : 'setting'}.
                </>
              )
            }
            action={
              s.key && (
                <Choice
                  label={defOf.get(s.key)?.label ?? s.key}
                  value={s.value ?? ''}
                  options={s.values.map((v) => ({ value: v, label: formatParam(defOf.get(s.key!), v) }))}
                  onValueChange={(v) => choose({ [s.key!]: v })}
                />
              )
            }
          >
            {current ? (
              <Ranked>
                <SeedTable
                  rows={s.rows}
                  metrics={s.metrics}
                  method={method.slug}
                  evalSlug={s.job.eval.slug}
                  only={current.id}
                  className={cn(FLUSH, 'min-w-0')}
                />
              </Ranked>
            ) : (
              <SeedTable
                rows={s.rows}
                metrics={s.metrics}
                method={method.slug}
                evalSlug={s.job.eval.slug}
                className={cn(FLUSH, 'min-w-0')}
              />
            )}
            {footer}
            {lines.length > 0 && (
              <div className="border-t border-slate-200">
                <SeedCharts charts={lines} xLabel={by} method={method.slug} heading={`Results by ${by}`} />
              </div>
            )}
          </Panel>
        );
      })}
    </>
  );
}
/**
 * A menu for a `Panel` title bar, as the samples' model menu: the label in light slate, then the
 * value. `on`: the value is not the default, so the button is sky.
 */
export function Choice({
  label,
  value,
  options,
  onValueChange,
  on,
}: {
  label: string;
  value: string;
  /** `short`: the button's text for the option, when it is chosen. */
  options: { value: string; label: string; short?: string }[];
  onValueChange: (value: string) => void;
  on?: boolean;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className={cn(
          'flex h-6 max-w-64 min-w-0 cursor-pointer items-center gap-x-1 rounded-md border bg-white px-2 text-[11px] font-medium hover:border-slate-300',
          on ? 'border-sky-700 text-sky-800' : 'border-slate-200 text-slate-700',
        )}
      >
        <span className="shrink-0 font-normal text-slate-400">{label}</span>
        <span className="truncate" title={current?.label}>
          {current?.short ?? current?.label ?? '—'}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-slate-400" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 max-w-80 min-w-40">
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value} className="cursor-pointer text-xs">
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
