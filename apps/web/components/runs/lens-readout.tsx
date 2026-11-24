'use client';

import { Section } from '@/components/catalog/parts';
import { METHOD_COLORS } from '@/components/methods/sparsity-charts';
import { bestRanks, tokenText, type LensRead, type LensReadout, type ReadoutFacts } from '@/lib/runs/lens-readout';
import { cn } from '@/lib/utils';
import { useState, type MouseEvent } from 'react';

const W = 640;
const H = 230;
const PAD = { left: 44, right: 12, top: 10, bottom: 28 };
/** The axis labels and numbers. */
const AXIS = 'text-[8.5px]';

type Lens = { key: string; name: string; color: string; read: LensRead };

/**
 * A workspace lens readout of one sample: for one hidden token, its rank at each layer for each
 * lens. `names`: the display name of each lens key, in the order to show them.
 */
export function LensReadoutView({
  readout,
  facts,
  names,
}: {
  readout: LensReadout;
  facts: ReadoutFacts;
  names: Record<string, string>;
}) {
  const order = [...Object.keys(names), ...Object.keys(readout.lenses)];
  const lenses: Lens[] = [...new Set(order)]
    .filter((key) => readout.lenses[key])
    .map((key, i) => ({
      key,
      name: names[key] ?? key,
      color: METHOD_COLORS[i % METHOD_COLORS.length]!,
      read: readout.lenses[key]!,
    }));
  const hidden = Object.keys(lenses[0]!.read.ranks);
  const [token, setToken] = useState(hidden[0]);
  const [layer, setLayer] = useState<number | null>(null);
  return (
    <Section
      title="Lens Readout"
      info={
        <>
          Each lens reads the model&apos;s residual stream at the last prompt token and gives a rank to each token at
          each layer (1 is the top). The score finds a hidden token when its rank is {readout.k} or better at one of the
          readout layers ({readout.readoutLayers.join(', ')}).
          {readout.readoutFilter && ' The ranks skip tokens with no meaning, such as spaces and punctuation.'}
        </>
      }
    >
      <Facts facts={facts} />
      {(hidden.length > 0 || facts.readoutToken != null) && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-xs">
          <span className="flex flex-wrap items-center gap-1.5">
            {hidden.length > 0 && (
              <span className="text-slate-500">
                {hidden.length > 1 ? 'Expected / Target Tokens' : 'Expected / Target Token'}
              </span>
            )}
            {hidden.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setToken(t)}
                className={cn(
                  'rounded border px-1.5 py-0.5 font-mono',
                  t === token
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                )}
              >
                {t}
              </button>
            ))}
          </span>
          {facts.readoutToken != null && (
            <span className="text-slate-500">
              Read at last prompt token <Chip text={facts.readoutToken} />
            </span>
          )}
        </div>
      )}
      {token && <RankChart readout={readout} lenses={lenses} token={token} layer={layer} onLayer={setLayer} />}
    </Section>
  );
}

function Facts({ facts }: { facts: ReadoutFacts }) {
  if (!facts.notScored && !facts.droppedTokens?.length) return null;
  return (
    <div className="flex flex-col gap-1.5 text-xs text-slate-600">
      {facts.notScored && <p className="text-amber-800">{facts.notScored}</p>}
      {facts.droppedTokens && facts.droppedTokens.length > 0 && (
        <p>The score does not use these hidden tokens, as they are not one token: {facts.droppedTokens.join(', ')}.</p>
      )}
    </div>
  );
}

function Chip({ text, className }: { text: string; className?: string }) {
  return (
    <span
      title={JSON.stringify(text)}
      className={cn(
        'inline-block max-w-[16ch] truncate rounded bg-slate-100 px-1 py-px align-bottom font-mono text-[11px] text-slate-700',
        className,
      )}
    >
      {tokenText(text)}
    </span>
  );
}

/** Each lens's rank of the token at each layer, on a log axis. A click on a layer selects it. */
function RankChart({
  readout,
  lenses,
  token,
  layer,
  onLayer,
}: {
  readout: LensReadout;
  lenses: Lens[];
  token: string;
  layer: number | null;
  onLayer: (layer: number | null) => void;
}) {
  const { layers, readoutLayers, k } = readout;
  const [hover, setHover] = useState<number | null>(null);
  const ranks = lenses.map((l) => l.read.ranks[token] ?? []);
  const worst = Math.max(1000, ...ranks.flat());
  const top = 10 ** Math.ceil(Math.log10(worst));
  const x = (l: number) =>
    PAD.left + ((l - layers[0]!) / Math.max(1, layers.at(-1)! - layers[0]!)) * (W - PAD.left - PAD.right);
  const y = (r: number) => PAD.top + (Math.log10(Math.max(1, r)) / Math.log10(top)) * (H - PAD.top - PAD.bottom);
  const ticks = Array.from({ length: Math.log10(top) + 1 }, (_, i) => 10 ** i);
  const shown = hover ?? layer;
  const nearest = (e: MouseEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const at = ((e.clientX - box.left) / box.width) * (W - PAD.left - PAD.right) + PAD.left;
    return layers.reduce((b, l) => (Math.abs(x(l) - at) < Math.abs(x(b) - at) ? l : b), layers[0]!);
  };
  const best = lenses.map((l) => bestRanks(l.read, layers, layers)[token]);
  return (
    <figure className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full text-[10px]" role="img" aria-label={`Rank of ${token}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-slate-100" />
            <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" className={cn(AXIS, 'fill-slate-400')}>
              {t >= 1e6 ? `${t / 1e6}M` : t >= 1000 ? `${t / 1000}k` : t}
            </text>
          </g>
        ))}
        {readoutLayers.map((l) => (
          <g key={l}>
            <line
              x1={x(l)}
              x2={x(l)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              className="stroke-slate-200"
              strokeDasharray="2 3"
            />
            <text x={x(l)} y={H - PAD.bottom + 14} textAnchor="middle" className={cn(AXIS, 'fill-slate-500')}>
              {l}
            </text>
          </g>
        ))}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(k)}
          y2={y(k)}
          className="stroke-emerald-500"
          strokeDasharray="4 3"
        />
        <text
          x={8}
          y={PAD.top + (H - PAD.top - PAD.bottom) / 2}
          transform={`rotate(-90 8 ${PAD.top + (H - PAD.top - PAD.bottom) / 2})`}
          textAnchor="middle"
          className={cn(AXIS, 'fill-slate-400')}
        >
          rank
        </text>
        <text x={W - PAD.right} y={H - 2} textAnchor="end" className={cn(AXIS, 'fill-slate-400')}>
          layer
        </text>
        {shown != null && (
          <line x1={x(shown)} x2={x(shown)} y1={PAD.top} y2={H - PAD.bottom} className="stroke-slate-400" />
        )}
        {lenses.map((l, i) => (
          <g key={l.key}>
            <polyline
              points={ranks[i]!.map((r, j) => `${x(layers[j]!)},${y(r)}`).join(' ')}
              fill="none"
              stroke={l.color}
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
            {readoutLayers.map((rl) => {
              const j = layers.indexOf(rl);
              return j < 0 ? null : <circle key={rl} cx={x(rl)} cy={y(ranks[i]![j]!)} r={2.5} fill={l.color} />;
            })}
          </g>
        ))}
        <text
          x={W - PAD.right - 2}
          y={y(k) - 4}
          textAnchor="end"
          stroke="white"
          strokeWidth={3}
          paintOrder="stroke"
          className="fill-emerald-700"
        >
          Pass Threshold - Recall@{k}
        </text>
        <rect
          x={PAD.left}
          y={PAD.top}
          width={W - PAD.left - PAD.right}
          height={H - PAD.top - PAD.bottom}
          fill="transparent"
          className="cursor-crosshair"
          onMouseMove={(e) => setHover(nearest(e))}
          onMouseLeave={() => setHover(null)}
          onClick={(e) => {
            const l = nearest(e);
            onLayer(l === layer ? null : l);
          }}
        />
      </svg>
      <figcaption
        className="grid items-center gap-x-4 gap-y-1 text-xs text-slate-600"
        style={{ gridTemplateColumns: `auto repeat(${lenses.length}, minmax(0, 1fr))` }}
      >
        {/* The longer text keeps the column width when the text changes. */}
        <span className="grid text-slate-400">
          <span className="invisible col-start-1 row-start-1">Max Rank on All Layers</span>
          <span className="col-start-1 row-start-1">
            {shown != null ? `Rank at Layer ${shown}` : 'Max Rank on All Layers'}
          </span>
        </span>
        {lenses.map((l, i) => {
          const at = shown != null ? ranks[i]![layers.indexOf(shown)] : undefined;
          const rank = at ?? best[i]?.rank;
          return (
            <span key={l.key} className="flex min-w-0 flex-wrap items-center justify-center gap-x-1.5">
              <span className="h-0.5 w-3.5 shrink-0 rounded" style={{ background: l.color }} />
              {l.name}
              <span className={cn('font-mono', rank != null && rank <= k ? 'text-emerald-700' : 'text-slate-400')}>
                {rank != null ? `#${rank.toLocaleString()}` : '–'}
              </span>
            </span>
          );
        })}
      </figcaption>
    </figure>
  );
}
