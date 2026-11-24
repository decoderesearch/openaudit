'use client';

import { bySuite, type SuiteInfo } from '@/components/catalog/eval-browser';
import { MethodResults } from '@/components/home-feed-stories';
import { HOME_BOX, HOME_BUTTON, HOME_HEAD, HOME_SCROLL, HomeEvalsLink } from '@/components/home-models';
import { boxed, useWheelFromSide } from '@/components/infinite-feed';
import Link from '@/components/link';
import { byCompared, type MenuEval } from '@/components/nav/menu-evals';
import { MenuPageLink } from '@/components/nav/nav-menu';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import type { Compared } from '@/lib/method-compares';
import { mostFirsts, topOf, type MethodFeedEntry } from '@/lib/method-feed';
import { suitePath } from '@/lib/methods';
import { cn } from '@/lib/utils';
import { useRef, type CSSProperties, type ReactElement } from 'react';

/** A tree's row. `last`: the last row of its tree. A suite shows as one row, with no row per eval. */
type Row = { key: string; href: string; last: boolean };
type EvalRow = Row & { eval: MenuEval };
type SuiteRow = Row & { suite: SuiteInfo; evals: MenuEval[] };

/** A tree line at the left of a row, from the bottom of the box above it (the gap of 8px and the
 * row's border of 1px) to 1px below the row. It has a branch to the row's edge at the title's middle
 * (the border, 12px of padding, the eyebrow's 16px and half the title's 18px line). The line of the last
 * row stops at its branch. The rows are 24px in, so the line is 5px out from the title above it.
 * A tree with no head hides it. `at`: the branch's px from the row's top, for a row of other sizes. */
export function Branch({ last, at = 46 }: { last: boolean; at?: number }) {
  return (
    <span
      aria-hidden
      data-tree-box
      style={{ '--branch': `${at}px` } as CSSProperties}
      className={cn(
        "pointer-events-none absolute -top-[9px] -bottom-[2px] -left-3 w-3 border-l border-slate-300 after:absolute after:top-(--branch) after:right-px after:left-0 after:h-px after:bg-slate-300 after:content-['']",
        last && 'bottom-auto h-(--branch)',
      )}
    />
  );
}
const ROWS = 'pl-6';

const EYEBROW = 'text-[10px] leading-4 font-bold tracking-wide text-slate-300 uppercase';

/** A title that shows `about` in a card while hovered. */
function About({ about, children }: { about: string | null | undefined; children: ReactElement }) {
  if (!about) return children;
  return (
    <HoverCard>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="bottom" className="text-[11px] leading-snug text-slate-700">
        {about}
      </HoverCardContent>
    </HoverCard>
  );
}

/** An eval's or suite's name, with its summary in a card while hovered, then its creator below it.
 * Both wrap. `className`: the name's size. */
export function EvalHead({
  label,
  href,
  creator,
  about,
  className,
}: {
  label: string;
  href: string;
  creator?: string | null;
  about?: string | null;
  className?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <About about={about}>
        <Link
          href={href}
          hover={false}
          className={cn(
            'relative self-start text-sm leading-[18px] font-semibold text-slate-800 hover:text-sky-800 hover:underline',
            className,
          )}
        >
          {label}
        </Link>
      </About>
      {/* Not a link: a click goes through to the box's link. */}
      {creator && (
        <span className="pointer-events-none mt-0.5 text-[8px] leading-3 font-semibold tracking-wide text-slate-400 uppercase">
          {creator}
        </span>
      )}
    </div>
  );
}

/** An eval's or suite's box: its head at the left in 9rem (a name as long as "SynthSAEBench-16k" does
 * not wrap), and its best methods in the rest. The
 * first method's text is level with the first line of the name's text (the eyebrow's 16px and a
 * 18px name line, less the 1.5px from a 12px text to a 14px text in their lines). */
function EvalCard({
  last,
  top,
  ...head
}: Parameters<typeof EvalHead>[0] & { last: boolean; top: MethodFeedEntry['top'] }) {
  return (
    <>
      <Branch last={last} />
      <div className="grid grid-cols-[9rem_minmax(0,1fr)] items-start gap-x-2">
        <div className="flex min-w-0 flex-col">
          <span className={cn(EYEBROW, 'text-[9px]/4')}>Evaluation</span>
          <EvalHead {...head} />
        </div>
        <div className="min-w-0 pt-[18.5px]">
          <MethodResults summary={null} top={top} />
        </div>
      </div>
    </>
  );
}

const BOX = 'pr-2.5';

const renderEval = boxed(
  (r: EvalRow) => (
    <EvalCard
      last={r.last}
      label={r.eval.label}
      href={r.eval.href}
      creator={r.eval.creator}
      about={r.eval.summary}
      top={topOf(r.eval).slice(0, 3)}
    />
  ),
  () => 'Open Results',
  BOX,
);

const renderSuite = boxed(
  (r: SuiteRow) => (
    <EvalCard
      last={r.last}
      label={r.suite.label}
      href={r.href}
      creator={r.suite.creator}
      about={r.suite.summary}
      top={mostFirsts(r.evals)}
    />
  ),
  () => 'Open Results',
  BOX,
);

/** A tree's head. A method's head is a white box with "Method" and its name, which opens its page; its text
 * shows in a card while the name is hovered. The head of evals that compare several methods is
 * only a name, as plain text: their topic, else the methods' names. */
function TreeHead({ compares: c }: { compares: Compared }) {
  if (!c.href)
    return (
      <div className="border border-transparent pt-0 pr-4 pb-0 pl-1">
        <span className={cn(EYEBROW, 'block text-slate-400')}>{c.topic ? 'Topic' : 'Methods'}</span>
        <h3 className="-mt-1 text-[13px] leading-5 font-semibold text-slate-700">{c.label}</h3>
      </div>
    );
  return (
    <div className="group relative rounded-[10px] border border-transparent bg-white px-4 py-3 transition-colors hover:border-sky-700 hover:bg-sky-50">
      <Link href={c.href} hover={false} aria-hidden tabIndex={-1} className="absolute inset-0 rounded-[10px]" />
      <span className={cn(EYEBROW, 'block text-[9px]/4')}>Method</span>
      <h3 className="-mt-1 text-[15px] leading-6 font-semibold text-slate-700">
        <About about={c.about}>
          <Link href={c.href} hover={false} className="relative group-hover:text-sky-800 group-hover:underline">
            {c.label}
          </Link>
        </About>
      </h3>
    </div>
  );
}

function rowsOf(evals: MenuEval[]): (EvalRow | SuiteRow)[] {
  const items = bySuite(evals);
  return items.map((item, i) => {
    const last = i === items.length - 1;
    return 'row' in item
      ? { key: item.row.href, href: item.row.href, last, eval: item.row }
      : {
          key: item.suite.slug,
          href: suitePath(item.suite.slug),
          last,
          suite: item.suite,
          evals: item.rows,
        };
  });
}

/** A method for the home page's list. */
export type HomeMethod = { label: string; href: string; summary: string };

/** The home page's method evals, in a box that scrolls: in trees by what they compare, each eval
 * or suite as a card. A suite shows as one card. Then each method of
 * `methods` with no tree of its own, as a head only. */
export function HomeMethodEvals({
  evals,
  methods = [],
  count,
  evalCount,
  className,
}: {
  evals: MenuEval[];
  methods?: HomeMethod[];
  count?: number;
  evalCount?: number;
  className?: string;
}) {
  const groups = byCompared(evals);
  const heads = new Set(groups.map((g) => g.compares?.href));
  const rest = methods.filter((m) => !heads.has(m.href));
  const section = useRef<HTMLElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useWheelFromSide('right', section, box);
  return (
    <section
      ref={section}
      aria-label="Safety Methods"
      className={cn('flex flex-col overflow-hidden rounded-lg', HOME_BOX, className)}
    >
      <div className={cn('flex shrink-0 items-center justify-between gap-x-3', HOME_HEAD)}>
        <h2 className="flex shrink-0">
          <MenuPageLink href="/methods" count={count} className={HOME_BUTTON}>
            Safety Methods
          </MenuPageLink>
        </h2>
        <HomeEvalsLink href="/methods" anchor="/methods#method-evaluations" count={evalCount} />
      </div>
      <div ref={box} className={cn('min-h-0 flex-1 overflow-y-auto px-3 pb-3', HOME_SCROLL)}>
        {!groups.length && <p className="px-1 py-3 text-sm text-slate-600">No results yet.</p>}
        {groups.map((g) => (
          <section
            key={g.compares?.key ?? ''}
            aria-label={g.compares?.label ?? 'Other evaluations'}
            className={cn(
              'flex flex-col gap-y-2',
              g.compares && !g.compares.href ? 'not-first:mt-2' : 'not-first:mt-4',
            )}
          >
            {g.compares && <TreeHead compares={g.compares} />}
            <ul className={cn('flex flex-col gap-y-2', g.compares ? ROWS : '[&_[data-tree-box]]:hidden')}>
              {rowsOf(g.evals).map((r) => ('suite' in r ? renderSuite(r) : renderEval(r)))}
            </ul>
          </section>
        ))}
        {rest.length > 0 && (
          <section aria-label="Other methods" className="flex flex-col gap-y-2 not-first:mt-4">
            {rest.map((m) => (
              <TreeHead
                key={m.href}
                compares={{ key: m.href, label: m.label, href: m.href, tagline: null, about: m.summary }}
              />
            ))}
          </section>
        )}
      </div>
    </section>
  );
}
