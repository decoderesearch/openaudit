'use client';

import {
  ChartsHead,
  Dot,
  FAINT,
  METHOD_COLORS,
  niceTicks,
  PAD,
  PointPopover,
  SMALL,
} from '@/components/methods/sparsity-charts';
import { artifactPath, formatValue, type SeedChart, type SeedSeries } from '@/lib/methods';
import { cn } from '@/lib/utils';
import { useState } from 'react';

// One small chart for each metric of one variant on one eval: the mean over seeds by a param (as
// the target L0), with the range of the seeds and each seed. Other variants are faint lines. The
// style and the hover are as in `SparsityCharts`.

const COLOR = METHOD_COLORS[0];

/** The point to mark: its chart (a metric key), its id, and the dot on the screen. */
type Hover = { chart: string; id: string; at: DOMRect } | null;

/** `heading`: at the left of the legend; the charts have no border, four in a row. */
export function SeedCharts({
  charts,
  xLabel,
  method,
  heading,
}: {
  charts: SeedChart[];
  xLabel: string;
  method: string;
  heading?: string;
}) {
  const [hover, setHover] = useState<Hover>(null);
  const name = charts[0]?.current.name;
  const legend = (
    <ul
      className={cn(
        'flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600',
        heading ? 'justify-end' : 'justify-center',
      )}
    >
      <li className="flex items-center gap-1.5">
        <Dot color={COLOR} />
        {name}: mean
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-4 rounded-sm bg-sky-100" />
        Seed range
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-sky-400" />
        One seed
      </li>
      <li className="flex items-center gap-1.5">
        <span className="w-4 border-t" style={{ borderColor: FAINT }} />
        Other variants
      </li>
    </ul>
  );
  return (
    <div className={cn('flex flex-col', heading ? 'gap-4 px-6 py-5' : 'gap-3 px-4 py-3')}>
      {heading ? <ChartsHead heading={heading}>{legend}</ChartsHead> : legend}
      <div
        className={cn(
          'grid grid-cols-1 sm:grid-cols-2',
          heading ? 'gap-x-10 gap-y-6 lg:grid-cols-4' : 'gap-3 lg:grid-cols-3',
        )}
      >
        {charts.map((c) => (
          <Chart
            key={c.key}
            chart={c}
            xLabel={xLabel}
            method={method}
            boxed={!heading}
            hover={hover?.chart === c.key ? hover : null}
            onHover={(id, at) => setHover(id && at ? { chart: c.key, id, at } : null)}
          />
        ))}
      </div>
    </div>
  );
}

function Chart({
  chart: c,
  xLabel,
  method,
  boxed,
  hover,
  onHover,
}: {
  chart: SeedChart;
  xLabel: string;
  method: string;
  boxed: boolean;
  hover: Hover;
  onHover: (id: string | null, at?: DOMRect) => void;
}) {
  const { w: W, h: H } = SMALL;
  const all = [...c.current.points, ...c.others.flatMap((o) => o.points), ...c.seeds];
  const xs = [...new Set(all.map((p) => p.x))].sort((a, b) => a - b);
  const ys = all.map((p) => p.y);
  const [x0, x1] = [xs[0] ?? 0, xs.at(-1) ?? 1];
  const [yMin, yMax] = [Math.min(...ys), Math.max(...ys)];
  const pad = (yMax - yMin) * 0.08 || Math.abs(yMax) * 0.1 || 0.1;
  const [y0, y1] = [yMin - pad, yMax + pad];
  const sx = (x: number) => PAD.left + ((x - x0) / (x1 - x0 || 1)) * (W - PAD.left - PAD.right);
  const sy = (y: number) => H - PAD.bottom - ((y - y0) / (y1 - y0)) * (H - PAD.top - PAD.bottom);
  const line = (s: SeedSeries) => s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ');
  const band = xs.flatMap((x) => {
    const at = c.seeds.filter((s) => s.x === x).map((s) => s.y);
    return at.length ? [{ x, lo: Math.min(...at), hi: Math.max(...at) }] : [];
  });
  const area = [
    ...band.map((b) => `${sx(b.x)},${sy(b.hi)}`),
    ...band.toReversed().map((b) => `${sx(b.x)},${sy(b.lo)}`),
  ];
  const enter = (id: string) => (ev: { currentTarget: Element }) =>
    onHover(id, ev.currentTarget.getBoundingClientRect());
  const leave = () => onHover(null);
  const seedsAt = (x: number) => c.seeds.filter((s) => s.x === x).length;
  /** A dot with a larger target (`hit`) than the dot, as in `SparsityCharts`. */
  const dot = (id: string, x: number, y: number, color: string, r: number, hit = 6) => (
    <g key={id} onMouseEnter={enter(id)} onMouseLeave={leave}>
      <circle cx={sx(x)} cy={sy(y)} r={hover?.id === id ? 5 : r} fill={color} stroke="white" />
      <circle cx={sx(x)} cy={sy(y)} r={hit} fill="transparent" />
    </g>
  );
  const xText = (x: number) => (Number.isInteger(x) ? String(x) : formatValue(x));
  const card = (() => {
    if (!hover) return null;
    const mean = c.current.points.find((p) => `mean-${p.x}` === hover.id);
    if (mean)
      return (
        <PointPopover
          at={hover.at}
          color={COLOR}
          title={c.current.name}
          sub={`Mean over ${seedsAt(mean.x)} seeds`}
          rows={[
            { label: xLabel, value: xText(mean.x) },
            { label: c.title, value: formatValue(mean.y), strong: true },
          ]}
        />
      );
    const seed = c.seeds.find((s) => s.id === hover.id);
    if (seed)
      return (
        <PointPopover
          at={hover.at}
          color={COLOR}
          title={c.current.name}
          sub={`Seed ${seed.seed}`}
          rows={[
            { label: xLabel, value: xText(seed.x) },
            { label: c.title, value: formatValue(seed.y), strong: true },
          ]}
          link
        />
      );
    for (const o of c.others) {
      const p = o.points.find((q) => `${o.id}-${q.x}` === hover.id);
      if (p)
        return (
          <PointPopover
            at={hover.at}
            color={FAINT}
            title={o.name}
            sub="Mean over its seeds"
            rows={[
              { label: xLabel, value: xText(p.x) },
              { label: c.title, value: formatValue(p.y), strong: true },
            ]}
          />
        );
    }
    return null;
  })();

  return (
    <figure className={cn('bg-white', boxed && 'rounded-md border border-slate-200 p-2')}>
      <figcaption className="px-1 text-xs" title={c.description}>
        <span className="font-medium text-slate-800">{c.title}</span>
        {c.better && <span className="text-slate-500"> · {c.better}</span>}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${c.title} by ${xLabel}`}>
        {niceTicks(y0, y1).map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={sy(t)} y2={sy(t)} stroke="#f1f5f9" />
            <text x={PAD.left - 4} y={sy(t) + 3} textAnchor="end" className="fill-slate-400 text-[9px]">
              {Number(t.toPrecision(3))}
            </text>
          </g>
        ))}
        {xs.map((x) => (
          <text key={x} x={sx(x)} y={H - 8} textAnchor="middle" className="fill-slate-400 text-[9px]">
            {x}
          </text>
        ))}
        <text x={W - PAD.right} y={H - 0.5} textAnchor="end" className="fill-slate-400 text-[9px]">
          {xLabel}
        </text>
        {c.others.map((o) => (
          <g key={o.id}>
            <polyline points={line(o)} fill="none" stroke={FAINT} strokeWidth={1} />
            {o.points.map((p) => dot(`${o.id}-${p.x}`, p.x, p.y, FAINT, 2))}
          </g>
        ))}
        {band.length > 1 && <polygon points={area.join(' ')} fill="#e0f2fe" fillOpacity={0.8} />}
        <polyline points={line(c.current)} fill="none" stroke={COLOR} strokeWidth={1.5} />
        {c.seeds.map((s) => (
          <a
            key={s.id}
            href={artifactPath(method, s.id)}
            aria-label={`Seed ${s.seed} at ${xLabel} ${s.x}`}
            onMouseEnter={enter(s.id)}
            onMouseLeave={leave}
            onFocus={enter(s.id)}
            onBlur={leave}
          >
            <circle cx={sx(s.x)} cy={sy(s.y)} r={hover?.id === s.id ? 3.5 : 1.75} className="fill-sky-400" />
            <circle cx={sx(s.x)} cy={sy(s.y)} r={3} fill="transparent" />
          </a>
        ))}
        {/* Above the seeds, so the mean is easy to hover. */}
        {c.current.points.map((p) => dot(`mean-${p.x}`, p.x, p.y, COLOR, 3, 4))}
      </svg>
      {card}
    </figure>
  );
}
