'use client';

import { bySuite, childLabel, suiteHover, type SuiteInfo } from '@/components/catalog/eval-browser';
import { BestWorst, Leaders } from '@/components/catalog/leaders';
import { Branch } from '@/components/catalog/method-browser';
import { AboutLink, EvalLink } from '@/components/eval-link';
import Link from '@/components/link';
import { MENU_HEAD, MENU_LIST, MenuBlurHead, MenuPageLink, MoreLink } from '@/components/nav/nav-menu';
import type { Leader } from '@/lib/leaders';
import type { Compared } from '@/lib/method-compares';
import { mostFirsts } from '@/lib/method-feed';
import { suitePath } from '@/lib/methods';
import { cn } from '@/lib/utils';

/** An eval in a menu: its creator, date and summary (as in its `EvalHover`), its topic, and the 3
 * at each end. `top`: the first 3, which can overlap `worst`. `suite`: a podium column shows its
 * evals as a tree under it. `compares`: the method or job that it compares. `updated`: the time
 * (ISO) that it last had a version published. */
export type MenuEval = {
  label: string;
  slug: string;
  href: string;
  creator: string | null;
  date?: string | null;
  summary?: string | null;
  topic: string | null;
  worst: Leader[];
  best: Leader[];
  top?: Leader[];
  suite?: SuiteInfo;
  compares?: Compared | null;
  updated?: string | null;
};

/** The heads of a menu's columns, a little left of their rows. As tall as a `MenuPageLink`, so a
 * title lines up with one. */
export const COLUMN_HEAD = cn(MENU_HEAD, 'top-3 h-6 pr-4 pl-4');
/** The blur behind the heads. */
export const COLUMN_BLUR = 'h-11 bg-white/75';
/** A column's list. */
export const COLUMN_LIST = cn(MENU_LIST, 'pt-9 pb-1');
/** A line between rows that starts at the text, not at the left edge. */
export const COLUMN_RULE =
  '[li+&]:before:absolute [li+&]:before:top-0 [li+&]:before:right-0 [li+&]:before:left-5 [li+&]:before:h-px [li+&]:before:bg-slate-100';

/** A column of evals, each with its topic, worst and best. `href`: the page that the title opens.
 * `count`: all the evals, in the title. `more`: the evals that are not shown. `podium`: each eval
 * with what it compares, its creator and its best 3 with medals (no worst). */
export function MenuEvals({
  title,
  evals,
  count,
  more = 0,
  href,
  onPick,
  podium = false,
}: {
  title: string;
  evals: MenuEval[];
  count?: number;
  more?: number;
  href: string;
  onPick: () => void;
  podium?: boolean;
}) {
  return (
    <section aria-label={title} className="relative min-w-0">
      <MenuBlurHead className={COLUMN_HEAD} blur={COLUMN_BLUR}>
        <MenuPageLink href={href} onPick={onPick} count={count} className="pl-4">
          {title}
        </MenuPageLink>
      </MenuBlurHead>
      <ul className={COLUMN_LIST}>
        {evals.length === 0 && <li className="px-5 py-2 text-slate-500">No results yet.</li>}
        {podium && <ComparedEvals evals={evals} onPick={onPick} />}
        {!podium &&
          evals.map((e) => (
            <li
              key={e.href}
              className={cn('group relative flex flex-col gap-y-1.5 px-5 py-3.5 hover:bg-slate-50', COLUMN_RULE)}
            >
              {/* The row opens the eval. Only the name shows the eval's hover card. */}
              <Link href={e.href} onClick={onPick} aria-hidden tabIndex={-1} className="absolute inset-0" />
              <span className="flex min-w-0 items-baseline gap-x-1.5">
                <EvalLink
                  slug={e.slug}
                  href={e.href}
                  onClick={onPick}
                  className="relative z-10 max-w-full min-w-0 shrink-0 truncate text-sm leading-5 font-semibold text-slate-800 group-hover:text-sky-700 group-hover:underline"
                >
                  {e.label}
                </EvalLink>
                {e.topic && <span className="truncate text-[11px] text-slate-500">{e.topic}</span>}
              </span>
              {e.worst.length + e.best.length > 0 && (
                <BestWorst
                  best={e.best}
                  worst={e.worst}
                  onPick={onPick}
                  ranked={false}
                  compact
                  warnBest
                  className="pl-4"
                />
              )}
            </li>
          ))}
        <li className="px-3 pt-1">
          <MoreLink href={href} count={more} onPick={onPick} />
        </li>
      </ul>
    </section>
  );
}

/** The rows of a podium column (`li`s), in groups by what they compare, the most recently updated
 * group and eval first. Each eval and suite shows the method (or topic) that it compares above its name. A
 * suite's evals are a tree under it. */
export function ComparedEvals({ evals, onPick }: { evals: MenuEval[]; onPick?: () => void }) {
  return byCompared(evals).flatMap(({ compares, evals: rows }) =>
    bySuite(rows).map((item) =>
      'row' in item ? (
        <PodiumEval key={item.row.href} eval={item.row} onPick={onPick} compares={compares} />
      ) : (
        <SuiteEvals key={item.suite.slug} suite={item.suite} evals={item.rows} onPick={onPick} compares={compares} />
      ),
    ),
  );
}

/** `evals` in groups by what they compare, as in `ComparedEvals`, each the most recently updated
 * first. `updated`: the newest eval's. */
export function byCompared(evals: MenuEval[]) {
  const groups = new Map<string, { compares: Compared | null; updated: string; evals: MenuEval[] }>();
  for (const e of evals.toSorted((a, b) => (b.updated ?? '').localeCompare(a.updated ?? ''))) {
    const key = e.compares?.key ?? '';
    const group = groups.get(key) ?? { compares: e.compares ?? null, updated: '', evals: [] };
    if (e.updated && e.updated > group.updated) group.updated = e.updated;
    groups.set(key, { ...group, evals: [...group.evals, e] });
  }
  return [...groups.values()].sort(
    (a, b) => Number(!a.compares) - Number(!b.compares) || b.updated.localeCompare(a.updated),
  );
}

/** The method (a link) or topic that a row compares, above the row's name. */
function ComparedEyebrow({ compares: c, onPick }: { compares: Compared | null; onPick?: () => void }) {
  if (!c) return null;
  const text = 'w-fit max-w-full truncate text-[9px] leading-3 font-semibold tracking-wide text-slate-300 uppercase';
  return c.href ? (
    <Link href={c.href} onClick={onPick} className={cn(text, 'relative z-10 hover:text-sky-800 hover:underline')}>
      {c.label}
    </Link>
  ) : (
    <span className={text}>{c.label}</span>
  );
}

const NAME =
  'relative z-10 min-w-0 truncate text-[13px] leading-5 font-semibold text-slate-800 group-hover:text-sky-800 group-hover:underline';
const MEDALS = 'gap-y-1.5 pl-2 [&_a]:font-medium [&_a]:text-slate-600';

/** A suite: a row that opens it, with what it compares above its name, its creator at the right,
 * and the 3 with the most first places on its evals. Then its evals by name as branches of a
 * tree. Only the name shows the suite's hover card. */
function SuiteEvals({
  suite,
  evals,
  onPick,
  compares,
}: {
  suite: SuiteInfo;
  evals: MenuEval[];
  onPick?: () => void;
  compares: Compared | null;
}) {
  const href = suitePath(suite.slug);
  const top = mostFirsts(evals).map((r) => ({ ...r, score: '', bar: null }));
  return (
    <li className={cn('relative', COLUMN_RULE)}>
      <div className="group relative flex flex-col gap-y-2 pt-3.5 pr-6 pb-2 pl-6 transition-colors hover:bg-sky-50">
        <Link href={href} onClick={onPick} aria-hidden tabIndex={-1} className="absolute inset-0" />
        <span className="flex min-w-0 flex-col">
          <ComparedEyebrow compares={compares} onPick={onPick} />
          <span className="flex min-w-0 items-baseline gap-x-2">
            <AboutLink href={href} info={suiteHover(suite)} onClick={onPick} className={NAME}>
              {suite.label}
            </AboutLink>
            {suite.creator && (
              <span className="ml-1 min-w-0 flex-1 truncate text-right text-[11px] text-slate-400">
                {suite.creator}
              </span>
            )}
          </span>
        </span>
        {top.length > 0 && (
          <div className="relative">
            {/* The tree line, from the name down to the evals' branches. */}
            <span aria-hidden className="pointer-events-none absolute -top-2 -bottom-2 left-1.5 w-px bg-slate-300" />
            <Leaders leaders={top} medals onPick={onPick} className={cn(MEDALS, 'pl-5')} />
          </div>
        )}
      </div>
      <ul aria-label={`${suite.label} evaluations`}>
        {evals
          .toSorted((a, b) => childLabel(a).localeCompare(childLabel(b)))
          .map((e) => (
            <PodiumEval key={e.href} eval={e} onPick={onPick} inSuite />
          ))}
      </ul>
    </li>
  );
}

/** An eval as on the Methods page, with no summary, date or topic, in a row that opens it: what it
 * compares, its name, its creator at the far right (it truncates), and its best 3. Only the name
 * shows the eval's hover card. `inSuite`: a branch of its suite's tree, with only its name and
 * best 3. */
function PodiumEval({
  eval: e,
  onPick,
  compares = null,
  inSuite = false,
}: {
  eval: MenuEval;
  onPick?: () => void;
  compares?: Compared | null;
  inSuite?: boolean;
}) {
  const top = e.top ?? e.best;
  return (
    <li
      className={cn(
        'group/variant group relative flex flex-col gap-y-2 pr-6 transition-colors hover:bg-sky-50',
        // A branch meets its row at the middle of the name's line: the row's top padding, plus 10px.
        inSuite ? 'pt-1.5 pb-2 pl-11' : cn('py-3.5 pl-6', COLUMN_RULE),
      )}
    >
      {inSuite && <Branch className="left-[30px] [--branch:16px]" />}
      <Link href={e.href} onClick={onPick} aria-hidden tabIndex={-1} className="absolute inset-0" />
      <span className="flex min-w-0 flex-col">
        {!inSuite && <ComparedEyebrow compares={compares} onPick={onPick} />}
        <span className="flex min-w-0 items-baseline gap-x-2">
          <EvalLink slug={e.slug} href={e.href} onClick={onPick} className={NAME}>
            {inSuite ? childLabel(e) : e.label}
          </EvalLink>
          {!inSuite && e.creator && (
            <span className="ml-1 min-w-0 flex-1 truncate text-right text-[11px] text-slate-400">{e.creator}</span>
          )}
        </span>
      </span>
      {top.length > 0 && (
        <Leaders
          leaders={top}
          medals
          scores={false}
          barClassName="h-2"
          onPick={onPick}
          nameClassName="text-xs"
          className={MEDALS}
        />
      )}
    </li>
  );
}
