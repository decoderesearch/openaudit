'use client';

import Link from '@/components/link';
import { scrollToPart } from '@/components/on-this-page';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  ArrowUp,
  BookCheck,
  Bot,
  BuildingComplex,
  Handshake,
  HardHat,
  Medal,
  UserGroup,
  type LucideIcon,
} from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

// How the parts of OpenAudit connect: what we evaluate (the bottom row), the evaluations (the middle
// row), and OpenAudit (the top). The parts are in the coordinates of the viewBox (`W` by `H`).

const W = 1000;
const H = 588;

type Kind = 'hub' | 'evals' | 'subject';
type Part = {
  id: string;
  kind: Kind;
  label: string;
  icon?: LucideIcon;
  href: string;
  about: string;
  /** The center, width and height, in viewBox units. */
  cx: number;
  cy: number;
  w: number;
  h: number;
};

/** The centers of the three columns, and the sizes of the parts. */
const COLUMNS = [150, 500, 850];
const CARD = { w: 280, h: 110 };
const ROWS = { hub: 56, evals: 290, subject: 524 };

const PARTS: Part[] = [
  {
    id: 'openaudit',
    kind: 'hub',
    label: 'OpenAudit',
    href: '/features',
    about: 'Independent evaluations of AI models, organizations, and safety methods. Why OpenAudit?',
    cx: 500,
    cy: ROWS.hub,
    w: 360,
    h: 88,
  },
  ...(
    [
      [
        'commitments',
        'Commitments and Incidents',
        Handshake,
        '/organizations/commitments',
        'What each organization committed to, scored by how detailed it is and if others can verify it, and its incidents.',
      ],
      [
        'model-evals',
        'Model Evaluations',
        BookCheck,
        '/models',
        'Tests of model safety, with the results of each model.',
      ],
      [
        'method-evals',
        'Safety Method Evaluations',
        Medal,
        '/methods',
        'Tests that score how well each safety method does its job.',
      ],
    ] as const
  ).map(([id, label, icon, href, about], i) => ({
    id,
    kind: 'evals' as const,
    label,
    icon,
    href,
    about,
    cx: COLUMNS[i],
    cy: ROWS.evals,
    ...CARD,
  })),
  ...(
    [
      [
        'orgs',
        'Organizations',
        BuildingComplex,
        '/organizations',
        'AI organizations, with their incidents, departures, and model audits.',
      ],
      ['models', 'Models', Bot, '/models', 'AI models, with their safety cards and flagged chats.'],
      [
        'methods',
        'Safety Methods',
        HardHat,
        '/methods',
        'Tools that help make models safe, for example probes, monitors, and sparse autoencoders.',
      ],
    ] as const
  ).map(([id, label, icon, href, about], i) => ({
    id,
    kind: 'subject' as const,
    label,
    icon,
    href,
    about,
    cx: COLUMNS[i],
    cy: ROWS.subject,
    ...CARD,
  })),
];

type Side = 'top' | 'bottom' | 'left' | 'right';
/** `toDx`: where the arrow ends, from the middle of that side of `to`. `curve`: it leaves straight
 * out and bends into `to`. */
const ARROWS: { from: string; at: Side; to: string; on: Side; toDx?: number; curve?: boolean }[] = [
  { from: 'commitments', at: 'top', to: 'openaudit', on: 'bottom', toDx: -120, curve: true },
  { from: 'model-evals', at: 'top', to: 'openaudit', on: 'bottom' },
  { from: 'method-evals', at: 'top', to: 'openaudit', on: 'bottom', toDx: 120, curve: true },
  { from: 'orgs', at: 'top', to: 'commitments', on: 'bottom' },
  { from: 'models', at: 'top', to: 'model-evals', on: 'bottom' },
  { from: 'methods', at: 'top', to: 'method-evals', on: 'bottom' },
  { from: 'orgs', at: 'right', to: 'models', on: 'left' },
  { from: 'methods', at: 'left', to: 'models', on: 'right' },
];

/** In viewBox units: the space between an arrow's ends and its parts, and the length and half width
 * of its head. `TILT`: how far a curve's end leans to the side, for each unit it goes up. */
const GAP = 8;
const HEAD = 18;
const HEAD_HALF = 7.5;
const TILT = 0.35;

/** The classes of each tone. Change these to restyle the diagram. */
const TONES = {
  /** On a white or light background. */
  light: {
    hub: 'border-2 border-slate-200 bg-white text-sky-800 shadow-md shadow-sky-900/10',
    evals: 'border border-slate-200 bg-white text-slate-700 shadow-sm',
    subject: 'border border-sky-100 bg-sky-50 text-sky-900',
    icon: { hub: '', evals: 'bg-sky-50 text-sky-700', subject: 'bg-white text-sky-700' },
    hover: 'hover:border-sky-700 hover:shadow-md',
    arrow: 'text-slate-300',
    arrowLit: 'text-sky-600',
  },
  /** On a dark background, for example the home page's sky hero. */
  dark: {
    hub: 'bg-white text-sky-900 shadow-lg shadow-sky-950/30',
    evals: 'border border-white/25 bg-white/10 text-white',
    subject: 'border border-white/10 bg-sky-950/30 text-white',
    icon: { hub: '', evals: 'bg-white/15 text-white', subject: 'bg-white/10 text-sky-100' },
    hover: 'hover:border-white/70 hover:bg-white/20',
    arrow: 'text-white/35',
    arrowLit: 'text-white',
  },
};

const byId = new Map(PARTS.map((p) => [p.id, p]));

/** The middle of `side` of `p`. */
function sideOf(p: Part, side: Side): [number, number] {
  if (side === 'top') return [p.cx, p.cy - p.h / 2];
  if (side === 'bottom') return [p.cx, p.cy + p.h / 2];
  return [side === 'left' ? p.cx - p.w / 2 : p.cx + p.w / 2, p.cy];
}

/** The unit vector out of `side`. */
const OUT: Record<Side, [number, number]> = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };

/** The arrow's line (or curve) and its head (a triangle), `GAP` from each part. */
function arrowPaths({ from, at, to, on, toDx = 0, curve }: (typeof ARROWS)[number]) {
  const [ox, oy] = OUT[at];
  const [ix, iy] = OUT[on];
  const [fx, fy] = sideOf(byId.get(from)!, at);
  const [tx, ty] = sideOf(byId.get(to)!, on);
  const [sx, sy] = [fx + ox * GAP, fy + oy * GAP];
  const [ex, ey] = [tx + toDx + ix * GAP, ty + iy * GAP];
  // The head points along the last part of the line. A curve's end goes into `to`, leaning toward
  // the side it came from.
  const [dx, dy] = curve
    ? [-ix + Math.sign(ex - sx) * TILT * Math.abs(iy), -iy + Math.sign(ey - sy) * TILT * Math.abs(ix)]
    : [ex - sx, ey - sy];
  const [ux, uy] = [dx / Math.hypot(dx, dy), dy / Math.hypot(dx, dy)];
  // The line stops inside the head, so its round cap does not show past the base.
  const [bx, by] = [ex - ux * (HEAD - 1), ey - uy * (HEAD - 1)];
  let line = `M${sx},${sy} L${bx},${by}`;
  if (curve) {
    const reach = Math.abs(ix ? ex - sx : ey - sy);
    const [p1x, p1y] = [sx + ox * reach * 0.5, sy + oy * reach * 0.5];
    const [p2x, p2y] = [bx - ux * reach * 0.45, by - uy * reach * 0.45];
    line = `M${sx},${sy} C${p1x},${p1y} ${p2x},${p2y} ${bx},${by}`;
  }
  const [hx, hy] = [ex - ux * HEAD, ey - uy * HEAD];
  const head = `M${ex},${ey} L${hx - uy * HEAD_HALF},${hy + ux * HEAD_HALF} L${hx + uy * HEAD_HALF},${hy - ux * HEAD_HALF}Z`;
  return { line, head };
}

/** As a percent of the diagram's width or height. */
const pct = (v: number, of: number) => `${(100 * v) / of}%`;

/** A part's icon (or logo) and label. */
function PartBody({ part: p, iconClass, small }: { part: Part; iconClass: string; small?: boolean }) {
  if (p.kind === 'hub')
    return (
      <>
        <Image src="/chip_check.svg" alt="" width={32} height={32} unoptimized className="size-[3.6cqw] shrink-0" />
        <span className="font-display text-[clamp(12px,2.8cqw,28px)] font-extrabold tracking-tight">{p.label}</span>
      </>
    );
  const Icon = p.icon!;
  return (
    <>
      <span className={cn('flex size-[5.2cqw] shrink-0 items-center justify-center rounded-full', iconClass)}>
        <Icon aria-hidden className="size-[2.8cqw]" />
      </span>
      <span
        className={cn(
          'min-w-0 flex-1 text-center leading-tight font-semibold text-balance',
          small ? 'text-[clamp(10px,2cqw,15px)]' : 'text-[clamp(10px,2.3cqw,17px)]',
        )}
      >
        {p.label}
      </span>
    </>
  );
}

/** The badge on a part that takes contributions. `fixed`: in pixels, not in units of the diagram. */
function ContributeBadge({ fixed }: { fixed?: boolean }) {
  return (
    <span
      className={cn(
        'absolute top-0 flex -translate-y-1/2 items-center rounded-full bg-emerald-600 leading-none font-semibold text-white shadow-sm transition-transform duration-200 ease-out group-hover:scale-115 group-focus-visible:scale-115',
        fixed
          ? '-right-1.5 gap-x-1 px-2.5 py-1 text-[11px]'
          : '-right-[1.2cqw] gap-x-[0.6cqw] px-[1.9cqw] py-[0.75cqw] text-[clamp(8px,1.5cqw,13px)]',
      )}
    >
      <UserGroup aria-hidden className={cn('shrink-0', fixed ? 'size-3.5' : 'size-[1.9cqw]')} />
      Contribute
    </span>
  );
}

/** `p`, with its label from `labels` if there is one. */
const relabel = (p: Part, labels?: Record<string, string>): Part =>
  labels?.[p.id] ? { ...p, label: labels[p.id] } : p;

/** The parts of the diagram as a column, for narrow screens: OpenAudit, then the evaluations, then
 * what we evaluate. `contribute`, `labels`: as in `SiteDiagram`. */
export function SiteStack({
  contribute,
  labels,
  className,
}: {
  contribute?: Record<string, string>;
  labels?: Record<string, string>;
  className?: string;
}) {
  const t = TONES.light;
  const card = (part: Part) => {
    const p = relabel(part, labels);
    const anchor = contribute?.[p.id];
    const cls = cn(
      'relative flex min-h-14 items-center gap-x-3 rounded-xl px-4 py-2 transition-[color,background-color,border-color,box-shadow] duration-200',
      t[p.kind],
      anchor && cn('group', t.hover),
    );
    const Icon = p.icon!;
    const inner = (
      <>
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', t.icon[p.kind])}>
          <Icon aria-hidden className="size-5" />
        </span>
        <span className="min-w-0 flex-1 text-center text-sm leading-tight font-semibold">{p.label}</span>
        {anchor && <ContributeBadge fixed />}
      </>
    );
    return anchor ? (
      <a key={p.id} href={`#${anchor}`} onClick={(e) => scrollToPart(e, anchor)} className={cls}>
        {inner}
      </a>
    ) : (
      <div key={p.id} className={cls}>
        {inner}
      </div>
    );
  };
  const hub = relabel(byId.get('openaudit')!, labels);
  const hubAnchor = contribute?.[hub.id];
  const hubClass = cn(
    'relative mx-auto flex h-12 items-center gap-x-2 rounded-full px-8 transition-[color,background-color,border-color,box-shadow] duration-200',
    t.hub,
    hubAnchor && cn('group', t.hover),
  );
  const hubInner = (
    <>
      <Image src="/chip_check.svg" alt="" width={32} height={32} unoptimized className="size-6 shrink-0" />
      <span className="font-display text-lg font-extrabold tracking-tight">{hub.label}</span>
      {hubAnchor && <ContributeBadge fixed />}
    </>
  );
  const up = <ArrowUp aria-hidden className="mx-auto size-5 text-slate-300" />;
  return (
    <nav aria-label="Parts of OpenAudit" className={cn('flex flex-col gap-y-3', className)}>
      {hubAnchor ? (
        <a href={`#${hubAnchor}`} onClick={(e) => scrollToPart(e, hubAnchor)} className={hubClass}>
          {hubInner}
        </a>
      ) : (
        <div className={hubClass}>{hubInner}</div>
      )}
      {up}
      <div className="flex flex-col gap-y-4">{PARTS.filter((p) => p.kind === 'evals').map(card)}</div>
      {up}
      <div className="flex flex-col gap-y-4">{PARTS.filter((p) => p.kind === 'subject').map(card)}</div>
    </nav>
  );
}

/** The infographic of OpenAudit's parts. It scales with its width. With `links`, each part links to
 * its page and shows what it is on hover, and the arrows to and from the part under the pointer get
 * brighter. Without, it is a picture: nothing takes a click. `contribute`: for each part that takes
 * contributions, the id of its anchor on the page. These parts get a badge and link to their
 * anchor, and the cards get more space at their sides and smaller labels. `labels`: new labels for
 * some parts, by id. */
export function SiteDiagram({
  tone = 'light',
  links = true,
  contribute,
  labels,
  className,
}: {
  tone?: keyof typeof TONES;
  links?: boolean;
  contribute?: Record<string, string>;
  labels?: Record<string, string>;
  className?: string;
}) {
  const [lit, setLit] = useState<string | null>(null);
  const t = TONES[tone];
  const box = (p: Part, live: boolean) => ({
    className: cn(
      'absolute flex items-center gap-x-[1.2cqw] transition-[color,background-color,border-color,box-shadow] duration-200',
      p.kind === 'hub'
        ? 'justify-center rounded-full px-[3cqw]'
        : cn('rounded-[1.4cqw]', contribute ? 'px-[2.6cqw]' : 'pr-[1.2cqw] pl-[1.8cqw]'),
      t[p.kind],
      live && cn('group', t.hover),
    ),
    style: { left: pct(p.cx - p.w / 2, W), top: pct(p.cy - p.h / 2, H), width: pct(p.w, W), height: pct(p.h, H) },
  });
  const light = (id: string) => ({
    onPointerEnter: () => setLit(id),
    onPointerLeave: () => setLit(null),
    onFocus: () => setLit(id),
    onBlur: () => setLit(null),
  });
  const body = (p: Part) => (
    <>
      <PartBody part={relabel(p, labels)} iconClass={t.icon[p.kind]} small={!!contribute} />
      {contribute?.[p.id] && <ContributeBadge />}
    </>
  );
  const live = links || !!contribute;
  const Box = live ? 'nav' : 'div';
  return (
    <TooltipProvider delayDuration={150}>
      <Box
        aria-label="Parts of OpenAudit"
        role={live ? undefined : 'img'}
        className={cn('@container relative w-full', className)}
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        <svg aria-hidden viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full overflow-visible">
          {ARROWS.map((a) => {
            const { line, head } = arrowPaths(a);
            return (
              <g
                key={`${a.from}-${a.to}`}
                className={cn('transition-colors', lit && (a.from === lit || a.to === lit) ? t.arrowLit : t.arrow)}
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
        {PARTS.map((p) => {
          const anchor = contribute?.[p.id];
          if (anchor)
            return (
              <a
                key={p.id}
                href={`#${anchor}`}
                onClick={(e) => scrollToPart(e, anchor)}
                {...light(p.id)}
                {...box(p, true)}
              >
                {body(p)}
              </a>
            );
          if (!links)
            return (
              <div key={p.id} aria-hidden {...box(p, false)}>
                {body(p)}
              </div>
            );
          return (
            <Tooltip key={p.id}>
              <TooltipTrigger asChild>
                <Link href={p.href} hover={false} {...light(p.id)} {...box(p, true)}>
                  {body(p)}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6} className="max-w-64 text-center">
                {p.about}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </Box>
    </TooltipProvider>
  );
}
