'use client';

import { INSET_TITLE } from '@/components/box-title';
import { EvalLink } from '@/components/eval-link';
import { LinkRow } from '@/components/link-row';
import { jobLabel } from '@/components/methods/scorecard';
import { ROW, TABLE, THEAD } from '@/components/methods/table';
import {
  artifactPath,
  formatValue,
  paramText,
  series,
  siteLabel,
  valueKey,
  type ArtifactPoint,
  type Job,
  type Point,
  type VariantView,
} from '@/lib/methods';
import { cn } from '@/lib/utils';
import type { MethodParam } from '@openaudit/spec';
import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// One small chart for each job: the metric by the matched metric (L0, log scale), one line for
// each variant in one group. Baselines are dashed lines. Plain SVG, with no chart library.

export const METHOD_COLORS = ['#0284c7', '#ea580c', '#059669', '#7c3aed', '#e11d48', '#475569', '#ca8a04'];
export const FAINT = '#cbd5e1';

export const SMALL = { w: 280, h: 170 };
const LARGE = { w: 640, h: 280 };
export const PAD = { left: 38, right: 8, top: 8, bottom: 24 };
const X_TICKS = [10, 20, 40, 80, 160, 320, 640, 1280];

/** `faint`: not the highlighted variant. */
type Line = { method: VariantView; color: string; faint?: boolean; points: Point[] };
type Baseline = { method: VariantView; value: number; artifact: ArtifactPoint };
/** The point to mark: its chart (an eval slug) and its artifact. `at`: the dot on the screen, when
 * the pointer is on it; its popover shows there. */
type Hover = { chart: string; id: string; at?: DOMRect } | null;
type OnHover = (id: string | null, at?: DOMRect) => void;
/** What a point's popover shows, past the point: each subject's name and the param definitions. */
type Info = { names: Record<string, string>; defs: MethodParam[] };

/** About four round ticks (steps of 1, 2 or 5 times a power of 10) from `lo` to `hi`. */
export function niceTicks(lo: number, hi: number): number[] {
  const raw = (hi - lo) / 4 || Math.abs(hi) || 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const near = (m: number) => Math.abs(Math.log(m * pow) - Math.log(raw));
  const step = [1, 2, 5, 10].reduce((a, b) => (near(b) < near(a) ? b : a)) * pow;
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + step * 1e-9; t += step) out.push(Number(t.toPrecision(12)));
  return out;
}

/** With one chart: the legend at the left, a large chart, and a table of its points at the right.
 * `highlight`: the id of a variant to show in sky; the other variants are faint. `heading`: with
 * more charts, at the left of the legend, and the charts have no border. */
export function SparsityCharts({
  jobs,
  variants,
  artifacts,
  xKey,
  l0,
  method,
  names = {},
  defs = [],
  highlight,
  heading,
}: {
  jobs: Job[];
  variants: VariantView[];
  /** The artifacts of one group. */
  artifacts: ArtifactPoint[];
  xKey: string;
  l0: number;
  method: string;
  /** Each subject's display name. */
  names?: Record<string, string>;
  defs?: MethodParam[];
  highlight?: string;
  heading?: string;
}) {
  const [hover, setHover] = useState<Hover>(null);
  const info: Info = { names, defs };
  const compared = variants.filter((v) => !v.baseline);
  const current = compared.find((v) => v.id === highlight);
  const charts = jobs
    .map((job) => {
      const key = valueKey(job.eval.slug, job.metric.key);
      const lines = compared
        .map((v, i) => ({
          method: v,
          color: current ? (v === current ? METHOD_COLORS[0] : FAINT) : METHOD_COLORS[i % METHOD_COLORS.length],
          faint: !!current && v !== current,
          points: series(artifacts, v.id, xKey, key),
        }))
        // The highlighted line is drawn last, so it is on top.
        .sort((a, b) => Number(!a.faint) - Number(!b.faint));
      const baselines = variants
        .filter((v) => v.baseline && !current)
        .flatMap((v) =>
          artifacts
            .filter((a) => a.variantId === v.id && a.values[key] != null)
            .map((a) => ({ method: v, value: a.values[key], artifact: a })),
        );
      return { job, lines, baselines };
    })
    .filter((c) => c.lines.some((l) => l.points.length));
  const chart = (c: (typeof charts)[number], size?: typeof SMALL) => (
    <Chart
      key={c.job.eval.slug}
      slug={c.job.eval.slug}
      title={jobLabel(c.job.eval)}
      unit={c.job.metric.displayName}
      lines={c.lines}
      baselines={c.baselines}
      l0={l0}
      method={method}
      size={size}
      boxed={charts.length > 1 && !heading}
      info={info}
      hover={hover?.chart === c.job.eval.slug ? hover : null}
      onHover={(id, at) => setHover(id ? { chart: c.job.eval.slug, id, at } : null)}
    />
  );

  if (charts.length === 1) {
    const c = charts[0]!;
    return (
      // By the panel's width, not the window's: the panel can be part of a row.
      <div className="@container">
        <div className="grid grid-cols-1 @xl:grid-cols-[10rem_minmax(0,1fr)] @xl:items-center @6xl:grid-cols-[10rem_minmax(0,1fr)_26rem] @6xl:items-stretch">
          <Legend
            variants={compared}
            current={current}
            className="flex-col gap-y-1.5 px-4 pt-3 @xl:pb-3 @6xl:self-center"
          />
          <div className="min-w-0 px-4 py-3 @xl:pl-0">{chart(c, LARGE)}</div>
          <div className="min-h-0 border-t border-slate-200 @xl:col-span-2 @6xl:col-span-1 @6xl:border-t-0 @6xl:border-l">
            <PointTable
              unit={c.job.metric.displayName}
              lines={c.lines}
              baselines={c.baselines}
              method={method}
              hover={hover?.chart === c.job.eval.slug ? hover.id : null}
              onHover={(id) => setHover(id ? { chart: c.job.eval.slug, id } : null)}
              className="max-h-[14.25rem]"
            />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={cn('flex flex-col', heading ? 'gap-4 px-6 py-5' : 'gap-3 px-4 py-3')}>
      {heading ? (
        <ChartsHead heading={heading}>
          <Legend variants={compared} current={current} className="flex-wrap justify-end gap-x-4 gap-y-1" />
        </ChartsHead>
      ) : (
        <Legend variants={compared} current={current} className="flex-wrap justify-center gap-x-4 gap-y-1" />
      )}
      <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4', heading ? 'gap-x-10 gap-y-6' : 'gap-3')}>
        {charts.map((c) => chart(c))}
      </div>
    </div>
  );
}

/** The head of a grid of charts: `heading` at the left, the legend (`children`) at the right. */
export function ChartsHead({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <p className={cn(INSET_TITLE, 'text-slate-400')}>{heading}</p>
      {children}
    </div>
  );
}

/** The color of each variant, and the baseline line. With `current`: it, then one item for the
 * other variants. `className`: the list's layout. */
function Legend({
  variants,
  current,
  className,
}: {
  variants: VariantView[];
  current?: VariantView;
  className: string;
}) {
  return (
    <ul className={cn('flex text-xs text-slate-600', className)}>
      {current ? (
        <>
          <li className="flex items-center gap-1.5">
            <Dot color={METHOD_COLORS[0]} />
            {current.displayName}
          </li>
          <li className="flex items-center gap-1.5">
            <span className="w-4 border-t" style={{ borderColor: FAINT }} />
            Other variants
          </li>
        </>
      ) : (
        variants.map((m, i) => (
          <li key={m.id} className="flex items-center gap-1.5">
            <Dot color={METHOD_COLORS[i % METHOD_COLORS.length]} />
            {m.displayName}
          </li>
        ))
      )}
      {!current && (
        <li className="flex items-center gap-1.5">
          <span className="w-4 border-t border-dashed border-slate-500" />
          Baseline (dense)
        </li>
      )}
    </ul>
  );
}

export const Dot = ({ color }: { color: string }) => (
  <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
);

/** Each point of one chart: its artifact, L0 and value, then the baselines. A hover on a row marks
 * its point; a click opens the artifact. */
function PointTable({
  unit,
  lines,
  baselines,
  method,
  hover,
  onHover,
  className,
}: {
  unit: string;
  lines: Line[];
  baselines: Baseline[];
  method: string;
  hover: string | null;
  onHover: (id: string | null) => void;
  className?: string;
}) {
  const rows = [
    ...lines.flatMap((l) =>
      l.points.map((p) => ({ color: l.color, variant: l.method, x: p.x, y: p.y, a: p.artifact })),
    ),
    ...baselines.map((b) => ({ color: null, variant: b.method, x: null, y: b.value, a: b.artifact })),
  ];
  return (
    <div className={cn('overflow-auto bg-white', className)}>
      <table className={cn(TABLE, 'text-xs')}>
        <thead className={cn(THEAD, 'sticky top-0 z-10')}>
          <tr>
            <th className="px-3 py-1.5 font-medium">Artifact</th>
            <th className="px-2 py-1.5 text-right font-medium">L0</th>
            <th className="px-3 py-1.5 text-right font-medium">{unit}</th>
          </tr>
        </thead>
        <tbody className="isolate divide-y divide-slate-100" onMouseLeave={() => onHover(null)}>
          {rows.map((r) => (
            <LinkRow
              key={r.a.id}
              href={artifactPath(method, r.a.id)}
              className={cn(ROW, r.a.id === hover && 'bg-sky-50')}
              onMouseEnter={() => onHover(r.variant.baseline ? null : r.a.id)}
            >
              <td className="max-w-0 px-3 py-1">
                <span className="flex items-center gap-1.5" title={r.a.displayName}>
                  {r.color ? (
                    <Dot color={r.color} />
                  ) : (
                    <span className="w-2.5 shrink-0 border-t border-dashed border-slate-500" />
                  )}
                  <span className="truncate">{r.a.displayName}</span>
                </span>
              </td>
              <td className="w-px px-2 py-1 text-right tabular-nums">{r.x != null ? formatValue(r.x) : '—'}</td>
              <td className="w-px px-3 py-1 text-right tabular-nums">{r.y.toFixed(3)}</td>
            </LinkRow>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** `size`: the drawing's units. A larger size keeps the text small in a wide chart. `hover`: the
 * point to mark, with its popover when the pointer is on it. `boxed`: a border, for a grid.
 * `slug`: the eval; its name links to it. */
function Chart({
  slug,
  title,
  unit,
  lines,
  baselines,
  l0,
  method,
  size = SMALL,
  boxed = true,
  info,
  hover,
  onHover,
}: {
  slug: string;
  title: string;
  unit: string;
  lines: Line[];
  baselines: Baseline[];
  l0: number;
  method: string;
  size?: { w: number; h: number };
  boxed?: boolean;
  info: Info;
  hover: Hover;
  onHover: OnHover;
}) {
  const { w: W, h: H } = size;
  const xs = lines.flatMap((l) => l.points.map((p) => p.x));
  const ys = [...lines.flatMap((l) => l.points.map((p) => p.y)), ...baselines.map((b) => b.value)];
  const [x0, x1] = [Math.log(Math.min(...xs, l0)), Math.log(Math.max(...xs, l0))];
  const [yMin, yMax] = [Math.min(...ys), Math.max(...ys)];
  const pad = (yMax - yMin) * 0.08 || Math.abs(yMax) * 0.1 || 0.1;
  const [y0, y1] = [yMin - pad, yMax + pad];
  const sx = (x: number) => PAD.left + ((Math.log(x) - x0) / (x1 - x0 || 1)) * (W - PAD.left - PAD.right);
  const sy = (y: number) => H - PAD.bottom - ((y - y0) / (y1 - y0)) * (H - PAD.top - PAD.bottom);
  const shown = lines.flatMap((l) => l.points.map((p) => ({ l, p }))).find(({ p }) => p.artifact.id === hover?.id);
  const enter = (id: string) => (ev: { currentTarget: Element }) =>
    onHover(id, ev.currentTarget.getBoundingClientRect());

  return (
    <figure className={cn('bg-white', boxed && 'rounded-md border border-slate-200 p-2')}>
      <figcaption className="px-1 text-xs">
        <EvalLink slug={slug} className="font-medium text-sky-800 hover:underline">
          {title}
        </EvalLink>
        <span className="text-slate-500"> · {unit}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${title} by L0`}>
        {niceTicks(y0, y1).map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={sy(t)} y2={sy(t)} stroke="#f1f5f9" />
            <text x={PAD.left - 4} y={sy(t) + 3} textAnchor="end" className="fill-slate-400 text-[9px]">
              {Number(t.toPrecision(3))}
            </text>
          </g>
        ))}
        {X_TICKS.filter((t) => Math.log(t) >= x0 - 0.01 && Math.log(t) <= x1 + 0.01).map((t) => (
          <text key={t} x={sx(t)} y={H - 8} textAnchor="middle" className="fill-slate-400 text-[9px]">
            {t}
          </text>
        ))}
        <text x={W - PAD.right} y={H - 0.5} textAnchor="end" className="fill-slate-400 text-[9px]">
          L0
        </text>
        <line x1={sx(l0)} x2={sx(l0)} y1={PAD.top} y2={H - PAD.bottom} stroke="#94a3b8" strokeDasharray="2 3" />
        {baselines.map((b, i) => (
          <g key={b.method.id}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={sy(b.value)}
              y2={sy(b.value)}
              stroke="#64748b"
              strokeDasharray="5 3"
            />
            {/* Labels go right and left in turn, so close baselines do not overlap. */}
            <text
              x={i % 2 ? PAD.left + 2 : W - PAD.right}
              y={sy(b.value) - 3}
              textAnchor={i % 2 ? 'start' : 'end'}
              className="fill-slate-500 text-[9px]"
            >
              {b.method.displayName}
              <title>{`${b.method.displayName}: ${formatValue(b.value)}`}</title>
            </text>
          </g>
        ))}
        {lines.map((l) => (
          <g key={l.method.id}>
            <polyline
              points={l.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')}
              fill="none"
              stroke={l.color}
              strokeWidth={l.faint ? 1 : 1.5}
            />
            {l.points.map((p) => (
              <a
                key={p.artifact.id}
                href={artifactPath(method, p.artifact.id)}
                aria-label={p.artifact.displayName}
                onMouseEnter={enter(p.artifact.id)}
                onMouseLeave={() => onHover(null)}
                onFocus={enter(p.artifact.id)}
                onBlur={() => onHover(null)}
              >
                <circle
                  cx={sx(p.x)}
                  cy={sy(p.y)}
                  r={hover?.id === p.artifact.id ? 5 : l.faint ? 2 : 3}
                  fill={l.color}
                  stroke="white"
                />
                {/* A larger target than the dot. */}
                <circle cx={sx(p.x)} cy={sy(p.y)} r={8} fill="transparent" />
              </a>
            ))}
          </g>
        ))}
      </svg>
      {shown && hover?.at && (
        <PointCard
          point={shown.p}
          variant={shown.l.method}
          color={shown.l.color}
          unit={unit}
          info={info}
          at={hover.at}
        />
      )}
    </figure>
  );
}

/** The popover of an artifact's point. */
function PointCard({
  point: { x, y, artifact: a },
  variant,
  color,
  unit,
  info,
  at,
}: {
  point: Point;
  variant: VariantView;
  color: string;
  unit: string;
  info: Info;
  at: DOMRect;
}) {
  const params = info.defs.filter((d) => a.params[d.key] !== undefined);
  return (
    <PointPopover
      at={at}
      color={color}
      title={variant.displayName}
      sub={a.displayName}
      rows={[
        { label: 'L0', value: formatValue(x) },
        { label: unit, value: y.toFixed(3), strong: true },
        { label: 'Model', value: info.names[a.subject] ?? a.subject },
        ...(a.sites.length ? [{ label: 'Site', value: siteLabel(a.sites) }] : []),
        ...params.map((d) => ({ label: d.label, value: paramText(d, a.params[d.key]) })),
      ]}
      link
    />
  );
}

const CARD_W = 240;
const CARD_H = 240;

/** The popover of a point, on the page's top layer, so a panel's edge does not cut it. It is above
 * the dot, or below it near the top of the window, and inside the window. `at`: the dot. `link`: a
 * click on the point opens it. */
export function PointPopover({
  at,
  color,
  title,
  sub,
  rows,
  link,
}: {
  at: DOMRect;
  color: string;
  title: string;
  sub?: string;
  rows: { label: string; value: string; strong?: boolean }[];
  link?: boolean;
}) {
  const mid = at.left + at.width / 2;
  const left = Math.min(Math.max(mid - CARD_W / 2, 8), window.innerWidth - CARD_W - 8);
  const above = at.top > CARD_H + 16;
  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 rounded-md border border-slate-200 bg-white p-2.5 text-xs shadow-lg"
      style={{
        width: CARD_W,
        left,
        ...(above ? { bottom: window.innerHeight - at.top + 6 } : { top: at.bottom + 6 }),
      }}
    >
      <p className="flex items-center gap-1.5 font-semibold text-slate-800">
        <Dot color={color} />
        {title}
      </p>
      {sub && <p className="mt-0.5 text-slate-600">{sub}</p>}
      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[11px]">
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <dt className="text-slate-500">{r.label}</dt>
            <dd className={cn('truncate text-slate-800 tabular-nums', r.strong && 'font-semibold')}>{r.value}</dd>
          </div>
        ))}
      </dl>
      {link && <p className="mt-2 text-[10px] text-slate-400">Click to open it.</p>}
    </div>,
    document.body,
  );
}
