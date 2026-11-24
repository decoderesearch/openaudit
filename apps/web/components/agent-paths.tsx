'use client';

import Link from '@/components/link';
import { scrollToPart } from '@/components/on-this-page';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AGENT_PATHS } from '@/lib/contribute';
import { cn } from '@/lib/utils';
import {
  ArrowDown,
  BookCheck,
  FileText,
  FlaskConical,
  GitPullRequest,
  Handshake,
  HardHat,
  Lightbulb,
  Medal,
  Megaphone,
  MessageSquareText,
  SearchCheck,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

// The paths of the agent guide, in the style of the site diagram (site-diagram.tsx): the prompt,
// the guide's first question, the kinds of contribution, and where each one ends. The parts are
// in the coordinates of the viewBox (`W` by `H`).

const W = 1000;
const H = 560;

type Path = (typeof AGENT_PATHS.paths)[number];
type Id = 'start' | (typeof AGENT_PATHS.branches)[number]['id'] | Path['id'] | (typeof AGENT_PATHS.ends)[number]['id'];
type Box = { cx: number; cy: number; w: number; h: number };

const BRANCH = { w: 280, h: 62, cy: 176 };
const LEAF = { w: 150, h: 140, cy: 348 };
const END = { w: 240, h: 54, cy: 526 };

const BOX: Record<Id, Box> = {
  start: { cx: 500, cy: 38, w: 400, h: 64 },
  research: { cx: 250, ...BRANCH },
  report: { cx: 750, ...BRANCH },
  'model-eval': { cx: 85, ...LEAF },
  method: { cx: 250, ...LEAF },
  'method-eval': { cx: 415, ...LEAF },
  incident: { cx: 585, ...LEAF },
  errors: { cx: 750, ...LEAF },
  ideas: { cx: 915, ...LEAF },
  pr: { cx: 250, ...END },
  form: { cx: 750, ...END },
};

const ICONS: Record<Id, LucideIcon> = {
  start: MessageSquareText,
  research: FlaskConical,
  report: Megaphone,
  'model-eval': BookCheck,
  method: HardHat,
  'method-eval': Medal,
  incident: Handshake,
  errors: SearchCheck,
  ideas: Lightbulb,
  pr: GitPullRequest,
  form: FileText,
};

/** Each arrow goes down, from the bottom of `from` to the top of `to`. `dx`: where it leaves
 * `from`, from the middle. `toDx`: where it ends on `to`. `curve`: it leaves straight down and
 * bends into `to`. */
type Arrow = { from: Id; to: Id; dx?: number; toDx?: number; curve?: boolean };
const ARROWS: Arrow[] = [
  { from: 'start', to: 'research', dx: -110, curve: true },
  { from: 'start', to: 'report', dx: 110, curve: true },
  { from: 'research', to: 'model-eval', dx: -80, curve: true },
  { from: 'research', to: 'method' },
  { from: 'research', to: 'method-eval', dx: 80, curve: true },
  { from: 'report', to: 'incident', dx: -80, curve: true },
  { from: 'report', to: 'errors' },
  { from: 'report', to: 'ideas', dx: 80, curve: true },
  { from: 'model-eval', to: 'pr', toDx: -70, curve: true },
  { from: 'method', to: 'pr' },
  { from: 'method-eval', to: 'pr', toDx: 70, curve: true },
  { from: 'incident', to: 'form', toDx: -70, curve: true },
  { from: 'errors', to: 'form' },
  { from: 'ideas', to: 'form', toDx: 70, curve: true },
];

/** In viewBox units: the space between an arrow's ends and its parts, and the length and half width
 * of its head. `TILT`: how far a curve's end leans to the side, for each unit it goes down. */
const GAP = 8;
const HEAD = 18;
const HEAD_HALF = 7.5;
const TILT = 0.35;

const pathOf = new Map<Id, Path>(AGENT_PATHS.paths.map((p) => [p.id, p]));

/** The arrow's line (or curve) and its head (a triangle), `GAP` from each part. */
function arrowPaths({ from, to, dx = 0, toDx = 0, curve }: Arrow) {
  const a = BOX[from];
  const b = BOX[to];
  const [sx, sy] = [a.cx + dx, a.cy + a.h / 2 + GAP];
  const [ex, ey] = [b.cx + toDx, b.cy - b.h / 2 - GAP];
  // The head points along the last part of the line. A curve's end leans toward the side it came
  // from.
  const [vx, vy] = curve ? [Math.sign(ex - sx) * TILT, 1] : [ex - sx, ey - sy];
  const [ux, uy] = [vx / Math.hypot(vx, vy), vy / Math.hypot(vx, vy)];
  // The line stops inside the head, so its round cap does not show past the base.
  const [bx, by] = [ex - ux * (HEAD - 1), ey - uy * (HEAD - 1)];
  let line = `M${sx},${sy} L${bx},${by}`;
  if (curve) {
    const reach = ey - sy;
    line = `M${sx},${sy} C${sx},${sy + reach * 0.5} ${bx - ux * reach * 0.45},${by - uy * reach * 0.45} ${bx},${by}`;
  }
  const [hx, hy] = [ex - ux * HEAD, ey - uy * HEAD];
  const head = `M${ex},${ey} L${hx - uy * HEAD_HALF},${hy + ux * HEAD_HALF} L${hx + uy * HEAD_HALF},${hy - ux * HEAD_HALF}Z`;
  return { line, head };
}

/** True when the arrow is on a path through the part under the pointer. */
function lit(a: Arrow, id: Id | null) {
  if (!id) return false;
  const path = pathOf.get(id);
  if (path) return (a.from === 'start' && a.to === path.branch) || a.to === id || a.from === id;
  if (id === 'start' || id === 'pr' || id === 'form') return a.from === id || a.to === id;
  return (a.from === 'start' && a.to === id) || a.from === id;
}

const pct = (v: number, of: number) => `${(100 * v) / of}%`;

const KIND = {
  start: 'justify-center rounded-full border-2 border-slate-200 bg-white text-sky-800 shadow-md shadow-sky-900/10',
  branch: 'justify-center rounded-[1.4cqw] border border-sky-100 bg-sky-50 text-sky-900',
  path: 'flex-col justify-center gap-y-[0.8cqw] rounded-[1.4cqw] border border-slate-200 bg-white px-[0.6cqw] py-[1.6cqw] text-center text-slate-700 shadow-sm hover:border-sky-700 hover:shadow-md',
  end: 'justify-center rounded-full bg-slate-100 text-slate-700',
};

/** The diagram of the agent guide's paths. Each part shows more on hover; each kind of contribution
 * links to its part of the page. It scales with its width. */
export function AgentPaths({ className }: { className?: string }) {
  const [on, setOn] = useState<Id | null>(null);
  const hover = (id: Id) => ({
    onPointerEnter: () => setOn(id),
    onPointerLeave: () => setOn(null),
    onFocus: () => setOn(id),
    onBlur: () => setOn(null),
  });

  const part = (id: Id, kind: keyof typeof KIND, label: string, about: string, body: ReactNode, href?: string) => {
    const b = BOX[id];
    const props = {
      ...hover(id),
      className: cn(
        'absolute flex items-center gap-x-[1cqw] transition-[color,background-color,border-color,box-shadow] duration-200',
        KIND[kind],
      ),
      style: { left: pct(b.cx - b.w / 2, W), top: pct(b.cy - b.h / 2, H), width: pct(b.w, W), height: pct(b.h, H) },
    };
    const anchor = href?.startsWith('#') ? href.slice(1) : null;
    return (
      <Tooltip key={id}>
        <TooltipTrigger asChild>
          {anchor ? (
            <a href={href} onClick={(e) => scrollToPart(e, anchor)} {...props}>
              {body}
            </a>
          ) : href ? (
            <Link href={href} hover={false} {...props}>
              {body}
            </Link>
          ) : (
            <div tabIndex={0} aria-label={label} {...props}>
              {body}
            </div>
          )}
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6} className="max-w-64 text-center">
          {about}
        </TooltipContent>
      </Tooltip>
    );
  };

  const icon = (id: Id, className: string) => {
    const Icon = ICONS[id];
    return (
      <span className={cn('flex size-[4.4cqw] shrink-0 items-center justify-center rounded-full', className)}>
        <Icon aria-hidden className="size-[2.4cqw]" />
      </span>
    );
  };
  const row = (id: Id, label: ReactNode, iconClass: string, text: string) => (
    <>
      {icon(id, iconClass)}
      <span className={cn('leading-tight font-semibold', text)}>{label}</span>
    </>
  );

  const { start, branches, paths, ends } = AGENT_PATHS;
  return (
    <TooltipProvider delayDuration={150}>
      <nav
        aria-label="Paths of the agent prompt"
        className={cn('@container relative w-full', className)}
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        <svg aria-hidden viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full overflow-visible">
          {ARROWS.map((a) => {
            const { line, head } = arrowPaths(a);
            return (
              <g
                key={`${a.from}-${a.to}`}
                className={cn('transition-colors', lit(a, on) ? 'text-sky-600' : 'text-slate-300')}
              >
                <path
                  d={line}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                <path d={head} fill="currentColor" />
              </g>
            );
          })}
        </svg>
        {part(
          'start',
          'start',
          `${start.label} ${start.file}`,
          start.about,
          row(
            'start',
            <>
              {start.label} <code className="font-mono font-semibold">{start.file}</code>
            </>,
            'text-sky-700',
            'font-display text-[clamp(12px,2.4cqw,22px)] font-extrabold',
          ),
        )}
        {branches.map((b) =>
          part(
            b.id,
            'branch',
            b.label,
            b.about,
            row(b.id, b.label, 'bg-white text-sky-700', 'text-[clamp(10px,2cqw,16px)]'),
          ),
        )}
        {paths.map((p) =>
          part(
            p.id,
            'path',
            p.label,
            p.about,
            <>
              {icon(p.id, 'bg-sky-50 text-sky-700')}
              <span className="px-[0.4cqw] text-[clamp(9px,1.55cqw,13px)] leading-tight font-semibold text-balance">
                {p.label}
              </span>
              {'example' in p && (
                <span className="text-[clamp(8px,1.25cqw,11px)] leading-tight whitespace-nowrap text-slate-400">
                  e.g. {p.example}
                </span>
              )}
            </>,
            `#${p.anchor}`,
          ),
        )}
        {ends.map((e) =>
          part(
            e.id,
            'end',
            e.label,
            e.about,
            row(e.id, e.label, 'text-slate-500', 'text-[clamp(10px,1.9cqw,15px)]'),
            'href' in e ? e.href : undefined,
          ),
        )}
      </nav>
    </TooltipProvider>
  );
}

/** The paths as a column, for narrow screens: the prompt, then each branch with its kinds of
 * contribution, which link to their part of the page. */
export function AgentPathsStack({ className }: { className?: string }) {
  const { start, branches, paths } = AGENT_PATHS;
  const Start = ICONS.start;
  return (
    <nav aria-label="Paths of the agent prompt" className={cn('flex flex-col gap-y-3', className)}>
      <div className="mx-auto flex min-h-11 items-center gap-x-2 rounded-full border-2 border-slate-200 bg-white px-5 py-2 text-sky-800 shadow-md shadow-sky-900/10">
        <Start aria-hidden className="size-5 text-sky-700" />
        <span className="font-display text-sm font-extrabold">
          {start.label} <code className="font-mono font-semibold">{start.file}</code>
        </span>
      </div>
      <ArrowDown aria-hidden className="mx-auto size-5 text-slate-300" />
      {branches.map((b) => (
        <div key={b.id} className="flex flex-col gap-y-2 rounded-xl bg-sky-50 p-3">
          <p className="text-sm font-semibold text-sky-900">{b.label}</p>
          {paths
            .filter((p) => p.branch === b.id)
            .map((p) => {
              const Icon = ICONS[p.id];
              return (
                <a
                  key={p.id}
                  href={`#${p.anchor}`}
                  onClick={(e) => scrollToPart(e, p.anchor)}
                  className="flex items-center gap-x-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:border-sky-700"
                >
                  <Icon aria-hidden className="size-4 shrink-0 text-sky-700" />
                  <span className="flex flex-1 flex-col">
                    <span className="font-semibold">{p.label}</span>
                    {'example' in p && <span className="text-xs text-slate-400">e.g. {p.example}</span>}
                  </span>
                </a>
              );
            })}
        </div>
      ))}
    </nav>
  );
}
