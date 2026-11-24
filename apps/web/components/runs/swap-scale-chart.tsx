'use client';

import { METHOD_COLORS } from '@/components/methods/sparsity-charts';
import type { SwapCurve, SwapCurves, SwapKind } from '@/lib/server/probe-swap';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const W = 320;
const H = 190;
const PAD = { left: 30, right: 44, top: 10, bottom: 26 };
const AXIS = 'text-[8.5px]';
/** The bands of the two controls: the lowest to the highest lens at each scale. */
const BANDS: { kind: Exclude<SwapKind, 'main'>; label: string; fill: string; text: string }[] = [
  { kind: 'answer', label: 'Ceiling', fill: 'fill-emerald-100', text: 'fill-emerald-700' },
  { kind: 'random', label: 'Chance', fill: 'fill-rose-100', text: 'fill-rose-700' },
];

const pct = (v: number | null | undefined) => (v == null ? '–' : `${Math.round(v * 100)}%`);

/**
 * Swap top-1 against the scale on one model, one line for each lens. The bands are the two
 * controls: the answer swap (the ceiling) and the random swap (chance). Hover or a click on a lens
 * shows its own controls as dashed lines.
 */
export function SwapScaleChart({ data }: { data: SwapCurves }) {
  const { scales, curves } = data;
  const [hover, setHover] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [at, setAt] = useState<number | null>(null);
  const shown = hover ?? picked;
  const x = (i: number) => PAD.left + (i / Math.max(1, scales.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - v) * (H - PAD.top - PAD.bottom);
  const points = (line: (number | null)[]) => line.flatMap((v, i) => (v == null ? [] : [`${x(i)},${y(v)}`])).join(' ');
  const band = (kind: SwapKind) => {
    const lo = scales.map((_, i) => Math.min(...curves.map((c) => c[kind][i] ?? 1)));
    const hi = scales.map((_, i) => Math.max(...curves.map((c) => c[kind][i] ?? 0)));
    const under = lo.map((v, i) => `${x(i)},${y(v)}`).reverse();
    return { lo, hi, path: `${points(hi)} ${under.join(' ')}` };
  };
  const color = (i: number) => METHOD_COLORS[i % METHOD_COLORS.length]!;
  const best = (c: SwapCurve) => c.main.reduce<number>((b, v, i) => ((v ?? -1) > (c.main[b] ?? -1) ? i : b), 0);
  return (
    <figure className="flex flex-col gap-1.5">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full text-[10px]" role="img" aria-label="Swap top-1 by scale">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-slate-100" />
            <text x={PAD.left - 5} y={y(t) + 3} textAnchor="end" className={cn(AXIS, 'fill-slate-400')}>
              {pct(t)}
            </text>
          </g>
        ))}
        {BANDS.map((b) => {
          const { hi, lo, path } = band(b.kind);
          const last = scales.length - 1;
          return (
            <g key={b.kind}>
              <polygon points={path} className={cn(b.fill, 'opacity-70')} />
              <text x={W - PAD.right + 4} y={y((hi[last]! + lo[last]!) / 2) + 3} className={cn(AXIS, b.text)}>
                {b.label}
              </text>
            </g>
          );
        })}
        {scales.map((s, i) => (
          <text key={s} x={x(i)} y={H - PAD.bottom + 13} textAnchor="middle" className={cn(AXIS, 'fill-slate-500')}>
            ×{s}
          </text>
        ))}
        <text x={W - PAD.right} y={H - 2} textAnchor="end" className={cn(AXIS, 'fill-slate-400')}>
          scale
        </text>
        {at != null && <line x1={x(at)} x2={x(at)} y1={PAD.top} y2={H - PAD.bottom} className="stroke-slate-300" />}
        {curves.map((c, i) => {
          const faded = shown != null && shown !== i;
          return (
            <g key={c.variant.id} opacity={faded ? 0.2 : 1}>
              {shown === i &&
                BANDS.map((b) => (
                  <polyline
                    key={b.kind}
                    points={points(c[b.kind])}
                    fill="none"
                    stroke={color(i)}
                    strokeWidth={1}
                    strokeDasharray={b.kind === 'answer' ? '4 3' : '1.5 2.5'}
                  />
                ))}
              <polyline points={points(c.main)} fill="none" stroke={color(i)} strokeWidth={1.75} />
              {c.main.map((v, j) =>
                v == null ? null : (
                  <circle
                    key={j}
                    cx={x(j)}
                    cy={y(v)}
                    r={j === best(c) ? 3.5 : 2}
                    fill={j === best(c) ? 'white' : color(i)}
                    stroke={color(i)}
                    strokeWidth={j === best(c) ? 1.75 : 0}
                  />
                ),
              )}
            </g>
          );
        })}
        {scales.map((s, i) => (
          <rect
            key={s}
            x={x(i) - (W - PAD.left - PAD.right) / (2 * Math.max(1, scales.length - 1))}
            y={PAD.top}
            width={(W - PAD.left - PAD.right) / Math.max(1, scales.length - 1)}
            height={H - PAD.top - PAD.bottom}
            fill="transparent"
            onMouseEnter={() => setAt(i)}
            onMouseLeave={() => setAt(null)}
          />
        ))}
      </svg>
      <figcaption className="flex flex-col gap-0.5 text-[11px] text-slate-600">
        {curves.map((c, i) => (
          <button
            key={c.variant.id}
            type="button"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={() => setPicked(picked === i ? null : i)}
            aria-pressed={picked === i}
            className={cn(
              'flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-slate-50',
              picked === i && 'bg-slate-100',
            )}
          >
            <span className="h-0.5 w-3.5 shrink-0 rounded" style={{ background: color(i) }} />
            <span className="min-w-0 flex-1 truncate">{c.variant.displayName}</span>
            <span className="font-mono text-slate-800 tabular-nums">{pct(c.main[at ?? best(c)])}</span>
            {/* As wide as "100% Ceiling 100% Chance", so the row does not move on hover. */}
            <span className="flex w-40 shrink-0 justify-end gap-x-2 font-mono text-[10px] whitespace-nowrap text-slate-400 tabular-nums">
              {at == null ? (
                `at ×${scales[best(c)]}`
              ) : (
                <>
                  <span className="text-emerald-700">{pct(c.answer[at])} Ceiling</span>
                  <span className="text-rose-700">{pct(c.random[at])} Chance</span>
                </>
              )}
            </span>
          </button>
        ))}
      </figcaption>
    </figure>
  );
}
