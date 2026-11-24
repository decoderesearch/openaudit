'use client';

import { Section } from '@/components/catalog/parts';
import { CodeText } from '@/components/runs/code-text';
import { PassMark } from '@/components/runs/pass-mark';
import { tokenText } from '@/lib/runs/lens-readout';
import {
  answersOf,
  formIn,
  namesGold,
  quoteCells,
  quoteParts,
  splitWords,
  type SplitWord,
  type WsbFacts,
  type WsbLens,
  type WsbReadout,
  type WsbVerdict,
} from '@/lib/runs/wsb-readout';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

const TH = 'px-2 py-1.5 font-medium';
const JOINED = 'ring-2 ring-violet-500 ring-inset';
const SEARCHED = 'outline-2 outline-sky-400';
const TD = 'px-2 py-1.5';
// The grid's rows have a fixed height, so its box shows at most 12 layers.
const ROW = 'h-6';
const MAX_LAYERS = 12;
const MAX_ROWS = 'max-h-[calc(2rem+12*1.5rem+12px)]';
// The open cell: its tokens in a grid of this many columns, or its text in a box of this height.
const CHIP_COLS = 5;
const TEXT_REM = 8;
/** The verdict table's optional columns, after "Lens": the pick, the evidence and (after "Result")
 * the summarizer's notes. */
type Cols = { pick: boolean; evidence: boolean; notes: boolean };
// By the shown columns, as pick, evidence and notes (1 when shown).
const TEMPLATES: Record<string, string> = {
  '111': 'grid-cols-[auto_auto_minmax(0,1fr)_auto_minmax(0,1fr)]',
  '110': 'grid-cols-[auto_auto_minmax(0,1fr)_auto]',
  '101': 'grid-cols-[auto_auto_auto_minmax(0,1fr)]',
  '100': 'grid-cols-[auto_minmax(0,1fr)_auto]',
  '000': 'grid-cols-[minmax(0,1fr)_auto]',
};
const template = (c: Cols) => TEMPLATES[[c.pick, c.evidence, c.notes].map(Number).join('')];

/** The height in rem of the open cell's token grid, for the cell with the most tokens. */
function chipsRem({ cells }: WsbLens): number {
  const rows = Math.ceil(Math.max(1, ...cells.flat().map((c) => c?.length ?? 0)) / CHIP_COLS);
  return rows * 1.125 + (rows - 1) * 0.25;
}

/** `joined`: the answer's words that the lens spells across adjacent positions. */
type Lens = { key: string; name: string; read: WsbLens; quoteAt: [number, number][]; joined: SplitWord[] };

/** A joined word's tokens, as "narciss + ism". */
const joinedText = (w: SplitWord) => w.parts.map((p) => p.token.trim()).join(' + ');

/**
 * The WorkspaceBench readouts of one question: each lens's verdict, and its readout at each layer
 * and position. A click on a lens's row shows its grid; a click on a cell shows all of its tokens
 * or text. `names`: each lens key's display name, in the order to show them.
 */
export function WsbReadoutView({
  readout,
  facts,
  names,
}: {
  readout: WsbReadout;
  facts: WsbFacts;
  names: Record<string, string>;
}) {
  const answers = answersOf(readout);
  const lenses: Lens[] = [...new Set([...Object.keys(names), ...Object.keys(readout.lenses)])]
    .filter((key) => readout.lenses[key])
    .map((key) => {
      const read = readout.lenses[key]!;
      const quoteAt = quoteCells(read);
      const quote = read.verdict.quote;
      return {
        key,
        name: names[key] ?? key,
        read,
        quoteAt,
        joined: quoteAt.length ? [] : splitWords(read, quote ? [...answers, quote] : answers),
      };
    });
  const [key, setKey] = useState(lenses[0]!.key);
  const [query, setQuery] = useState('');
  const lens = lenses.find((l) => l.key === key) ?? lenses[0]!;
  const { gold, options, units } = readout;
  const digested = lenses.some((l) => l.read.verdict.statements?.length || l.read.verdict.redacted);
  const shown = !readout.redacted;
  const cols: Cols = {
    pick: shown,
    evidence: shown && lenses.some(({ read: { verdict: v }, joined }) => v.quote || v.why || v.note || joined.length),
    notes: shown && digested,
  };
  // One height for the open cell in every lens, so that a lens switch does not move the page.
  const body = Math.max(...lenses.map((l) => (l.read.kind === 'text' ? TEXT_REM : chipsRem(l.read))));
  return (
    <Section
      title="WorkspaceBench Readout"
      info={
        <>
          Each lens reads the model&apos;s residual stream at each layer and position of the prompt.{' '}
          {readout.regex
            ? 'This family has no judge: a regex looks for each part of the answer in the readouts, and the family rule says which parts a pass needs.'
            : digested
              ? `A summarizer reads all the readouts of one lens and writes notes. Then a judge reads the notes and picks the answer that they show${options ? ', or that they cannot tell' : ''}.`
              : `A judge reads all the readouts of one lens at once and picks the answer that they show${options ? ', or that they cannot tell' : ''}.`}
        </>
      }
    >
      {facts.notScored && (
        <p className="text-xs text-amber-800">
          <CodeText text={facts.notScored} />
        </p>
      )}
      {(options || gold || units) && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 pb-2">
          {gold && (
            <Term label="Target Readout">
              <Chip text={gold} good wide />
            </Term>
          )}
          {options && options.some((o) => o !== gold) && (
            <Term label="Decoy / Other Readouts">
              {options
                .filter((o) => o !== gold)
                .map((o) => (
                  <Chip key={o} text={o} wide />
                ))}
            </Term>
          )}
          {units &&
            Object.entries(units).map(([unit, forms]) => (
              <Term key={unit} label={`Forms of ${unit.replace(/_/g, ' ')}`}>
                {forms.map((f) => (
                  <Chip key={f} text={f} />
                ))}
              </Term>
            ))}
        </div>
      )}
      <div className="overflow-x-auto">
        <div
          role={lenses.length > 1 && shown ? 'radiogroup' : undefined}
          aria-label={lenses.length > 1 && shown ? 'Lens' : undefined}
          className={cn('grid gap-y-1 text-xs', template(cols))}
        >
          <div className="col-span-full grid grid-cols-subgrid rounded bg-slate-50 text-slate-500">
            <span className={cn(TH, 'text-left')}>Lens</span>
            {cols.pick && <span className={cn(TH, 'text-left')}>Judge&apos;s Pick</span>}
            {cols.evidence && <span className={cn(TH, 'text-left')}>Judge&apos;s Reasoning or Evidence</span>}
            <span className={cn(TH, 'text-center')}>Result</span>
            {cols.notes && <span className={cn(TH, 'text-left')}>Summarizer&apos;s Notes</span>}
          </div>
          {lenses.map((l) => (
            <LensRow
              key={l.key}
              lens={l}
              gold={gold}
              cols={cols}
              on={lenses.length > 1 && shown ? l.key === lens.key : undefined}
              onPick={() => setKey(l.key)}
            />
          ))}
        </div>
      </div>
      {readout.redacted ? (
        <p className="mt-2 text-xs text-slate-500">
          OpenAudit does not show the readouts of this nocot-bench question, only the result of each lens.
        </p>
      ) : (
        <Readouts lens={lens} lenses={lenses} answers={answers} body={body} query={query} setQuery={setQuery} />
      )}
    </Section>
  );
}

/** The shown lens's grid, with the grid's legend and search. */
function Readouts({
  lens,
  lenses,
  answers,
  body,
  query,
  setQuery,
}: {
  lens: Lens;
  lenses: Lens[];
  answers: string[];
  body: number;
  query: string;
  setQuery: (q: string) => void;
}) {
  return (
    <>
      {lens.read.verdict.redacted && !lens.read.verdict.statements?.length && (
        <p className="mt-2 text-[11px] text-slate-500">
          The harness does not keep the text of the summarizer&apos;s notes and the judge&apos;s quotes for this
          question, so that the source items stay private.
        </p>
      )}
      <hr className="my-2 border-slate-200" />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[11px] text-slate-500">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Key className="bg-emerald-100">Target Answer</Key>
          {lenses.some((l) => l.read.verdict.quote) && (
            <Key className="ring-2 ring-sky-500 ring-inset">Judge&apos;s Pick</Key>
          )}
          {lenses.some((l) => l.joined.length) && <Key className={JOINED}>Joined Tokens</Key>}
          <Key className="ring-2 ring-slate-600 ring-inset">Selected Cell</Key>
          {query.trim() && <Key className={SEARCHED}>Search Match</Key>}
        </div>
        <label className="flex h-6 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2.5 focus-within:border-sky-500">
          <Search aria-hidden className="size-3.5 shrink-0 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
            placeholder="Search Cells"
            aria-label="Search Cells"
            className="w-40 bg-transparent text-[11px] text-slate-800 outline-none placeholder:text-slate-400"
          />
        </label>
      </div>
      <Grid
        key={lens.key}
        lens={lens.read}
        answers={answers}
        quoteAt={lens.quoteAt}
        joined={lens.joined}
        body={body}
        query={query}
      />
    </>
  );
}

/** A lens's verdict, in one row. `cols`: the table's columns. `on`: the row picks the grid to show
 * (true when it is shown); undefined when there is only one lens or no grid. */
function LensRow({
  lens: l,
  gold,
  cols,
  on,
  onPick,
}: {
  lens: Lens;
  gold?: string;
  cols: Cols;
  on?: boolean;
  onPick: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { verdict: v, layers, positions } = l.read;
  const at = l.quoteAt.length === 1 ? l.quoteAt[0]! : null;
  const where = ({ parts }: SplitWord) =>
    `layer ${layers[parts[0]!.at[0]]}, positions ${positions[parts[0]!.at[1]]!.pos}–${positions[parts.at(-1)!.at[1]]!.pos}`;
  const cells = (
    <>
      <span className={cn(TD, 'flex items-center gap-2 whitespace-nowrap text-slate-700')}>
        {on !== undefined && (
          <span
            aria-hidden
            className={cn(
              'flex size-3.5 shrink-0 items-center justify-center rounded-full border bg-white',
              on ? 'border-sky-600' : 'border-sky-300',
            )}
          >
            {on && <span className="size-2 rounded-full bg-sky-600" />}
          </span>
        )}
        {l.name}
      </span>
      {cols.pick && (
        <span className={TD}>
          <Pick verdict={v} gold={gold} />
        </span>
      )}
      {cols.evidence && (
        <span className={cn(TD, 'flex min-w-0 flex-col items-start gap-1 text-slate-600')}>
          {v.quote && (
            <span className="flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <Chip text={v.quote} wrap />
              {l.quoteAt.length > 0 && (
                <span className="text-[11px] text-slate-500">
                  {at ? `Layer ${layers[at[0]]}, position ${positions[at[1]]!.pos}` : `In ${l.quoteAt.length} cells`}
                </span>
              )}
            </span>
          )}
          {l.joined[0] && (
            <span className="flex max-w-full items-center gap-1.5">
              <Chip text={joinedText(l.joined[0])} wide />
              <span className="truncate text-[11px] text-slate-500">
                {l.joined.length === 1
                  ? `Spells ${l.joined[0].word} at ${where(l.joined[0])}`
                  : `Spells ${l.joined[0].word} in ${l.joined.length} places`}
              </span>
            </span>
          )}
          {v.why && <span className="text-[11px]/4 text-slate-600">{v.why}</span>}
          {v.note && <span className="text-[11px]/4 text-slate-500">{v.note}</span>}
        </span>
      )}
      <span className={cn(TD, 'text-center')}>
        {v.pass != null ? (
          <PassMark attempt={{ status: 'success', passed: v.pass }} label />
        ) : (
          <span className="text-slate-400">Not scored</span>
        )}
      </span>
      {cols.notes && (
        <span className={cn(TD, 'min-w-0')}>
          <Notes verdict={v} open={open} setOpen={setOpen} />
        </span>
      )}
    </>
  );
  const row = cn('col-span-full grid grid-cols-subgrid rounded-md border', open ? 'items-start' : 'items-center');
  if (on === undefined) return <div className={cn(row, 'border-transparent')}>{cells}</div>;
  // A div, not a button: the notes cell has its own button.
  return (
    <div
      role="radio"
      aria-checked={on}
      tabIndex={0}
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        onPick();
      }}
      className={cn(
        row,
        'cursor-pointer text-left',
        on ? 'border-sky-600 bg-sky-50' : 'border-transparent hover:bg-slate-50',
      )}
    >
      {cells}
    </div>
  );
}

/** The summarizer's notes on a lens's readouts, which the judge read: the first note on one line,
 * and all of them after "Show All". A click on the open list closes it. */
function Notes({
  verdict: { statements, redacted },
  open,
  setOpen,
}: {
  verdict: WsbVerdict;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  if (!statements?.length) return <span className="text-slate-400">{redacted ? 'Not kept' : '–'}</span>;
  const Chevron = open ? ChevronUp : ChevronDown;
  const toggle = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setOpen(!open);
      }}
      onKeyDown={(e) => e.stopPropagation()}
      className="ml-auto flex shrink-0 items-center gap-0.5 text-[10px] font-semibold tracking-wide text-sky-800 uppercase hover:underline"
    >
      {open ? 'Show Less' : 'Show All'}
      <Chevron aria-hidden className="size-3" />
    </button>
  );
  if (!open) {
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="min-w-0 truncate text-slate-700" title={statements[0]!.text}>
          {statements[0]!.text}
        </span>
        {toggle}
      </span>
    );
  }
  // A click on the open list closes it, as "Show Less" does.
  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        setOpen(false);
      }}
      className="flex min-w-0 cursor-pointer flex-col gap-1"
    >
      <ul className="list-disc pl-4 marker:text-slate-400">
        {statements.map((s, i) => (
          <li key={i} className="mb-1 text-slate-700 last:mb-0">
            {s.text}
            {s.support && <span className="ml-1.5 text-[11px] text-slate-500">({s.support})</span>}
            {s.evidence && (
              <span className="block font-mono text-[11px] wrap-anywhere text-slate-500">{s.evidence}</span>
            )}
          </li>
        ))}
      </ul>
      {toggle}
    </span>
  );
}

/** The judge's pick, an option or claim (green when it is the gold), and the hit of each part. */
function Pick({ verdict: v, gold }: { verdict: WsbVerdict; gold?: string }) {
  if (!v.pick && !v.units) return <span className="text-slate-400">–</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {v.pick && <Chip text={v.pick} good={!!gold && v.pick === gold} bad={!!gold && v.pick !== gold} wide />}
      {Object.entries(v.units ?? {}).map(([unit, hit]) => (
        <Chip key={unit} text={`${unit} ${hit ? '✓' : '✗'}`} good={hit} bad={!hit} />
      ))}
    </span>
  );
}

/** One lens's cells: a row for each layer and a column for each position. A cell shows its top token
 * or the start of its text. `quoteAt`: the cells that hold the judge's quote. The grid opens on one
 * of them (one that names the gold first), else on the first joined word, else on the last cell
 * that names the gold, else on the last cell, and scrolls it to the middle. One cell is always open.
 * `joined`: words spelled across adjacent positions. `body`: the open cell's height in rem.
 * `query`: only the layers and positions with a cell that has it show (any case); the other cells
 * there are faint. The cells and the open cell's entries that have it get a sky outline. */
function Grid({
  lens,
  answers,
  quoteAt,
  joined,
  body,
  query,
}: {
  lens: WsbLens;
  answers: string[];
  quoteAt: [number, number][];
  joined: SplitWord[];
  body: number;
  query: string;
}) {
  const { layers, positions, cells, kind } = lens;
  const q = query.trim().toLowerCase();
  const hit = (t: string) => !!q && (t.toLowerCase().includes(q) || tokenText(t).toLowerCase().includes(q));
  const match = q ? cells.map((row) => row.map((c) => !!c?.some(hit))) : null;
  const rows = layers.map((_, i) => i).filter((i) => !match || match[i]!.some(Boolean));
  const cols = positions.map((_, j) => j).filter((j) => !match || match.some((r) => r[j]));
  const gold = (i: number, j: number) => namesGold(cells[i]?.[j] ?? null, kind, answers);
  const first = (() => {
    const quoted = quoteAt.find(([i, j]) => gold(i, j)) ?? quoteAt[0] ?? joined[0]?.parts[0]!.at;
    if (quoted) return quoted;
    for (let i = layers.length - 1; i >= 0; i--) {
      const j = cells[i]!.findIndex((_, j) => gold(i, j));
      if (j >= 0) return [i, j] as const;
    }
    for (let i = layers.length - 1; i >= 0; i--) {
      const j = cells[i]!.findLastIndex((c) => c != null);
      if (j >= 0) return [i, j] as const;
    }
    return null;
  })();
  const [at, setAt] = useState<readonly [number, number] | null>(first);
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = box.current;
    const cell = first && el?.querySelector(`[data-at="${first[0]}-${first[1]}"]`);
    if (!el || !cell) return;
    const b = el.getBoundingClientRect();
    const c = cell.getBoundingClientRect();
    el.scrollTo({
      left: el.scrollLeft + c.left - b.left - (b.width - c.width) / 2,
      top: el.scrollTop + c.top - b.top - (b.height - c.height) / 2,
    });
    // Only when the grid opens: a click on a cell does not move it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const quoted = new Set(quoteAt.map(([i, j]) => `${i}-${j}`));
  // Each joined token, as "layer-position|token".
  const joinedTokens = new Set(joined.flatMap((w) => w.parts.map((p) => `${p.at[0]}-${p.at[1]}|${p.token}`)));
  const joinedCells = new Set([...joinedTokens].map((k) => k.split('|')[0]));
  const parts = quoteParts(lens.verdict.quote ?? '');
  const shown = at && cells[at[0]]?.[at[1]];
  return (
    <div className="flex flex-col gap-2">
      {/* The bottom padding keeps an overlay scroll bar (Safari) off the last row. */}
      <div
        ref={box}
        className={cn(
          'shrink-0 rounded border border-slate-200 pb-3',
          rows.length > MAX_LAYERS ? cn('overflow-auto', MAX_ROWS) : 'overflow-x-auto overflow-y-hidden',
          !rows.length && 'hidden',
        )}
      >
        <table className="text-xs">
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
            <tr className="h-8">
              <th className={cn(TH, 'sticky left-0 bg-slate-50 py-0 text-center')}>Layer</th>
              {cols.map((j) => (
                <th
                  key={positions[j]!.pos}
                  className={cn(TH, 'py-0 text-center')}
                  title={`Position ${positions[j]!.pos}`}
                >
                  <Chip text={positions[j]!.token} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="isolate divide-y divide-slate-100">
            {rows.map((i) => (
              <tr key={layers[i]} className={ROW}>
                <td className={cn(TD, 'sticky left-0 bg-white py-0 text-center font-mono text-slate-500 tabular-nums')}>
                  {layers[i]}
                </td>
                {cols.map((j) => {
                  const cell = cells[i]![j];
                  const on = at?.[0] === i && at[1] === j;
                  return (
                    <td key={positions[j]!.pos} className={cn('px-0.5 py-0', match && !match[i]![j] && 'opacity-30')}>
                      {cell ? (
                        <button
                          type="button"
                          data-at={`${i}-${j}`}
                          onClick={() => setAt([i, j])}
                          title={kind === 'text' ? cell[0] : cell.join(' | ')}
                          className={cn(
                            'block w-full truncate rounded px-1 text-left font-mono text-[11px]/5',
                            kind === 'text' ? 'max-w-[20ch]' : 'max-w-[12ch]',
                            gold(i, j) ? 'bg-emerald-100 text-emerald-900' : 'text-slate-700 hover:bg-slate-100',
                            quoted.has(`${i}-${j}`) && 'ring-2 ring-sky-500 ring-inset',
                            joinedCells.has(`${i}-${j}`) && JOINED,
                            match?.[i]![j] && SEARCHED,
                            on && 'outline-2 outline-offset-1 outline-slate-600',
                          )}
                        >
                          {kind === 'text' ? (cell[0] ?? '').replace(/\s+/g, ' ') : tokenText(cell[0] ?? '')}
                        </button>
                      ) : (
                        <span className="block px-1 text-center text-slate-300">–</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p className="rounded border border-slate-200 px-2 py-3 text-xs text-slate-500">No cells match the search.</p>
      )}
      {shown && at && (
        <div className="flex flex-col gap-1.5 text-xs text-slate-500">
          <span className="truncate">
            Layer {layers[at[0]]}, position {positions[at[1]]!.pos} <Chip text={positions[at[1]]!.token} />
          </span>
          {kind === 'text' ? (
            <div
              className="flex [scrollbar-gutter:stable] flex-col gap-1.5 overflow-y-auto p-0.5"
              style={{ height: `${body}rem` }}
            >
              {shown.map((s, k) => (
                <p
                  key={k}
                  className={cn(
                    'rounded bg-slate-50 px-2 py-1.5 font-mono text-[11px] whitespace-pre-wrap text-slate-700',
                    parts.length > 0 && parts.every((q) => formIn(s, q)) && 'ring-2 ring-sky-500 ring-inset',
                    hit(s) && SEARCHED,
                  )}
                >
                  {s}
                </p>
              ))}
            </div>
          ) : (
            <span
              className="grid auto-rows-[1.125rem] content-start gap-1"
              style={{ gridTemplateColumns: `repeat(${CHIP_COLS}, minmax(0, 1fr))`, height: `${body}rem` }}
            >
              {shown.map((t, k) => (
                <Chip
                  key={k}
                  text={t}
                  good={namesGold([t], kind, answers)}
                  quote={parts.some((q) => formIn(t, q))}
                  joined={joinedTokens.has(`${at[0]}-${at[1]}|${t}`)}
                  searched={hit(t)}
                  fit
                />
              ))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** One entry of the grid's legend: a sample cell with the style in `className`. */
function Key({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={cn('inline-block h-3 w-5 rounded', className)} />
      {children}
    </span>
  );
}

/** A small label, with its words below it. */
function Term({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 text-xs text-slate-500">
      <span className="text-[11px] font-medium">{label}</span>
      <span className="flex flex-wrap items-center gap-1">{children}</span>
    </div>
  );
}

/** `quote`: the chip holds the judge's quote. `joined`: the chip is part of a joined word. `searched`:
 * the chip has the search. `fit`: the chip is as wide as its grid cell at most. `wrap`: all the text
 * shows, on more lines if needed. */
function Chip({
  text,
  good,
  bad,
  wide,
  quote,
  joined,
  searched,
  fit,
  wrap,
}: {
  text: string;
  good?: boolean;
  bad?: boolean;
  wide?: boolean;
  quote?: boolean;
  joined?: boolean;
  searched?: boolean;
  fit?: boolean;
  wrap?: boolean;
}) {
  return (
    <span
      title={JSON.stringify(text)}
      className={cn(
        'inline-block rounded px-1 py-px align-bottom font-mono text-[11px]',
        wrap ? 'max-w-full wrap-anywhere whitespace-pre-wrap' : 'truncate',
        !wrap && (fit ? 'max-w-full justify-self-start' : wide ? 'max-w-[40ch]' : 'max-w-[14ch]'),
        good ? 'bg-emerald-100 text-emerald-900' : bad ? 'bg-rose-100 text-rose-900' : 'bg-slate-100 text-slate-700',
        quote && 'ring-2 ring-sky-500 ring-inset',
        joined && JOINED,
        searched && SEARCHED,
      )}
    >
      {tokenText(text)}
    </span>
  );
}
