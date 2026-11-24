'use client';

import { ChartsHead, Dot, FAINT, METHOD_COLORS, niceTicks, PointPopover } from '@/components/methods/sparsity-charts';
import type { SubjectLink } from '@/components/methods/subject-board';
import { formatValue, type BoardRow, type BoardVariant } from '@/lib/methods';
import { useEffect, useRef, useState } from 'react';

const COLOR = METHOD_COLORS[0];
/** The height in pixels. The width is the box's, so the text does not scale. */
const H = 320;
const PAD = { left: 44, right: 12, top: 10, bottom: 40 };

type Point = { x: number; y: number; subject: string };
type Hover = { id: string; at: DOMRect } | null;

/** The least-squares line through the points, at the lowest and highest x. Null with fewer than
 * three points or one x. */
function trend(points: Point[]): [Point, Point] | null {
  if (points.length < 3) return null;
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  const sxx = points.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  if (!sxx) return null;
  const slope = points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / sxx;
  const xs = points.map((p) => p.x);
  const at = (x: number) => ({ x, y: my + slope * (x - mx), subject: '' });
  return [at(Math.min(...xs)), at(Math.max(...xs))];
}

/**
 * One wide chart of each variant's value by the subject models' `order` value (as the AA index).
 * Variant `current` is in sky, with its trend line; the other variants are faint. A hover on a
 * dot shows the model and its value. A click on a dot of `current` opens the model's run.
 */
export function OrderChart({
  rows,
  variants,
  current,
  xLabel,
  yLabel,
  better,
  subjects,
  heading,
}: {
  rows: BoardRow[];
  variants: BoardVariant[];
  current: string;
  xLabel: string;
  yLabel: string;
  /** For example "Higher is better". */
  better?: string;
  subjects: Record<string, SubjectLink>;
  heading: string;
}) {
  const [hover, setHover] = useState<Hover>(null);
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([e]) => setW(Math.max(320, Math.round(e!.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const series = variants
    .filter((v) => !v.baseline)
    .map((v) => ({
      variant: v,
      points: rows.flatMap((r) => {
        const cell = r.cells.get(v.id);
        return r.order != null && cell ? [{ x: r.order, y: cell.value, subject: r.subject }] : [];
      }),
    }))
    .filter((s) => s.points.length);
  const mine = series.find((s) => s.variant.id === current);
  if (!mine) return null;
  const others = series.filter((s) => s !== mine);
  const all = series.flatMap((s) => s.points);
  const [xMin, xMax] = [Math.min(...all.map((p) => p.x)), Math.max(...all.map((p) => p.x))];
  const [yMin, yMax] = [Math.min(...all.map((p) => p.y)), Math.max(...all.map((p) => p.y))];
  const xPad = (xMax - xMin) * 0.03 || 1;
  const yPad = (yMax - yMin) * 0.08 || Math.abs(yMax) * 0.1 || 0.1;
  const [x0, x1, y0, y1] = [xMin - xPad, xMax + xPad, yMin - yPad, yMax + yPad];
  const sx = (x: number) => PAD.left + ((x - x0) / (x1 - x0)) * (W - PAD.left - PAD.right);
  const sy = (y: number) => H - PAD.bottom - ((y - y0) / (y1 - y0)) * (H - PAD.top - PAD.bottom);
  const label = (s: string) => subjects[s]?.label ?? s;
  const enter = (id: string) => (ev: { currentTarget: Element }) =>
    setHover({ id, at: ev.currentTarget.getBoundingClientRect() });
  const leave = () => setHover(null);
  const line = (t: [Point, Point] | null, color: string, width: number) =>
    t && <line x1={sx(t[0].x)} y1={sy(t[0].y)} x2={sx(t[1].x)} y2={sy(t[1].y)} stroke={color} strokeWidth={width} />;
  const card = (() => {
    if (!hover) return null;
    for (const s of series) {
      const p = s.points.find((q) => `${s.variant.id}/${q.subject}` === hover.id);
      if (!p) continue;
      const own = s === mine;
      return (
        <PointPopover
          at={hover.at}
          color={own ? COLOR : FAINT}
          title={s.variant.displayName}
          sub={label(p.subject)}
          rows={[
            { label: xLabel, value: formatValue(p.x) },
            { label: yLabel, value: formatValue(p.y), strong: true },
          ]}
          link={own && !!subjects[p.subject]?.href}
        />
      );
    }
    return null;
  })();

  return (
    <div className="flex flex-col gap-4 px-6 py-5">
      <ChartsHead heading={heading}>
        <ul className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs text-slate-600">
          <li className="flex items-center gap-1.5">
            <Dot color={COLOR} />
            {mine.variant.displayName}: each model
          </li>
          <li className="flex items-center gap-1.5">
            <span className="w-4 border-t-[1.5px]" style={{ borderColor: COLOR }} />
            Trend
          </li>
          <li className="flex items-center gap-1.5">
            <span className="w-4 border-t" style={{ borderColor: FAINT }} />
            Other variants
          </li>
        </ul>
      </ChartsHead>
      <figure>
        <figcaption className="px-1 text-sm">
          <span className="font-medium text-slate-800">{yLabel}</span>
          {better && <span className="text-slate-500"> · {better}</span>}
        </figcaption>
        <div ref={box}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            height={H}
            className="block w-full"
            role="img"
            aria-label={`${yLabel} by ${xLabel}`}
          >
            {niceTicks(y0, y1).map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={sy(t)} y2={sy(t)} stroke="#f1f5f9" />
                <text x={PAD.left - 6} y={sy(t) + 4} textAnchor="end" className="fill-slate-500 text-xs">
                  {Number(t.toPrecision(3))}
                </text>
              </g>
            ))}
            {niceTicks(x0, x1).map((t) => (
              <text key={t} x={sx(t)} y={H - PAD.bottom + 16} textAnchor="middle" className="fill-slate-500 text-xs">
                {Number(t.toPrecision(3))}
              </text>
            ))}
            <text x={W - PAD.right} y={H - 4} textAnchor="end" className="fill-slate-500 text-xs font-medium">
              {xLabel}
            </text>
            {others.map((s) => (
              <g key={s.variant.id}>
                {line(trend(s.points), FAINT, 1)}
                {s.points.map((p) => {
                  const id = `${s.variant.id}/${p.subject}`;
                  return (
                    <g key={id} onMouseEnter={enter(id)} onMouseLeave={leave}>
                      <circle cx={sx(p.x)} cy={sy(p.y)} r={hover?.id === id ? 4 : 2} fill={FAINT} />
                      <circle cx={sx(p.x)} cy={sy(p.y)} r={4} fill="transparent" />
                    </g>
                  );
                })}
              </g>
            ))}
            {line(trend(mine.points), COLOR, 1.5)}
            {mine.points.map((p) => {
              const id = `${mine.variant.id}/${p.subject}`;
              const href = subjects[p.subject]?.href;
              const dot = (
                <>
                  <circle cx={sx(p.x)} cy={sy(p.y)} r={hover?.id === id ? 5 : 3} fill={COLOR} stroke="white" />
                  <circle cx={sx(p.x)} cy={sy(p.y)} r={6} fill="transparent" />
                </>
              );
              return href ? (
                <a
                  key={id}
                  href={href}
                  aria-label={`${label(p.subject)}: ${formatValue(p.y)}`}
                  onMouseEnter={enter(id)}
                  onMouseLeave={leave}
                  onFocus={enter(id)}
                  onBlur={leave}
                >
                  {dot}
                </a>
              ) : (
                <g key={id} onMouseEnter={enter(id)} onMouseLeave={leave}>
                  {dot}
                </g>
              );
            })}
          </svg>
        </div>
        {card}
      </figure>
    </div>
  );
}
